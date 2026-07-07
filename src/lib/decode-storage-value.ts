import { concatHex, getAddress, hexToBigInt, keccak256, numberToHex, pad, slice } from "viem";
import type { TypeItem } from "@openzeppelin/upgrades-core";

// Runtime type entries carry untyped solc fields (encoding, key, value,
// base) that the OZ TypeItem interface doesn't declare - see the same
// pattern/comment in storage-layout-export.ts.
export type RawTypeItem = TypeItem & {
  encoding?: "inplace" | "mapping" | "dynamic_array" | "bytes";
  base?: string;
  key?: string;
  value?: string;
};
export type RawTypes = Record<string, RawTypeItem>;

export type DecodedValueKind =
  | "uint"
  | "int"
  | "bool"
  | "address"
  | "bytes-fixed"
  | "string"
  | "bytes-dynamic"
  | "enum"
  | "array-length"
  | "array-element"
  | "unsupported";

export interface DecodedValue {
  kind: DecodedValueKind;
  /** Human-readable rendering, e.g. "42", "true", "0xabc...", "\"hello\"". */
  display: string;
  /** Extra context shown alongside the value, e.g. why it can't be resolved further. */
  note?: string;
  /** Set only for kind "array-element". */
  index?: number;
}

type FetchExtra = (slots: string[]) => Promise<Record<string, string>>;

/**
 * Resolves one storage row's value: decodes what's decodable from the
 * already-fetched `rawSlotHex`, and - only for long-form dynamic
 * bytes/string data, which lives at keccak256(slot) onward rather than in
 * the slot itself - calls `fetchExtra` for the extra slots it needs.
 *
 * `offsetBytes`/`widthBytes` describe the byte range *this row's own slot*
 * contributes (Solidity's own offset convention: 0 = low-order/rightmost
 * end). `byteRangeStart` is how many bytes of the item's *own* value were
 * already shown by earlier rows (0 unless this is a continuation row of a
 * multi-slot item) - it's what lets a fixed-array row figure out which
 * element indices it's showing.
 */
export async function resolveStorageValue(
  type: RawTypeItem,
  types: RawTypes,
  offsetBytes: number,
  widthBytes: number,
  byteRangeStart: number,
  absoluteSlot: bigint,
  rawSlotHex: string,
  fetchExtra: FetchExtra,
): Promise<DecodedValue | DecodedValue[]> {
  switch (type.encoding) {
    case "mapping":
      return {
        kind: "unsupported",
        display: "—",
        note: "Mapping — pick a key to resolve a value.",
      };
    case "dynamic_array": {
      const length = hexToBigInt(rawSlotHex as `0x${string}`);
      return {
        kind: "array-length",
        display: `length: ${length}`,
        note: "Array elements are not resolved.",
      };
    }
    case "bytes":
      return resolveDynamicBytes(type, absoluteSlot, rawSlotHex, fetchExtra);
    case "inplace":
      if (type.label.endsWith("]")) {
        return resolveFixedArray(
          type,
          types,
          offsetBytes,
          widthBytes,
          byteRangeStart,
          absoluteSlot,
          rawSlotHex,
          fetchExtra,
        );
      }
      return decodeInplaceScalar(type, types, offsetBytes, widthBytes, rawSlotHex);
    default:
      return { kind: "unsupported", display: toHexPreview(rawSlotHex) };
  }
}

async function resolveFixedArray(
  type: RawTypeItem,
  types: RawTypes,
  offsetBytes: number,
  widthBytes: number,
  byteRangeStart: number,
  absoluteSlot: bigint,
  rawSlotHex: string,
  fetchExtra: FetchExtra,
): Promise<DecodedValue[] | DecodedValue> {
  const elementType = type.base ? types[type.base] : undefined;
  const elementWidth = Number(elementType?.numberOfBytes ?? 0);

  // Multi-dimensional arrays, arrays of structs, or anything that doesn't
  // cleanly divide into this row's window: not attempted, raw hex only.
  // A struct's `members` are objects (fields); an enum's are plain strings
  // (value names) - only the former makes the element composite.
  const isStructElement =
    Array.isArray(elementType?.members) &&
    elementType.members.length > 0 &&
    typeof elementType.members[0] !== "string";
  const isComposite =
    !elementType ||
    elementWidth <= 0 ||
    elementType.label.endsWith("]") ||
    isStructElement;
  if (
    isComposite ||
    widthBytes % elementWidth !== 0 ||
    byteRangeStart % elementWidth !== 0
  ) {
    return {
      kind: "unsupported",
      display: toHexPreview(rawSlotHex),
      note: "Composite value — individual elements are not resolved.",
    };
  }

  const firstIndex = byteRangeStart / elementWidth;
  const count = widthBytes / elementWidth;
  const results: DecodedValue[] = [];
  for (let p = 0; p < count; p++) {
    const index = firstIndex + p;
    const elementOffset = offsetBytes + p * elementWidth;
    let decoded: DecodedValue;
    if (elementType.encoding === "bytes") {
      // Each element of an array of dynamic bytes/string occupies its own
      // full slot; for a packed slot of *wide* (32-byte) elements this row
      // holds exactly one, so its own absoluteSlot is that element's slot.
      decoded = await resolveDynamicBytes(elementType, absoluteSlot, rawSlotHex, fetchExtra);
    } else {
      decoded = decodeInplaceScalar(elementType, types, elementOffset, elementWidth, rawSlotHex);
    }
    results.push({ ...decoded, kind: "array-element", index });
  }
  return results;
}

