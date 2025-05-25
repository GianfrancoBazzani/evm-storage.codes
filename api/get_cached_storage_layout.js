import { Redis } from "@upstash/redis";

export async function POST(request) {
  try {
    const { chainId, address } = await request.json();

    if (!chainId || !address) {
      return new Response(
        JSON.stringify({ message: "Chain ID and address are required." }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Cache the storage layout in Redis
    const redis = Redis.fromEnv();
    const cacheKey = `${chainId}:${address}`;
    const entry = await redis.get(cacheKey);

    if (!entry.storageLayout) {
      return new Response(
        JSON.stringify({ message: "Storage layout not cached." }),
        {
          status: 404,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    return new Response(
      JSON.stringify({
        storageLayout: entry.storageLayout,
        contractName: entry.contractName,
      }),
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
