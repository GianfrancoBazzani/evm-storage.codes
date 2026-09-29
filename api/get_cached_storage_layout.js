import { Redis } from "@upstash/redis";
import {
  getEip1967ProxyInfo,
  isAddress,
  sameAddress,
} from "./_lib/eip1967.js";
import { VALUE_METADATA_VERSION } from "./_lib/value-metadata-version.js";

export async function POST(request) {
  try {
    const { chainId, address } = await request.json();

    if (!chainId || !address) {
      return jsonResponse({ message: "Chain ID and address are required." }, 400);
    }
    if (!/^\d+$/.test(String(chainId)) || !isAddress(address)) {
      return jsonResponse({ message: "Invalid chain ID or address." }, 400);
    }

    // Cache the storage layout in Redis
    const redis = Redis.fromEnv();
    const cacheKey = `${chainId}:${address}`;
    const entry = await redis.get(cacheKey);

    if (!entry?.storageLayout) {
      return cacheMissResponse();
    }
    // Entries cached before on-chain value decoding existed (or by an older
    // version of it) won't have the types[].encoding/base/key/value fields
    // that decoding needs - treat a version mismatch as a cache miss so the
    // wizard regenerates and re-caches in the current shape, rather than
    // silently degrading every row to "unsupported" forever.
    if (entry.valueMetadataVersion !== VALUE_METADATA_VERSION) {
      return cacheMissResponse(
        "Cached storage layout predates on-chain value decoding support."
      );
    }

    // Proxies can be upgraded after their layout was cached, which would
    // leave us serving the old implementation's layout forever. Re-resolve
    // the proxy and treat a changed implementation as a cache miss so the
    // wizard regenerates (and re-caches) the current one. If the check
    // itself fails (RPCs down), serve the possibly-stale entry rather than
    // breaking the share link.
    if (entry.proxyInfo?.implementationAddress) {
      try {
        const proxyResolution = await getEip1967ProxyInfo(
          Number(chainId),
          address
        );
        if (
          !proxyResolution.proxyInfo ||
          !sameAddress(
            proxyResolution.proxyInfo.implementationAddress,
            entry.proxyInfo.implementationAddress
          )
        ) {
          return cacheMissResponse("Cached proxy implementation is outdated.");
        }
      } catch (error) {
        console.warn(
          "Proxy staleness check failed, serving cached layout:",
          error
        );
      }
    }

    return jsonResponse(
      {
        storageLayout: entry.storageLayout,
        contractName: entry.contractName,
        sourceAddress: entry.sourceAddress,
        proxyInfo: entry.proxyInfo,
      },
      200,
      entry.proxyInfo ? "no-store" : "s-maxage=86400, stale-while-revalidate"
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error(errorMessage);
    return jsonResponse({ message: errorMessage }, 500);
  }
}

function cacheMissResponse(message = "Storage layout not cached.") {
  return jsonResponse({ message }, 404);
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
