import {
  solcInputOutputDecoder,
  extractStorageLayout,
} from "@openzeppelin/upgrades-core";

import type { ContractDefinition } from "solidity-ast";
import { isNodeType, findAll, astDereferencer } from "solidity-ast/utils.js";

import type {
  SolcInput,
  SolcOutput,
  StorageLayout,
} from "@openzeppelin/upgrades-core";

interface ExtractStorageLayoutRequestBody {
  solcInput: SolcInput;
  solcOutput: SolcOutput;
  sourceName: string;
  contractName: string;
}

export async function POST(request: Request): Promise<Response> {
  try {
    const { solcInput, solcOutput, sourceName, contractName } =
      (await request.json()) as ExtractStorageLayoutRequestBody;

    // Build decodeSrc function
    const decodeSrc = solcInputOutputDecoder(solcInput, solcOutput);

    // Get contract definition from the ast
    const contractDefinitions = Array.from(
      findAll("ContractDefinition", solcOutput.sources[sourceName].ast)
    );
    const contractDef = contractDefinitions.find(
      (_contractDef: ContractDefinition) => _contractDef.name === contractName
    );
    if (!contractDef) {
      return new Response(
        JSON.stringify({ message: "Contract definition not found" }),
        { status: 404 }
      );
    }

    // Build ast dereferencer
    const deref = astDereferencer(solcOutput);

    // Get Namespaced Output
    // TODO

    // Extract the storage layout
    const storageLayout: StorageLayout = extractStorageLayout(
      contractDef,
      decodeSrc,
      deref,
      solcOutput.contracts[sourceName][contractDef.name].storageLayout,
      undefined //getNamespacedCompilationContext(sourceName, contractDef, namespacedOutput) // TODO  Add namespaces support try to compile namespacedOutput in the frontend
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
  source: string,
  contractDef: ContractDefinition,
  namespacedOutput?: SolcOutput
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
