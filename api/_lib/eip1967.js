import {
  EIP1967BeaconNotFound,
  EIP1967ImplementationNotFound,
  getAdminAddress,
  getBeaconAddress,
  getImplementationAddress,
  getImplementationAddressFromBeacon,
} from "@openzeppelin/upgrades-core";
import { getRpcUrls, createFallbackProvider } from "./rpc.js";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
// keccak256("eip1967.proxy.implementation") - 1. upgrades-core's
// getImplementationAddress also falls back to the pre-EIP-1967 ZeppelinOS
// slot (keccak256("org.zeppelinos.proxy.implementation")), so when it
// resolves an implementation we read this slot directly to tell the two
// kinds apart (e.g. USDC is a legacy zos proxy, not EIP-1967).
const EIP1967_IMPLEMENTATION_SLOT =
  "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

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
