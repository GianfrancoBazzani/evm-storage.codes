import { Fragment, useContext, useEffect, useMemo, useState } from "react";
import { Code2, Code, Share, X, Cross, TriangleAlert, Braces } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { StorageLayoutsContext } from "@/contexts/StorageLayoutsContext";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import UploadWizardButton from "@/components/UploadWizardButton";
import AnalyzeWizardButton from "@/components/AnalyzeWizardButton";
import ComparisonWizardButton from "@/components/ComparisonWizardButton";
import ColorHash from "color-hash";
import { normalizeUint256Literal } from "@/lib/integer-literals";
import { deriveNamespaceBaseSlot } from "@/lib/erc7201";
import { buildExport } from "@/lib/storage-layout-export";
import { useCopyFeedback } from "@/hooks/use-copy-feedback";
import {
  ROOT_LAYOUT_TAB,
  MAX_CONTIGUOUS_ITEM_SLOT_ROWS,
} from "@/lib/constants";

import type {
  StorageLayout,
  StorageItem,
  TypeItem,
  TypeItemMembers,
  StructMember,
} from "@openzeppelin/upgrades-core";
import { proxyKindLabel } from "@/lib/eip1967";
import type { Eip1967ProxyInfo } from "@/lib/eip1967";
import { fetchStorageValues } from "@/lib/storage-values";
import { resolveStorageValue } from "@/lib/decode-storage-value";
import type { DecodedValue, RawTypes } from "@/lib/decode-storage-value";

const SLOT_ZERO =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

const truncateAddress = (value: string) =>
  `${value.slice(0, 10)}...${value.slice(-8)}`;

const storageLayoutScopeIds = new WeakMap<StorageLayout, number>();
let nextStorageLayoutScopeId = 0;

function getStorageLayoutScopeId(storageLayout: StorageLayout) {
  let id = storageLayoutScopeIds.get(storageLayout);
  if (id === undefined) {
    id = nextStorageLayoutScopeId;
    nextStorageLayoutScopeId += 1;
    storageLayoutScopeIds.set(storageLayout, id);
  }
  return id;
}

// A type's `members` is either struct fields or enum value names (plain
// strings) - only the former has its own slot/offset layout to unwrap.
function isStructMembers(members: TypeItemMembers): members is StructMember[] {
  return members.length === 0 || typeof members[0] !== "string";
}

// Replaces struct-typed items with one synthetic item per field (dot-joined
// label, e.g. "testStorage.a") so struct internals display the same way as
// top-level variables instead of one opaque blob. Recurses for nested
// structs. Arrays of structs and mappings are left as-is: their members
// don't have static slots to unwrap this way.
function unwrapStructItems(
  items: StorageItem[],
  types: Record<string, TypeItem>
): StorageItem[] {
  const result: StorageItem[] = [];
  for (const item of items) {
    const members = types[item.type]?.members;
    if (members && isStructMembers(members)) {
      const fieldItems: StorageItem[] = members.map((member) => ({
        astId: item.astId,
        contract: item.contract,
        label: `${item.label}.${member.label}`,
        type: member.type,
        src: item.src,
        offset: member.offset,
        slot: (BigInt(item.slot ?? 0) + BigInt(member.slot ?? 0)).toString(),
      }));
      result.push(...unwrapStructItems(fieldItems, types));
    } else {
      result.push(item);
    }
  }
  return result;
}

// Interface for ItemWrapper to add additional visualization properties
interface ItemWrapper {
  item: StorageItem;
  color: string;
  width: number;
  offset: number;
  // Byte-precision counterparts of width/offset (which are percentages, for
  // CSS) - needed to fetch and decode this segment's on-chain value.
  widthBytes: number;
  offsetBytes: number;
  // How many bytes of the item's *own* value were already shown by earlier
  // rows (0 unless this is a continuation row of a multi-slot item). Lets a
  // fixed-array row figure out which element indices its bytes cover.
  byteRangeStart: number;
}

// A single displayed row. Usually one row is one slot (label is that slot
// number), but an item spanning more than MAX_CONTIGUOUS_ITEM_SLOT_ROWS
// slots (e.g. a large __gap array) is collapsed into one row covering the
// whole range instead of one row per slot it occupies.
interface SlotRow {
  items: ItemWrapper[];
  label: string;
  // Relative starting slot this row represents, and how many slots it spans
  // (>1 only for a collapsed row) - used to compute the absolute on-chain
  // slot to read when a segment is clicked.
  slotIndex: number;
  slotSpan: number;
}