function decodeInplaceScalar(
  type: RawTypeItem,
  types: RawTypes,
  offset: number,
  width: number,
  rawSlotHex: string,
): DecodedValue {
  const resolved = type.underlying ? (types[type.underlying] ?? type) : type;
  const label = resolved.label;
  const bytes = extractBytes(rawSlotHex, offset, width);

  if (label === "bool") {
    return { kind: "bool", display: hexToBigInt(bytes) !== 0n ? "true" : "false" };
  }
  if (label === "address" || label.startsWith("contract ")) {
    return { kind: "address", display: getAddress(pad(bytes, { size: 20 })) };
  }
  if (label.startsWith("enum ")) {
    const index = Number(hexToBigInt(bytes));
    const members = resolved.members as string[] | undefined;
    const name = members?.[index];
    return {
      kind: "enum",
      display: name ? `${name} (${index})` : `unknown (${index})`,
    };
  }
  if (/^bytes\d+$/.test(label)) {
    return { kind: "bytes-fixed", display: bytes };
  }
  if (label.startsWith("uint")) {
    return { kind: "uint", display: hexToBigInt(bytes).toString() };
  }
  if (label.startsWith("int")) {
    return { kind: "int", display: decodeSignedInt(bytes, width).toString() };
  }
  return { kind: "unsupported", display: toHexPreview(rawSlotHex) };
}

async function resolveDynamicBytes(
  type: RawTypeItem,
  absoluteSlot: bigint,
  rawSlotHex: string,
  fetchExtra: FetchExtra,
): Promise<DecodedValue> {
  const isString = type.label === "string";
  const kind: DecodedValueKind = isString ? "string" : "bytes-dynamic";
  const raw = BigInt(rawSlotHex);
  const isLongForm = (raw & 1n) === 1n;

  let dataBytes: `0x${string}`;
  if (!isLongForm) {
    // Short form: length is in the last byte (value/2), data is the
    // remaining bytes, left-aligned (from the high-order end) in the slot.
    const length = (raw & 0xffn) / 2n;
    dataBytes = slice(rawSlotHex as `0x${string}`, 0, Number(length));
  } else {
    const length = (raw - 1n) / 2n;
    const slotCount = Number((length + 31n) / 32n);
    const basePointer = hexToBigInt(keccak256(pad(numberToHex(absoluteSlot), { size: 32 })));
    const neededSlots = Array.from({ length: slotCount }, (_, i) => (basePointer + BigInt(i)).toString());
    const extra = await fetchExtra(neededSlots);
    const chunks: `0x${string}`[] = [];
    for (const key of neededSlots) {
      const chunk = extra[key];
      if (chunk === undefined) {
        return {
          kind,
          display: toHexPreview(rawSlotHex),
          note: "Long value — failed to fetch its data slots.",
        };
      }
      chunks.push(chunk as `0x${string}`);
    }
    dataBytes = slice(concatHex(chunks), 0, Number(length));
  }

  if (isString) {
    try {
      const decoded = new TextDecoder("utf-8", { fatal: true }).decode(hexToBytes(dataBytes));
      return { kind, display: JSON.stringify(decoded) };
    } catch {
      return { kind, display: dataBytes, note: "Not valid UTF-8 — showing raw bytes." };
    }
  }
  return { kind, display: dataBytes };
}

function hexToBytes(hex: `0x${string}`): Uint8Array {
  const clean = hex.slice(2);
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

// Storage packs items with offset 0 at the low-order (rightmost) end of the
// 32-byte slot; extract the `width`-byte range for an item at `offset`.
function extractBytes(slotHex: string, offset: number, width: number): `0x${string}` {
  const start = 32 - offset - width;
  return slice(slotHex as `0x${string}`, start, start + width);
}

function decodeSignedInt(bytes: `0x${string}`, width: number): bigint {
  const value = hexToBigInt(bytes);
  const bits = BigInt(width * 8);
  const signBit = 1n << (bits - 1n);
  return value & signBit ? value - (1n << bits) : value;
}

function toHexPreview(hex: string): string {
  return hex.length > 20 ? `${hex.slice(0, 18)}…` : hex;
}
