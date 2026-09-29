const RPC_TIMEOUT_MS = 4_000;
// Detection/read calls retry every candidate URL on failure, so keep the
// list short enough that a chain full of dead RPCs can't run past the
// serverless function timeout.
const MAX_RPC_URLS = 5;
const FALLBACK_RPC_URLS = {
  1: [
    "https://ethereum-rpc.publicnode.com",
    "https://rpc.flashbots.net",
    "https://eth.merkle.io",
  ],
  10: ["https://mainnet.optimism.io"],
  56: ["https://bsc-dataseed.binance.org"],
  137: ["https://polygon-rpc.com"],
  8453: ["https://mainnet.base.org"],
  42161: ["https://arb1.arbitrum.io/rpc"],
  43114: ["https://api.avax.network/ext/bc/C/rpc"],
  11155111: ["https://ethereum-sepolia-rpc.publicnode.com"],
};

export async function getRpcUrls(chainId) {
  const fallbackUrls = FALLBACK_RPC_URLS[chainId] ?? [];
  try {
    const response = await fetch("https://sourcify.dev/server/chains", {
      signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error("Failed to fetch Sourcify chain metadata.");
    }

    const chains = await response.json();
    const chain = chains.find((candidate) => candidate.chainId === chainId);
    if (!chain && fallbackUrls.length === 0) {
      throw new Error(`Chain ID ${chainId} is not listed by Sourcify.`);
    }

    return [
      ...fallbackUrls,
      ...(chain?.rpc ?? []),
      ...(chain?.traceSupportedRPCs ?? []),
    ]
      .filter(isUsableRpcUrl)
      .filter((url, index, urls) => urls.indexOf(url) === index)
      .slice(0, MAX_RPC_URLS);
  } catch (error) {
    if (fallbackUrls.length > 0) {
      return fallbackUrls;
    }
    throw error;
  }
}

function isUsableRpcUrl(url) {
  return (
    typeof url === "string" &&
    url.startsWith("https://") &&
    !url.includes("${") &&
    !url.includes("{") &&
    !url.includes("}") &&
    !url.includes("localhost") &&
    !url.includes("127.0.0.1")
  );
}

export function createFallbackProvider(rpcUrls) {
  let preferredRpcUrl;
  return {
    async send(method, params) {
      const errors = [];
      const orderedRpcUrls = preferredRpcUrl
        ? [preferredRpcUrl, ...rpcUrls.filter((url) => url !== preferredRpcUrl)]
        : rpcUrls;
      for (const rpcUrl of orderedRpcUrls) {
        try {
          const result = await sendRpc(rpcUrl, method, params);
          preferredRpcUrl = rpcUrl;
          return result;
        } catch (error) {
          const message = error instanceof Error ? error.message : error;
          errors.push(`${rpcUrl}: ${message}`);
        }
      }
      throw new Error(
        `All RPC URLs failed for ${method}: ${errors.join(" | ")}`
      );
    },
  };
}

async function sendRpc(rpcUrl, method, params) {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params,
    }),
    signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (payload.error) {
    throw new Error(payload.error.message ?? "RPC error");
  }
  return payload.result;
}
