import {
  getEip1967ProxyInfo,
  isAddress,
} from "./_lib/eip1967.js";

export async function POST(request) {
  try {
    const { chainId, address } = await request.json();

    if (!chainId || !address) {
      return jsonResponse(
        { message: "Chain ID and address are required." },
        400
      );
    }
    if (!/^\d+$/.test(String(chainId)) || !isAddress(address)) {
      return jsonResponse({ message: "Invalid chain ID or address." }, 400);
    }

    return jsonResponse(
      await getEip1967ProxyInfo(Number(chainId), address)
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error(errorMessage);
    return jsonResponse({ message: errorMessage }, 500);
  }
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "s-maxage=300, stale-while-revalidate",
    },
  });
}
