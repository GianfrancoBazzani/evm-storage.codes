export interface Eip1967ProxyInfo {
  kind: "eip1967" | "beacon";
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
