import type { StorageLayout, StorageItem } from "@openzeppelin/upgrades-core";
import { deriveNamespaceBaseSlot } from "@/lib/erc7201";
import { normalizeUint256Literal } from "@/lib/integer-literals";
import type { Eip1967ProxyInfo } from "@/lib/eip1967";

const EXPORT_SCHEMA_VERSION = "evm-storage.codes/storage-layout-export@1";
const JSON_INDENT_SPACES = 2;

// Runtime type entries carry untyped solc fields (encoding, key, value, base)
// that the OZ TypeItem interface doesn't declare. We preserve them verbatim.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawTypes = Record<string, Record<string, any>>;

export type LayoutEntry = {
  contractName: string;
  chainId: number | undefined;
  address: string | undefined;
  sourceAddress?: string;
  proxyInfo?: Eip1967ProxyInfo;
  storageLayout: StorageLayout;
};

type SingleOpts = LayoutEntry & {
  mode: "full" | "tab";
  /** Namespace key to export in "tab" mode; undefined means the root slice. */
  namespace?: string;
};

type AllOpts = {
  mode: "all";
  layouts: LayoutEntry[];
};

/**
 * Strips compiler-internal fields from each storage item.
 *
 * Removes `astId` and `src`, which are solc AST pointers
 * (source file, offset, length) that mean nothing to a
 * clipboard consumer. Everything else is preserved verbatim.
 */
export function slimStorageItems(items: StorageItem[]) {
  return items.map((item) => {
    const copy: Record<string, unknown> = { ...item };
    delete copy.astId;
    delete copy.src;
    return copy;
  });
}

/**
 * Returns only the type entries reachable from the given items.
 *
 * The raw `types` dictionary holds every type solc emitted for
 * the whole compilation unit, most of it unreferenced here. This
 * does a breadth-first walk starting from each item's `type`,
 * following struct `members`, plus mapping `key`/`value`, array
 * `base`, and UDVT `underlying`. The result is minimal but
 * complete: every type id any copied item points to resolves.
 */
export function pickReferencedTypes(
  items: StorageItem[],
  allTypes: RawTypes,
): RawTypes {
  const out: RawTypes = {};
  const seen = new Set<string>();
  const queue: string[] = [];
  // Dedup at enqueue time and walk with a cursor: shift() is O(n) per pop,
  // and ubiquitous types (t_uint256, ...) would otherwise enter the queue
  // once per reference.
  const enqueue = (id: string) => {
    if (!seen.has(id)) {
      seen.add(id);
      queue.push(id);
    }
  };
  for (const item of items) enqueue(item.type);

  for (let head = 0; head < queue.length; head++) {
    const id = queue[head];
    const t = allTypes[id];
    if (!t) continue;
    out[id] = t;
    if (Array.isArray(t.members)) {
      for (const m of t.members) {
        if (m && typeof m.type === "string") enqueue(m.type);
      }
    }
    for (const k of ["underlying", "key", "value", "base"] as const) {
      const v = t[k];
      if (typeof v === "string" && allTypes[v]) enqueue(v);
    }
  }
  return out;
}

/**
 * Normalizes the root layout's custom base slot (Solidity 0.8.29+
 * `layout at <literal>`) to the padded hex form the UI displays,
 * or undefined when the layout has none so the field is omitted.
 */
function normalizedRootBaseSlot(
  storageLayout: StorageLayout,
): string | undefined {
  return storageLayout.baseSlot
    ? normalizeUint256Literal(storageLayout.baseSlot)
    : undefined;
}

/**
 * Builds the export object for one contract.
 *
 * In "full" mode it emits the root storage plus every namespace,
 * each namespace tagged with its derived baseSlot, and a single
 * types dictionary covering all of them. In "tab" mode it emits
 * a single slice: the given namespace, or the root storage when
 * `namespace` is undefined.
 */
function buildWrapper(
  entry: LayoutEntry,
  mode: "full" | "tab",
  namespace?: string,
): Record<string, unknown> {
  const {
    contractName,
    chainId,
    address,
    sourceAddress,
    proxyInfo,
    storageLayout,
  } = entry;
  const allTypes = (storageLayout.types ?? {}) as RawTypes;

  if (mode === "full") {
    const rootItems = slimStorageItems(storageLayout.storage ?? []);
    // Extraction always defines `namespaces` ({} when the contract has
    // none), so gate on emptiness, not just presence.
    const namespacesRaw = storageLayout.namespaces;
    const namespaces =
      namespacesRaw && Object.keys(namespacesRaw).length > 0
        ? Object.fromEntries(
            Object.entries(namespacesRaw).map(([k, v]) => [
              k,
              {
                baseSlot: deriveNamespaceBaseSlot(k),
                storage: slimStorageItems(v),
              },
            ]),
          )
        : undefined;

    // Union all items so the types dict stays minimal but complete.
    const allItems: StorageItem[] = [
      ...(storageLayout.storage ?? []),
      ...Object.values(storageLayout.namespaces ?? {}).flat(),
    ];
    const types = pickReferencedTypes(allItems, allTypes);

    return {
      schemaVersion: EXPORT_SCHEMA_VERSION,
      contractName,
      chainId,
      address,
      sourceAddress,
      proxyInfo,
      solcVersion: storageLayout.solcVersion,
      layoutVersion: storageLayout.layoutVersion,
      baseSlot: normalizedRootBaseSlot(storageLayout),
      storage: rootItems,
      types,
      namespaces,
    };
  }

  // mode === "tab": one slice. The root slice carries the layout's own
  // (custom) base slot; a namespace carries only its ERC-7201-derived one,
  // omitted when the key uses some other formula — the root base slot never
  // applies to a namespace.
  let rawItems: StorageItem[];
  let baseSlot: string | undefined;
  if (namespace === undefined) {
    rawItems = storageLayout.storage ?? [];
    baseSlot = normalizedRootBaseSlot(storageLayout);
  } else {
    const namespaceItems = storageLayout.namespaces?.[namespace];
    if (namespaceItems === undefined) {
      throw new Error(`Unknown storage layout namespace: ${namespace}`);
    }
    rawItems = namespaceItems;
    baseSlot = deriveNamespaceBaseSlot(namespace);
  }

  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    contractName,
    chainId,
    address,
    sourceAddress,
    proxyInfo,
    solcVersion: storageLayout.solcVersion,
    layoutVersion: storageLayout.layoutVersion,
    namespace,
    baseSlot,
    storage: slimStorageItems(rawItems),
    types: pickReferencedTypes(rawItems, allTypes),
  };
}

/**
 * Serializes a storage layout to a JSON string for the clipboard.
 *
 * "all" mode wraps every open contract under { contracts: [...] }.
 * "full" and "tab" modes export a single contract, full layout or
 * just the active tab respectively. Every payload carries a
 * schemaVersion so consumers can detect format changes. Optional
 * fields (chainId, address, baseSlot, namespace(s)) are left
 * undefined when absent, which JSON.stringify drops from the output.
 */
export function buildExport(opts: SingleOpts | AllOpts): string {
  if (opts.mode === "all") {
    const contracts = opts.layouts.map((l) => buildWrapper(l, "full"));
    return JSON.stringify(
      { schemaVersion: EXPORT_SCHEMA_VERSION, contracts },
      null,
      JSON_INDENT_SPACES,
    );
  }

  const wrapper = buildWrapper(opts, opts.mode, opts.namespace);
  return JSON.stringify(wrapper, null, JSON_INDENT_SPACES);
}
