import type { StorageLayout, StorageItem } from "@openzeppelin/upgrades-core";
import { erc7201 } from "@/lib/erc7201";

// Runtime type entries carry untyped solc fields (encoding, key, value, base)
// that the OZ TypeItem interface doesn't declare. We preserve them verbatim.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawTypes = Record<string, Record<string, any>>;

export type LayoutEntry = {
  contractName: string;
  chainId: number | undefined;
  address: string | undefined;
  storageLayout: StorageLayout;
};

type SingleOpts = {
  mode: "full" | "tab";
  contractName: string;
  chainId: number | undefined;
  address: string | undefined;
  storageLayout: StorageLayout;
  activeTab: string;
};

type AllOpts = {
  mode: "all";
  layouts: LayoutEntry[];
};

export function slimStorageItems(items: StorageItem[]) {
  return items.map((item) => {
    const copy: Record<string, unknown> = { ...item };
    delete copy.astId;
    delete copy.src;
    return copy;
  });
}

export function pickReferencedTypes(
  items: StorageItem[],
  allTypes: RawTypes,
): RawTypes {
  const out: RawTypes = {};
  const seen = new Set<string>();
  const queue: string[] = items.map((i) => i.type);

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const t = allTypes[id];
    if (!t) continue;
    out[id] = t;
    if (Array.isArray(t.members)) {
      for (const m of t.members) {
        if (m && typeof m.type === "string") queue.push(m.type);
      }
    }
    for (const k of ["underlying", "key", "value", "base"] as const) {
      const v = t[k];
      if (typeof v === "string" && allTypes[v]) queue.push(v);
    }
  }
  return out;
}

function omitUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const k in obj) {
    if (obj[k] !== undefined) out[k] = obj[k];
  }
  return out;
}

function buildWrapper(
  entry: LayoutEntry,
  mode: "full" | "tab",
  activeTab: string,
): Record<string, unknown> {
  const { contractName, chainId, address, storageLayout } = entry;
  const allTypes = (storageLayout.types ?? {}) as RawTypes;

  if (mode === "full") {
    const rootItems = slimStorageItems(storageLayout.storage ?? []);
    const namespacesRaw = storageLayout.namespaces;
    const namespaces = namespacesRaw
      ? Object.fromEntries(
          Object.entries(namespacesRaw).map(([k, v]) => [k, slimStorageItems(v)]),
        )
      : undefined;

    // Union all items so the types dict stays minimal but complete.
    const allItems: StorageItem[] = [
      ...(storageLayout.storage ?? []),
      ...Object.values(storageLayout.namespaces ?? {}).flat(),
    ];
    const types = pickReferencedTypes(allItems, allTypes);

    return omitUndefined({
      contractName,
      chainId,
      address,
      solcVersion: storageLayout.solcVersion,
      layoutVersion: storageLayout.layoutVersion,
      baseSlot: storageLayout.baseSlot,
      storage: rootItems,
      types,
      namespaces,
    });
  }

  // mode === "tab"
  const isRoot = activeTab === "Root layout";
  const rawItems = isRoot
    ? storageLayout.storage ?? []
    : storageLayout.namespaces?.[activeTab] ?? [];
  const items = slimStorageItems(rawItems);
  const types = pickReferencedTypes(rawItems, allTypes);

  // For namespace tabs, derive baseSlot from the ERC-7201 id portion.
  // The namespace name follows the convention "erc7201:<id>".
  let baseSlot: string | undefined = storageLayout.baseSlot;
  let namespace: string | undefined;
  if (!isRoot) {
    namespace = activeTab;
    const idPart = activeTab.split(":")[1];
    if (idPart) baseSlot = erc7201(idPart);
  }

  return omitUndefined({
    contractName,
    chainId,
    address,
    solcVersion: storageLayout.solcVersion,
    layoutVersion: storageLayout.layoutVersion,
    namespace,
    baseSlot,
    storage: items,
    types,
  });
}

export function buildExport(opts: SingleOpts | AllOpts): string {
  if (opts.mode === "all") {
    const contracts = opts.layouts.map((l) => buildWrapper(l, "full", "Root layout"));
    return JSON.stringify({ contracts }, null, 2);
  }

  const entry: LayoutEntry = {
    contractName: opts.contractName,
    chainId: opts.chainId,
    address: opts.address,
    storageLayout: opts.storageLayout,
  };
  const wrapper = buildWrapper(entry, opts.mode, opts.activeTab);
  return JSON.stringify(wrapper, null, 2);
}
