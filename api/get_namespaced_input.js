import {
  makeNamespacedInput,
  trySanitizeNatSpec,
} from "@openzeppelin/upgrades-core";

export async function POST(request) {
  try {
    const { solcInput, solcOutput, compilerVersion } = await request.json();
    
    let namespacedInput = makeNamespacedInput(
      solcInput,
      solcOutput,
      compilerVersion
    );
    namespacedInput = await trySanitizeNatSpec(
      namespacedInput,
      compilerVersion
    );

    return new Response(JSON.stringify({ namespacedInput }), {
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
