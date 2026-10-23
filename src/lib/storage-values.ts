// Fetches raw 32-byte storage slot values for a contract from the chain.
// Slots are passed through as opaque decimal/hex strings and echoed back as
// keys, so callers can pass either plain slot indices or keccak256-derived
// pointers (used to resolve long-form dynamic bytes/string data).
export async function fetchStorageValues(
  chainId: number,
  address: string,
  slots: string[],
): Promise<Record<string, string>> {
  if (slots.length === 0) return {};

  const response = await fetch("/api/get_storage_values", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chainId, address, slots }),
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(json.message ?? "Failed to fetch storage values.");
  }
  return json.values as Record<string, string>;
}
