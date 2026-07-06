export interface Eip1967ProxyInfo {
  // "legacy" = implementation found via the pre-EIP-1967 ZeppelinOS slot
  // (keccak256("org.zeppelinos.proxy.implementation")), e.g. USDC.
  kind: "eip1967" | "beacon" | "legacy";
  proxyAddress: string;
  implementationAddress: string;
  adminAddress?: string;
  beaconAddress?: string;
}

export interface Eip1967ProxyInfoResponse {
  isProxy: boolean;
  proxyInfo?: Eip1967ProxyInfo;
  message?: string;
}

export function proxyKindLabel(kind: Eip1967ProxyInfo["kind"]): string {
  switch (kind) {
    case "beacon":
      return "EIP-1967 beacon proxy";
    case "legacy":
      return "Legacy upgradeable proxy (pre-EIP-1967 slots)";
    default:
      return "EIP-1967 proxy";
  }
}