interface StorageLayoutWrapper {
  slots: SlotRow[];
  name: string;
  baseSlot: string | undefined;
}

// Function to analyze the storage layout and build the wrapper object ot be consumed by the visualizer
function getStorageLayoutWrapper(
  storageItems: StorageItem[],
  storageLayout: StorageLayout,
  name: string,
  baseSlot: string | undefined,
  isNamespace: boolean
): StorageLayoutWrapper {
  // Unwrap struct fields so they display individually instead of as one
  // opaque blob spanning the struct's full size.
  storageItems = unwrapStructItems(storageItems, storageLayout.types);

  // Normalize baseSlot if is custom
  if (!isNamespace && baseSlot && baseSlot !== SLOT_ZERO) {
    const storageItemsNormalized = JSON.parse(JSON.stringify(storageItems));
    for (let i = 0; i < storageItemsNormalized.length; i++) {
      storageItemsNormalized[i].slot = (
        BigInt(normalizeUint256Literal(storageItemsNormalized[i].slot)) -
        BigInt(baseSlot)
      ).toString();
    }
    storageItems = storageItemsNormalized;
  }

  // Build astIdToColor object
  const colorHash = new ColorHash();
  const idToColor: { [key: string]: string } = {};
  storageItems.forEach((item) => {
    idToColor[`${item.contract}:${item.label}`] = colorHash.hex(item.label);
  });

  let maxSlot = 0;
  const slots: Array<SlotRow> = [];
  if (storageItems.length > 0) {
    // Set maxSlot
    maxSlot = Number(
      storageItems
        .map((storageItem) => storageItem.slot)
        .reduce((previousValue, currentValue) =>
          Number(previousValue) >= Number(currentValue)
            ? previousValue
            : currentValue
        )
    );
    // Extend max Slot if there is an overflow in the "last" slot
    const lastSlotTypeNumberOfBytes = Number(
      storageLayout?.types[storageItems.slice(-1)[0].type].numberOfBytes
    );
    if (lastSlotTypeNumberOfBytes > 32) {
      maxSlot += Math.ceil(lastSlotTypeNumberOfBytes / 32) - 1;
    }

    // Build slots array. Group items by slot up front: a per-slot filter
    // over all items would make this loop quadratic on large layouts.
    const itemsBySlot = new Map<number, StorageItem[]>();
    for (const item of storageItems) {
      const slot = Number(item.slot);
      const group = itemsBySlot.get(slot);
      if (group) {
        group.push(item);
      } else {
        itemsBySlot.set(slot, [item]);
      }
    }

    // Tracks, per item, how many bytes of its own value have already been
    // shown by earlier rows - lets a fixed-array row figure out which
    // element indices its own bytes cover. Reset per wrapper build.
    const consumedBytes = new WeakMap<StorageItem, number>();

    let overflowBytes = 0;
    for (let i = 0; i <= maxSlot; i++) {
      // copy: the overflow handling below unshifts into this array
      const slotItems = [...(itemsBySlot.get(i) ?? [])];

      // An item spanning more slots than MAX_CONTIGUOUS_ITEM_SLOT_ROWS
      // (e.g. a large __gap array) is collapsed into a single row instead
      // of one row per slot: rendering thousands of rows/tooltips makes
      // the page unresponsive for no visual benefit, since every one of
      // those rows would look identical anyway.
      if (overflowBytes === 0 && slotItems.length === 1) {
        const itemNumberOfBytes = Number(
          storageLayout?.types[slotItems[0].type].numberOfBytes
        );
        const itemSlotSpan = Math.ceil(itemNumberOfBytes / 32);
        if (itemSlotSpan > MAX_CONTIGUOUS_ITEM_SLOT_ROWS) {
          const item = slotItems[0];
          const endSlot = i + itemSlotSpan - 1;
          slots.push({
            items: [
              {
                item,
                color: idToColor[`${item.contract}:${item.label}`],
                width: 100,
                offset: 0,
                widthBytes: Math.min(itemNumberOfBytes, 32),
                offsetBytes: 0,
                byteRangeStart: 0,
              },
            ],
            label: `${i}–${endSlot}`,
            slotIndex: i,
            slotSpan: itemSlotSpan,
          });
          i = endSlot;
          continue;
        }
      }

      // if previous slot is overflown
      if (overflowBytes > 0) {
        slotItems?.unshift(slots[slots.length - 1].items.slice(-1)[0].item);
      }
      // compute bytes used by storage objects in the slot it can overflow
      let bytesUsed = overflowBytes;
      slotItems?.forEach(
        (item) =>
          (bytesUsed += Number(storageLayout?.types[item.type].numberOfBytes))
      );
      // Wrap slot Items
      const slotItemsWrapped: ItemWrapper[] = slotItems
        ? slotItems?.map((item, index) => {
            let width: number = Number(
              storageLayout?.types[item.type].numberOfBytes
            );
            if (index === 0 && overflowBytes > 0) {
              if (overflowBytes >= 32) {
                width = 32;
              } else {
                width = overflowBytes;
              }
            }
            if (width > 32) {
              width = 32;
            }
            const offsetBytes = Number(item.offset);
            const byteRangeStart = consumedBytes.get(item) ?? 0;
            consumedBytes.set(item, byteRangeStart + width);
            const wrappedItem: ItemWrapper = {
              item: item,
              color: idToColor[`${item.contract}:${item.label}`],
              width: Number(width) * 3.125, // 100%/32Bytes = 3.125
              offset: offsetBytes * 3.125, // 100%/32Bytes = 3.125
              widthBytes: width,
              offsetBytes,
              byteRangeStart,
            };
            return wrappedItem;
          })
        : [];
      // Set next overflow value
      if (overflowBytes >= 32) {
        overflowBytes -= 32;
      } else if (bytesUsed >= 32) {
        overflowBytes = bytesUsed - 32;
      } else {
        overflowBytes = 0;
      }
      slots.push({ items: slotItemsWrapped, label: String(i), slotIndex: i, slotSpan: 1 });
    }
  }
  return {
    slots: slots,
    name: name,
    baseSlot: baseSlot,
  };
}

