import { keccak256 } from "viem";
import { Buffer } from "buffer";

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
