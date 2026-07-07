// Bump when the shape of data on-chain value-decoding relies on (currently:
// types[].encoding/base/key/value, merged onto the layout by
// extract_storage_layout.js) changes in a way that makes older cached
// entries unusable for that purpose. get_cached_storage_layout.js compares
// a cached entry's stamped version against this and treats a mismatch (or
// its absence, for entries cached before this existed) as a cache miss, so
// the layout regenerates and re-caches in the current shape instead of
// silently degrading.
export const VALUE_METADATA_VERSION = 1;