export interface StorageVisualizerProps {
  contractName: string;
  id: number;
  storageLayout: StorageLayout;
  chainId: number | undefined;
  address: string | undefined;
  sourceAddress?: string;
  proxyInfo?: Eip1967ProxyInfo;
}

export default function StorageVisualizer({
  contractName,
  id,
  storageLayout,
  chainId,
  address,
  sourceAddress,
  proxyInfo,
}: StorageVisualizerProps) {
  // Global context
  const storageLayoutsContext = useContext(StorageLayoutsContext);
  if (!storageLayoutsContext) {
    throw new Error("StorageLayoutsContext is undefined");
  }
  const { storageLayouts: allLayouts, setStorageLayouts } = storageLayoutsContext;

  // Parent dialog controlled state
  const [isAddContractDialogOpen, setAddContractDialogOpen] = useState(false);

  // "Copied!"/"Copy failed" tooltip feedback for the share and copy-JSON buttons
  const shareCopy = useCopyFeedback();
  const layoutCopy = useCopyFeedback();

  // Copy-JSON popover + controlled Tabs
  const [layoutPopoverOpen, setLayoutPopoverOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState<string>(ROOT_LAYOUT_TAB);
  // App keys visualizers by index, so on close/insert this instance can be
  // adopted by a different contract whose layout lacks the remembered
  // namespace tab — fall back to the root tab instead of rendering an
  // unmatched Tabs value and exporting a nonexistent slice.
  const activeTab =
    selectedTab === ROOT_LAYOUT_TAB || storageLayout.namespaces?.[selectedTab]
      ? selectedTab
      : ROOT_LAYOUT_TAB;
  const valueScopeKey = `${getStorageLayoutScopeId(storageLayout)}|${
    chainId ?? "local"
  }|${address ?? ""}`;

  function handleCopyJson(mode: "full" | "tab" | "all") {
    // Optimistic feedback: the tooltip must already read "Copied!" when the
    // popover closes (see useCopyFeedback); an export or clipboard failure
    // downgrades it to "Copy failed".
    void layoutCopy.copy(
      () =>
        mode === "all"
          ? buildExport({ mode: "all", layouts: allLayouts })
          : buildExport({
              mode,
              contractName,
              chainId,
              address,
              sourceAddress,
              proxyInfo,
              storageLayout,
              namespace:
                activeTab === ROOT_LAYOUT_TAB ? undefined : activeTab,
            }),
      { optimistic: true }
    );
    setLayoutPopoverOpen(false);
  }

  // Close Visualizer
  function handleClose() {
    setStorageLayouts((prevLayouts) => {
      const newLayouts = prevLayouts.filter((layout) => layout.id !== id);
      for (let i = 0; i < newLayouts.length; i++) {
        newLayouts[i].id = i;
      }
      return newLayouts;
    });
  }

  // Clicking a slot segment expands an inline block showing its on-chain
  // value (fetched on demand, only for the clicked slot). Hovering still
  // shows the plain type|label tooltip, unaffected by any of this - each
  // item's key is LayoutName|TypeLabel|ItemLabel|RowIndex|ItemIndex.
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  type ValueFetchState =
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "unavailable"; message: string }
    | { status: "loaded"; rawSlotHex: string; decoded: DecodedValue | DecodedValue[] };
  const [valueState, setValueState] = useState<Record<string, ValueFetchState>>({});

  useEffect(() => {
    setExpandedItems(new Set());
    setValueState({});
  }, [valueScopeKey]);

  function itemKeyFor(
    layoutName: string,
    item: ItemWrapper,
    rowIndex: number,
    itemIndex: number
  ) {
    return `${valueScopeKey}|${layoutName}|${storageLayout.types[item.item.type].label}|${item.item.label}|${rowIndex}|${itemIndex}`;
  }

  function handleToggleExpand(
    itemKey: string,
    row: SlotRow,
    item: ItemWrapper,
    layout: StorageLayoutWrapper
  ) {
    const wasExpanded = expandedItems.has(itemKey);
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (wasExpanded) {
        next.delete(itemKey);
      } else {
        next.add(itemKey);
      }
      return next;
    });
    if (wasExpanded || valueState[itemKey]) return;

    if (chainId === undefined || address === undefined) {
      setValueState((prev) => ({
        ...prev,
        [itemKey]: {
          status: "unavailable",
          message: "No on-chain address associated with this layout.",
        },
      }));
      return;
    }
    if (row.slotSpan > 1) {
      setValueState((prev) => ({
        ...prev,
        [itemKey]: {
          status: "unavailable",
          message: "Collapsed multi-slot range — values are not resolved.",
        },
      }));
      return;
    }

    setValueState((prev) => ({ ...prev, [itemKey]: { status: "loading" } }));
    void (async () => {
      try {
        const baseSlot = layout.baseSlot ? BigInt(layout.baseSlot) : 0n;
        const absoluteSlot = baseSlot + BigInt(row.slotIndex);
        const slotKey = absoluteSlot.toString();
        const values = await fetchStorageValues(chainId, address, [slotKey]);
        const rawSlotHex = values[slotKey];
        if (rawSlotHex === undefined) {
          throw new Error("No value returned for this slot.");
        }
        const types = storageLayout.types as unknown as RawTypes;
        const type = types[item.item.type];
        const decoded = await resolveStorageValue(
          type,
          types,
          item.offsetBytes,
          item.widthBytes,
          item.byteRangeStart,
          absoluteSlot,
          rawSlotHex,
          (slots) => fetchStorageValues(chainId, address, slots)
        );
        setValueState((prev) => ({
          ...prev,
          [itemKey]: { status: "loaded", rawSlotHex, decoded },
        }));
      } catch (error) {
        setValueState((prev) => ({
          ...prev,
          [itemKey]: {
            status: "error",
            message: error instanceof Error ? error.message : "Failed to fetch value.",
          },
        }));
      }
    })();
  }

  function renderValueBlock(state: ValueFetchState | undefined) {
    if (!state) return null;
    if (state.status === "loading") {
      return <span className="text-green-500/70 italic">Fetching…</span>;
    }
    if (state.status === "error") {
      return <span className="text-red-400">Error: {state.message}</span>;
    }
    if (state.status === "unavailable") {
      return <span className="text-green-500/50 italic">{state.message}</span>;
    }
    const decoded = state.decoded;
    return (
      <div className="flex flex-col gap-0.5">
        <div className="font-mono break-all text-green-500/80">
          hex: {state.rawSlotHex}
        </div>
        {Array.isArray(decoded) ? (
          decoded.map((element) => (
            <div key={element.index}>
              <span className="text-green-500/70">[{element.index}]</span>{" "}
              <span className="font-mono">{element.display}</span>
              {element.note && (
                <span className="text-green-500/50 italic ml-1">{element.note}</span>
              )}
            </div>
          ))
        ) : (
          <div>
            <span className="font-mono">{decoded.display}</span>
            {decoded.note && (
              <span className="text-green-500/50 italic ml-1">{decoded.note}</span>
            )}
          </div>
        )}
      </div>
    );
  }

  // Build the per-tab wrapper array once per layout: controlled Tabs and
  // tooltip state make every click/hover re-render this component, and the
  // wrapper computation (struct unwrapping, per-slot scans) is too heavy to
  // redo each time.
  const storageLayouts = useMemo(() => {
    // normalizeUint256Literal returns the zero slot for an absent literal
    const baseSlotNormalized = normalizeUint256Literal(storageLayout.baseSlot);

    // Root layout
    const wrappers: StorageLayoutWrapper[] = [
      getStorageLayoutWrapper(
        storageLayout.storage,
        storageLayout,
        ROOT_LAYOUT_TAB,
        baseSlotNormalized,
        false
      ),
    ];

    // ERC-7201 namespaces
    for (const [namespaceName, items] of Object.entries(
      storageLayout.namespaces ?? {}
    )) {
      wrappers.push(
        getStorageLayoutWrapper(
          items,
          storageLayout,
          namespaceName,
          deriveNamespaceBaseSlot(namespaceName),
          true
        )
      );
    }
    return wrappers;
  }, [storageLayout]);

  const sourcifyAddress = sourceAddress ?? address;

  return (
    <Card className="bg-black border-green-500 md:mb-4 overflow-hidden relative py-0 gap-0 h-full w-full transition-all duration-500 ease-in-out">
      {/* Upper Bar */}
      <div className="flex max-w-full justify-between items-center p-2 border-b border-green-500/50 bg-green-900/20">
        <div className="flex max-w-full truncate items-center gap-2">
          <Code2 className="text-green-500 h-4 w-4" />
          <span className="text-green-500 text-sm font-bold">
            {chainId !== undefined && address !== undefined
              ? `${contractName} (${
                  proxyInfo
                    ? `Proxy: ${truncateAddress(address)} | Impl: ${truncateAddress(proxyInfo.implementationAddress)}`
                    : `Addr: ${truncateAddress(address)}`
                } | Chain Id: ${chainId})`
              : contractName}
          </span>
        </div>
        <div className="flex gap-2">
          {chainId !== undefined && address !== undefined && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      window.open(
                        `https://repo.sourcify.dev/${chainId.toString()}/${sourcifyAddress}`,
                        "_blank"
                      )
                    }
                    className="h-6 w-6 text-green-500 hover:bg-green-900/30 hover:text-green-500 hover:rounded"
                  >
                    <Code className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="bg-black border-green-500 border text-green-500 px-3 py-1 rounded-md shadow-md text-xs transition-colors duration-200">
                  {proxyInfo
                    ? "View implementation code on Sourcify.eth"
                    : "View code on Sourcify.eth"}
                </TooltipContent>
              </Tooltip>

              <Tooltip {...shareCopy.tooltipProps}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      void shareCopy.copy(
                        () =>
                          `${window.location.origin}/?address=${address}&chainId=${chainId}`
                      );
                    }}
                    className="h-6 w-6 text-green-500 hover:bg-green-900/30 hover:text-green-500 hover:rounded"
                  >
                    <Share className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="bg-black border-green-500 border text-green-500 px-3 py-1 rounded-md shadow-md text-xs transition-colors duration-200">
                  {shareCopy.label("Share")}
                </TooltipContent>
              </Tooltip>
            </>
          )}
          <Popover open={layoutPopoverOpen} onOpenChange={setLayoutPopoverOpen}>
            <Tooltip {...layoutCopy.tooltipProps}>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-green-500 hover:bg-green-900/30 hover:text-green-500 hover:rounded"
                  >
                    <Braces className="h-3 w-3" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent className="bg-black border-green-500 border text-green-500 px-3 py-1 rounded-md shadow-md text-xs transition-colors duration-200">
                {layoutCopy.label("Copy Storage Layout")}
              </TooltipContent>
            </Tooltip>
            <PopoverContent
              align="end"
              className="bg-black border-green-500 border text-green-500 p-1 rounded-md shadow-md text-xs w-56"
            >
              <div className="flex flex-col">
                <Button
                  variant="ghost"
                  onClick={() => handleCopyJson("full")}
                  className="w-full justify-start h-8 text-xs text-green-500 hover:bg-green-900/30 hover:text-green-500"
                >
                  Copy full layout
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => handleCopyJson("tab")}
                  className="w-full justify-start h-8 text-xs text-green-500 hover:bg-green-900/30 hover:text-green-500"
                >
                  <span className="truncate max-w-[180px]">
                    Copy current tab ({activeTab})
                  </span>
                </Button>
                {allLayouts.length >= 2 && (
                  <Button
                    variant="ghost"
                    onClick={() => handleCopyJson("all")}
                    className="w-full justify-start h-8 text-xs text-green-500 hover:bg-green-900/30 hover:text-green-500"
                  >
                    Copy all open contracts
                  </Button>
                )}
              </div>
            </PopoverContent>
          </Popover>
          <ComparisonWizardButton />

          {/* Add Contract Dialog */}
          <Dialog
            open={isAddContractDialogOpen}
            onOpenChange={setAddContractDialogOpen}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-green-500 hover:bg-green-900/30 hover:text-green-500 hover:rounded"
                  >
                    <Cross className="h-3 w-3" />
                  </Button>
                </DialogTrigger>
              </TooltipTrigger>
              <TooltipContent className="bg-black border-green-500 border text-green-500 px-3 py-1 rounded-md shadow-md text-xs transition-colors duration-200">
                Add Contract
              </TooltipContent>
            </Tooltip>
            <DialogContent
              onCloseAutoFocus={(e) => e.preventDefault()}
              className="flex flex-col md:max-w-xl bg-black border-green-500 p-6 rounded-md"
            >
              <DialogHeader>
                <DialogTitle className="text-green-500">
                  Choose Contract Source
                </DialogTitle>
                <DialogDescription
                  id="upload-dialog-description"
                  className="text-green-700"
                >
                  Choose the origin of the contract sources for analysis.
                </DialogDescription>
              </DialogHeader>
              <div className="mt-6 mb-6 flex flex-col sm:flex-row items-center justify-center gap-4">
                <UploadWizardButton
                  setParentDialogOpen={setAddContractDialogOpen}
                  triggerVisualizerId={id}
                />
                <AnalyzeWizardButton
                  setParentDialogOpen={setAddContractDialogOpen}
                  triggerVisualizerId={id}
                />
              </div>
            </DialogContent>
          </Dialog>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClose}
                className="h-6 w-6 text-green-500 hover:bg-green-900/30 hover:text-green-500 hover:rounded"
              >
                <X className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-black border-green-500 border text-green-500  px-3 py-1 rounded-md shadow-md text-xs transition-colors duration-200">
              Close
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {proxyInfo && (
        <div className="border-b border-green-500/30 bg-green-900/10 px-4 py-2 text-[11px] text-green-500">
          <span className="font-bold">
            {proxyKindLabel(proxyInfo.kind)} detected.
          </span>{" "}
          <span>Proxy storage: {truncateAddress(proxyInfo.proxyAddress)}</span>
          <span className="mx-2">|</span>
          <span>
            Implementation layout:{" "}
            {truncateAddress(proxyInfo.implementationAddress)}
          </span>
          {proxyInfo.beaconAddress && (
            <>
              <span className="mx-2">|</span>
              <span>Beacon: {truncateAddress(proxyInfo.beaconAddress)}</span>
            </>
          )}
          {proxyInfo.adminAddress && (
            <>
              <span className="mx-2">|</span>
              <span>Admin: {truncateAddress(proxyInfo.adminAddress)}</span>
            </>
          )}
        </div>
      )}

      {/* Tabs*/}
      <Tabs value={activeTab} onValueChange={setSelectedTab} className="w-full">
        <div
          className="border-b border-green-500/30 bg-green-900/10 overflow-x-auto
                  minimal-h-scrollbar-green
          [&::-webkit-scrollbar]:h-1.5
          [&::-webkit-scrollbar-track]:bg-transparent
          [&::-webkit-scrollbar-thumb]:bg-green-500
          hover:[&::-webkit-scrollbar-thumb]:bg-green-600 
          [&::-webkit-scrollbar-thumb]:rounded-sm
        "
        >
          <TabsList className="bg-transparent h-9 flex items-center whitespace-nowrap">
            {storageLayouts.map((layout) => (
              <Fragment key={layout.name}>
                <TabsTrigger
                  value={layout.name}
                  className="text-green-500 data-[state=active]:bg-green-900/30 data-[state=active]:text-green-500 data-[state=active]:shadow-none rounded-none border-r"
                >
                  {layout.name}
                </TabsTrigger>
                <div className="w-px h-6 bg-green-500 mx-2 self-center" />
              </Fragment>
            ))}
          </TabsList>
        </div>

        {/*Content */}
        {storageLayouts.map((layout, index) => (
          <TabsContent key={layout.name} value={layout.name} className="mt-0">
            {layout.baseSlot !== undefined && (
              <div className="px-4 pb-2 text-green-500 text-[8px] md:text-[11px]">
                base slot: {layout.baseSlot}
              </div>
            )}
            {layout.slots.length === 0 && (
              <div className="flex flex-col items-center gap-1 px-4 pb-2 my-5 text-green-500">
                <div className="flex items-center justify-center gap-2">
                  <TriangleAlert className="h-4 w-4" />
                  <span className="text-center">
                    {layout.name} has no storage items defined.
                  </span>
                </div>
                <span className="text-center text-green-500/60 text-xs">
                  The contract may only use constants/immutables, or keep its
                  state in unstructured storage (manually computed slots),
                  which the compiler's storage layout cannot describe.
                </span>
              </div>
            )}
            <div
              key={index}
              className=" px-4 pb-4 overflow-x-auto text-green-500 text-sm leading-relaxed"
            >
              {layout.slots.map((row, rowIndex) => {
                const expandedInRow = row.items
                  .map((item, itemIndex) => ({ item, itemIndex }))
                  .filter(({ item, itemIndex }) =>
                    expandedItems.has(itemKeyFor(layout.name, item, rowIndex, itemIndex))
                  );
                return (
                  <div key={rowIndex} className="flex flex-col my-0.5">
                    <div className="flex flex-row">
                      <div className="min-w-5 shrink-0 pr-1 text-[11px]">
                        {row.label}
                      </div>
                      <div className=" h-[1.2rem] w-full relative ">
                        {row.items.map((item, itemIndex) => {
                          // Include the row/segment position in the key: an
                          // item spanning multiple slots (e.g. uint256[80])
                          // repeats the same label/type on every row it
                          // occupies, so without this each segment would
                          // share one state and all expand together.
                          const itemKey = itemKeyFor(layout.name, item, rowIndex, itemIndex);
                          return (
                            <div key={itemIndex} className=" flex flex-col">
                              <Tooltip>
                                <TooltipTrigger
                                  asChild
                                  onClick={() =>
                                    handleToggleExpand(itemKey, row, item, layout)
                                  }
                                >
                                  <div
                                    style={{
                                      width: `${item.width}%`,
                                      left: `${item.offset}%`,
                                      backgroundColor: item.color,
                                    }}
                                    className="h-full absolute border border-green-500 cursor-pointer"
                                  />
                                </TooltipTrigger>
                                <TooltipContent className="bg-black border-green-500 border text-green-500 px-3 py-1 rounded-md shadow-md text-xs transition-colors duration-200">
                                  <span>
                                    {`${
                                      storageLayout?.types[item.item.type].label
                                    } | ${item.item.label}`}
                                  </span>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          );
                        })}
                      </div>
                      <div className="h-[2px]" />
                    </div>
                    {expandedInRow.length > 0 && (
                      <div className="ml-5 flex flex-col gap-1 pb-1 text-[10px] md:text-[11px]">
                        {expandedInRow.map(({ item, itemIndex }) => {
                          const itemKey = itemKeyFor(layout.name, item, rowIndex, itemIndex);
                          return (
                            <div
                              key={itemIndex}
                              className="border border-green-500/30 rounded bg-green-950/20 px-2 py-1"
                            >
                              <div className="text-green-500/70">
                                {storageLayout.types[item.item.type].label} ·{" "}
                                {item.item.label}
                              </div>
                              {renderValueBlock(valueState[itemKey])}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </Card>
  );
}
