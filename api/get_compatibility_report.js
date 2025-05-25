import {
  getStorageUpgradeReport,
  withValidationDefaults,
} from "@openzeppelin/upgrades-core";

export async function POST(request) {
  try {
    const { originStorageLayout, destinationStorageLayout } =
      await request.json();

    if (!originStorageLayout || !destinationStorageLayout) {
      return new Response(
        JSON.stringify({ message: "Chain ID and address are required." }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const compatibilityReport = getStorageUpgradeReport(
      originStorageLayout,
      destinationStorageLayout,
      withValidationDefaults({})
    ).explain();

    return new Response(
      JSON.stringify({ compatibilityReport: compatibilityReport }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "s-maxage=86400, stale-while-revalidate",
        },
      }
    );
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
