import {
  solcInputOutputDecoder,
  extractStorageLayout,
} from "@openzeppelin/upgrades-core";
import { brotliDecompressSync } from "zlib";
import { findAll, astDereferencer, isNodeType } from "solidity-ast/utils.js";
import { Redis } from "@upstash/redis";
import { getEip1967ProxyInfo, sameAddress } from "./_lib/eip1967.js";

export async function POST(request) {
  try {
    // Get the request body as an ArrayBuffer
    const requestBodyArrayBuffer = await request.arrayBuffer();
    const requestBodyBuffer = Buffer.from(requestBodyArrayBuffer);

    // Decompress and deconstruct the data
    const decompressedData = brotliDecompressSync(requestBodyBuffer);
    const decompressedDataString = decompressedData.toString("utf-8");
    const decompressedDataJson = JSON.parse(decompressedDataString);
    const solcInput = decompressedDataJson.solcInput;
    const solcOutput = decompressedDataJson.solcOutput;
    const namespacedOutput = decompressedDataJson.namespacedOutput;
    const sourceName = decompressedDataJson.sourceName;
    const contractName = decompressedDataJson.contractName;
    const chainId = decompressedDataJson.chainId;
    const address = decompressedDataJson.address;
    const sourceAddress = decompressedDataJson.sourceAddress;

    // Build decodeSrc function
    const decodeSrc = solcInputOutputDecoder(solcInput, solcOutput);

    // Get contract definition from the ast
    const contractDefinitions = Array.from(
      findAll("ContractDefinition", solcOutput.sources[sourceName].ast)
    );
    const contractDef = contractDefinitions.find(
      (_contractDef) => _contractDef.name === contractName
    );
    if (!contractDef) {
      return new Response(
        JSON.stringify({ message: "Contract definition not found" }),
        { status: 404 }
      );
    }

    // Build ast dereferencer
    const deref = astDereferencer(solcOutput);

    // Extract the storage layout
    const rawStorageLayout =
      solcOutput.contracts[sourceName][contractDef.name].storageLayout;
    const namespacedContext = getNamespacedCompilationContext(
      sourceName,
      contractDef,
      namespacedOutput
    );
    const storageLayout = extractStorageLayout(
      contractDef,
      decodeSrc,
      deref,
      rawStorageLayout,
      namespacedContext
    );

    // upgrades-core's extractStorageLayout only keeps label/members/
    // numberOfBytes on each type entry - it deliberately drops solc's
    // `encoding`/`base`/`key`/`value` fields, which it doesn't need for its
    // own purposes but which the frontend needs to decode on-chain values
    // (encoding distinguishes a plain scalar from a mapping/array/dynamic
    // bytes, and base/key/value point at the relevant sub-type). Merge them
    // back in from the raw solc output(s) we already have on hand.
    enrichTypesWithSolcFields(
      storageLayout,
      rawStorageLayout,
      namespacedContext?.storageLayout
    );

    // Cache the storage layout in the database if it is not already cached.
    if (chainId && address) {
      try {
        let integrityAddress = address;
        let cacheProxyInfo = undefined;
        if (sourceAddress && !sameAddress(sourceAddress, address)) {
          const proxyResolution = await getEip1967ProxyInfo(
            Number(chainId),
            address
          );
          if (
            !proxyResolution.proxyInfo ||
            !sameAddress(
              proxyResolution.proxyInfo.implementationAddress,
              sourceAddress
            )
          ) {
            console.warn(
              "Proxy implementation does not match provided sourceAddress; storage layout wont be cached"
            );
            throw new Error("");
          }
          integrityAddress = sourceAddress;
          cacheProxyInfo = proxyResolution.proxyInfo;
        }

        // Minimal integrity test
        const response = await fetch(
          `https://sourcify.dev/server/v2/contract/${chainId}/${integrityAddress}?fields=stdJsonInput,compilation`,
          {
            method: "GET",
          }
        );
        if (!response.ok) {
          console.error("Failed to fetch contract data from Sourcify");
          throw new Error("");
        }
        const { stdJsonInput, compilation } = await response.json();
        if (
          JSON.stringify(stdJsonInput.sources) !==
          JSON.stringify(solcInput.sources)
        ) {
          console.warn(
            "Sourcify sources do not match the provided solcInput sources storage layout wont be cached"
          );
          throw new Error("");
        }
        if (contractName !== compilation.name) {
          console.warn(
            "Sourcify contract name does not match the provided contractName storage layout wont be cached"
          );
          throw new Error("");
        }
        // TODO: Improve integrity test right now storage layout can be tricked if frontend is malicious
        // so we don't pick the cached smart contracts automatically in AnalyzeWizardButton before compilation steps.

        // Cache the storage layout in Redis
        const redis = Redis.fromEnv();
        const cacheKey = `${chainId}:${address}`;
        await redis.set(cacheKey, {
          storageLayout: storageLayout,
          contractName: contractName,
          sourceAddress:
            sourceAddress && !sameAddress(sourceAddress, address)
              ? sourceAddress
              : undefined,
          proxyInfo: cacheProxyInfo,
        });
        //await redis.set(cacheKey, storageLayout, {
        //  nx: true, // only store if not already exists
        //});
      } catch (error) {}
    }

    return new Response(JSON.stringify({ storageLayout }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "s-maxage=86400, stale-while-revalidate",
      },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ message: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

function enrichTypesWithSolcFields(layout, ...rawLayouts) {
  const rawTypes = Object.assign(
    {},
    ...rawLayouts.filter(Boolean).map((rawLayout) => rawLayout.types ?? {})
  );
  for (const [id, type] of Object.entries(layout.types)) {
    const raw = rawTypes[id];
    if (!raw) continue;
    if (raw.encoding !== undefined) type.encoding = raw.encoding;
    if (raw.base !== undefined) type.base = raw.base;
    if (raw.key !== undefined) type.key = raw.key;
    if (raw.value !== undefined) type.value = raw.value;
  }
}

function getNamespacedCompilationContext(
  source,
  contractDef,
  namespacedOutput
) {
  if (
    namespacedOutput === undefined ||
    contractDef.canonicalName === undefined
  ) {
    return undefined;
  }

  if (namespacedOutput.sources[source] === undefined) {
    throw new Error(`Source ${source} not found in namespaced solc output`);
  }

  const namespacedContractDef = namespacedOutput.sources[source].ast.nodes
    .filter(isNodeType("ContractDefinition"))
    .find((c) => c.canonicalName === contractDef.canonicalName);

  if (namespacedContractDef === undefined) {
    throw new Error(
      `Contract definition with name ${contractDef.canonicalName} not found in namespaced solc output`
    );
  }

  const storageLayout =
    namespacedOutput.contracts[source][contractDef.name].storageLayout;
  if (storageLayout === undefined) {
    throw new Error(
      `Storage layout for contract ${contractDef.canonicalName} not found in namespaced solc output`
    );
  }

  return {
    contractDef: namespacedContractDef,
    deref: astDereferencer(namespacedOutput),
    storageLayout: storageLayout,
  };
}
