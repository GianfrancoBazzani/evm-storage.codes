import {
  makeNamespacedInput,
  trySanitizeNatSpec,
} from "@openzeppelin/upgrades-core";
import {
  brotliDecompressSync,
  brotliCompressSync,
  constants as zlibConstants,
} from "zlib";

const BROTLI_QUALITY = 9;

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
    const compilerVersion = decompressedDataJson.compilerVersion;

    // Generate namespaced Input
    let namespacedInput = makeNamespacedInput(
      solcInput,
      solcOutput,
      compilerVersion
    );
    namespacedInput = await trySanitizeNatSpec(
      namespacedInput,
      compilerVersion
    );

    // Compress the namespaced input
    const namespacedInputBuffer = Buffer.from(
      JSON.stringify(namespacedInput),
      "utf-8"
    );
    const compressedNamespacedInput = brotliCompressSync(
      namespacedInputBuffer,
      {
        params: {
          [zlibConstants.BROTLI_PARAM_QUALITY]: BROTLI_QUALITY,
        },
      }
    );

    return new Response(compressedNamespacedInput, {
      status: 200,
      headers: {
        "Content-Encoding":"br",
        "Content-Type": "application/octets-stream",
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
