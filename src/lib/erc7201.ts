import { keccak256 } from "viem";
import { Buffer } from "buffer";

// The formula identified by erc7201 is defined as erc7201(id: string) = keccak256(keccak256(id) - 1) & ~0xff.
export function erc7201(id: string): `0x${string}` {
  const hash1 = keccak256(Buffer.from(id, "utf8"));
  const v1 = BigInt(hash1) - 1n;
  // Convert v1 to a 256-bit hex string (64 hex digits) then to a Buffer
  const v1Hex = v1.toString(16).padStart(64, "0");
  const hash2 = keccak256(Buffer.from(v1Hex, "hex"));
  // Mask off the low 8 bits and pad to 32 bytes (64 hex characters)
  const v2 = BigInt(hash2) & ~0xffn;
  const padded = v2.toString(16).padStart(64, "0");
  return `0x${padded}` as `0x${string}`;
}

/**
 * Derives the absolute base slot for a `@custom:storage-location` namespace
 * key, e.g. "erc7201:example.main". Only the erc7201 formula is supported;
 * the id portion (which may itself contain colons) is fed to erc7201().
 * Returns undefined for any other formula prefix so callers can omit the
 * value instead of deriving a meaningless one.
 */
export function deriveNamespaceBaseSlot(
  namespaceKey: string
): `0x${string}` | undefined {
  const prefix = "erc7201:";
  if (!namespaceKey.startsWith(prefix)) return undefined;
  const id = namespaceKey.slice(prefix.length);
  return id.length > 0 ? erc7201(id) : undefined;
}
