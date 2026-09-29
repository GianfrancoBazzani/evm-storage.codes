import { isAddress } from "./_lib/eip1967.js";
import { getRpcUrls, createFallbackProvider } from "./_lib/rpc.js";

// Bounds the RPC fan-out per request (each entry is one eth_getStorageAt
// call, run in parallel) so a pathological request can't run past the
// serverless function timeout.
const MAX_SLOTS_PER_REQUEST = 400;

export async function POST(request) {
  try {
    const { chainId, address, slots } = await request.json();

    if (!chainId || !address || !Array.isArray(slots) || slots.length === 0) {
      return jsonResponse(
        { message: "Chain ID, address and a non-empty slot list are required." },
        400
      );
    }
    if (!/^\d+$/.test(String(chainId)) || !isAddress(address)) {
      return jsonResponse({ message: "Invalid chain ID or address." }, 400);
    }
    if (slots.length > MAX_SLOTS_PER_REQUEST) {
      return jsonResponse(
        { message: `Too many slots requested (max ${MAX_SLOTS_PER_REQUEST}).` },
        400
      );
    }

    let normalizedSlots;
    try {
      normalizedSlots = slots.map((slot) => [slot, toSlotHex(slot)]);
    } catch {
      return jsonResponse({ message: "Invalid slot value." }, 400);
    }

    const rpcUrls = await getRpcUrls(Number(chainId));
    if (rpcUrls.length === 0) {
      return jsonResponse(
        { message: `No public HTTPS RPC URL found for chain ID ${chainId}.` },
        502
      );
    }

    const provider = createFallbackProvider(rpcUrls);
    const values = {};
    await Promise.all(
      normalizedSlots.map(async ([original, hex]) => {
        values[original] = await provider.send("eth_getStorageAt", [
          address,
          hex,
          "latest",
        ]);
      })
    );

    return jsonResponse({ values }, 200, "no-store");
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error(errorMessage);
    return jsonResponse({ message: errorMessage }, 500);
  }
}

// Slots are given as decimal or 0x-hex strings representing a uint256 (either
// a storage slot index, or a keccak256-derived pointer for dynamic
// bytes/string data). Throws on anything else.
function toSlotHex(slot) {
  if (typeof slot !== "string" && typeof slot !== "number") {
    throw new Error("Invalid slot value.");
  }
  const value = BigInt(slot);
  if (value < 0n || value > (1n << 256n) - 1n) {
    throw new Error("Slot out of range.");
  }
  return `0x${value.toString(16).padStart(64, "0")}`;
}

function jsonResponse(body, status = 200, cacheControl = undefined) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...(cacheControl ? { "Cache-Control": cacheControl } : {}),
    },
  });
}
