export const MIN_COMPATIBLE_SOLC_VERSION = "0.5.13";
export const MIN_VIA_IR_VERSION = "0.8.13";
export const MIN_NAMESPACED_COMPATIBLE_SOLC_VERSION = "0.8.20";
export const EVM_VERSIONS = [
  "default",
  "cancun",
  "shanghai",
  "paris",
  "london",
  "berlin",
  "istanbul",
  "petersburg",
  "constantinople",
];
export const BROTLI_QUALITY = 9;
// Storage items (e.g. `__gap` arrays) can legitimately span thousands of
// slots. Rendering one DOM row + tooltip per slot for those makes the page
// unresponsive, so a single item spanning more slots than this is collapsed
// into one summary row instead of one row per slot it occupies.
export const MAX_CONTIGUOUS_ITEM_SLOT_ROWS = 200;
