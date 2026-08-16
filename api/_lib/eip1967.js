import {
  EIP1967BeaconNotFound,
  EIP1967ImplementationNotFound,
  getAdminAddress,
  getBeaconAddress,
  getImplementationAddress,
  getImplementationAddressFromBeacon,
} from "@openzeppelin/upgrades-core";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
// keccak256("eip1967.proxy.implementation") - 1. upgrades-core's
// getImplementationAddress also falls back to the pre-EIP-1967 ZeppelinOS
// slot (keccak256("org.zeppelinos.proxy.implementation")), so when it
// resolves an implementation we read this slot directly to tell the two
// kinds apart (e.g. USDC is a legacy zos proxy, not EIP-1967).
const EIP1967_IMPLEMENTATION_SLOT =
  "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
const RPC_TIMEOUT_MS = 4_000;
// Detection makes up to three RPC calls (implementation, beacon, admin) and
// each call retries every candidate URL, so keep the list short enough that a
// chain full of dead RPCs can't run past the serverless function timeout.
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

export async function getEip1967ProxyInfo(chainId, address) {
  const rpcUrls = await getRpcUrls(chainId);
  if (rpcUrls.length === 0) {
    throw new Error(`No public HTTPS RPC URL found for chain ID ${chainId}.`);
  }

  const provider = createFallbackProvider(rpcUrls);
  const directImplementationAddress = await getOptionalImplementationAddress(
    provider,
    address
  );
  const beaconAddress = directImplementationAddress
    ? undefined
    : await getOptionalBeaconAddress(provider, address);
  const beaconImplementationAddress = beaconAddress
    ? await getImplementationAddressFromBeacon(provider, beaconAddress)
    : undefined;

  const implementationAddress =
    directImplementationAddress ?? beaconImplementationAddress;

  if (!implementationAddress) {
    return { isProxy: false };
  }

  let kind = beaconAddress ? "beacon" : "eip1967";
  if (
    directImplementationAddress &&
    !(await isEip1967ImplementationSlotSet(provider, address))
  ) {
    kind = "legacy";
  }

  const adminAddress = await getOptionalAdminAddress(provider, address);
  return {
    isProxy: true,
    proxyInfo: {
      kind,
      proxyAddress: address,
      implementationAddress,
      ...(adminAddress ? { adminAddress } : {}),
      ...(beaconAddress ? { beaconAddress } : {}),
    },
  };
}

async function isEip1967ImplementationSlotSet(provider, address) {
  try {
    const rawSlot = await provider.send("eth_getStorageAt", [
      address,
      EIP1967_IMPLEMENTATION_SLOT,
      "latest",
    ]);
    return Boolean(rawSlot) && BigInt(rawSlot) !== 0n;
  } catch {
    // Can't tell the kinds apart - keep the default EIP-1967 label.
    return true;
  }
}

export function isAddress(value) {
  return /^0x[0-9a-fA-F]{40}$/.test(value);
}

export function sameAddress(left, right) {
  return left?.toLowerCase() === right?.toLowerCase();
}

async function getRpcUrls(chainId) {
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

function createFallbackProvider(rpcUrls) {
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

async function getOptionalImplementationAddress(provider, address) {
  try {
    return await getImplementationAddress(provider, address);
  } catch (error) {
    if (error instanceof EIP1967ImplementationNotFound) {
      return undefined;
    }
    throw error;
  }
}

async function getOptionalBeaconAddress(provider, address) {
  try {
    return await getBeaconAddress(provider, address);
  } catch (error) {
    if (error instanceof EIP1967BeaconNotFound) {
      return undefined;
    }
    throw error;
  }
}

async function getOptionalAdminAddress(provider, address) {
  // The admin address is informational only - a failure reading it must not
  // discard an already-successful implementation detection.
  try {
    const adminAddress = await getAdminAddress(provider, address);
    return adminAddress.toLowerCase() === ZERO_ADDRESS
      ? undefined
      : adminAddress;
  } catch {
    return undefined;
  }
}
