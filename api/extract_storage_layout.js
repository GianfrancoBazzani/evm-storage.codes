import {
  solcInputOutputDecoder,
  extractStorageLayout,
} from "@openzeppelin/upgrades-core";

import { findAll, astDereferencer, isNodeType } from "solidity-ast/utils.js";

export async function POST(request) {
  try {
    const {
      solcInput,
      solcOutput,
      namespacedOutput,
      sourceName,
      contractName,
    } = await request.json();

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
    const storageLayout = extractStorageLayout(
      contractDef,
      decodeSrc,
      deref,
      solcOutput.contracts[sourceName][contractDef.name].storageLayout,
      getNamespacedCompilationContext(sourceName, contractDef, namespacedOutput)
    );

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
    console.error(errorMessage);
    return new Response(JSON.stringify({ message: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
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
