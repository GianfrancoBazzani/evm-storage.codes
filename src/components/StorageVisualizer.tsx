import { useContext, useState } from "react";
import {
  Code,
  Copy,
  X,
  GitCompareArrows,
  Cross,
  TriangleAlert,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { StorageLayoutsContext } from "../App";
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
import ColorHash from "color-hash";
import { normalizeUint256Literal } from "@/lib/integer-literals";
import { erc7201 } from "@/lib/erc7201";

import type { StorageLayout, StorageItem } from "@openzeppelin/upgrades-core";

const SLOT_ZERO =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

export interface StorageVisualizerProps {
  contractName: string;
  id: number;
  storageLayout: StorageLayout;
}

export default function StorageVisualizer({
  contractName,
  id,
  storageLayout,
}: StorageVisualizerProps) {
  // Global context
  const storageLayoutsContext = useContext(StorageLayoutsContext);
  if (!storageLayoutsContext) {
    throw new Error("StorageLayoutsContext is undefined");
  }
  const { setStorageLayouts } = storageLayoutsContext;

  // Parent dialog controlled state
  const [isAddContractDialogOpen, setAddContractDialogOpen] = useState(false);

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

  // Helpers to manage pinnable tooltips, each tooltip stare is tracked in a key-value object where the key is LayoutName|TypeLabel|ItemLabel
  const [pinnedTooltips, setPinnedTooltips] = useState<Record<string, boolean>>(
    {}
  );
  const [visibleTooltips, setVisibleTooltips] = useState<
    Record<string, boolean>
  >({});

  function handlePinTooltip(key: string) {
    const willBePinned = !pinnedTooltips[key];
    setPinnedTooltips((prev) => ({
      ...prev,
      [key]: willBePinned,
    }));
    if (willBePinned) {
      setVisibleTooltips((prev) => ({
        ...prev,
        [key]: true,
      }));
    }
  }

  function handleOpenTooltip(key: string, openFromInteraction: boolean) {
    setVisibleTooltips((prevVisible) => ({
      ...prevVisible,
      [key]: openFromInteraction,
    }));
  }

  // Interface for ItemWrapper to add additional visualization properties
  interface ItemWrapper {
    item: StorageItem;
    color: string;
    width: Number;
    offset: Number;
  }

  interface StorageLayoutWrapper {
    slots: ItemWrapper[][];
    name: string;
    baseSlot: string;
  }

  // Function to analyze the storage layout and build the wrapper object ot be consumed by the visualizer
  function getStorageLayoutWrapper(
    storageItems: StorageItem[],
    storageLayout: StorageLayout,
    name: string = "",
    baseSlot: string,
    isNamespace: boolean = false
  ): StorageLayoutWrapper {
    // Normalize baseSlot if is custom
    if (!isNamespace && baseSlot !== SLOT_ZERO) {
      let storageItemsNormalized = JSON.parse(JSON.stringify(storageItems));
      for (let i = 0; i < storageItemsNormalized.length; i++) {
        storageItemsNormalized[i].slot = (
          BigInt(normalizeUint256Literal(storageItemsNormalized[i].slot)) -
          BigInt(baseSlot)
        ).toString(16);
      }
      storageItems = storageItemsNormalized;
    }

    // Build astIdToColor object
    const colorHash = new ColorHash();
    let idToColor: { [key: string]: string } = {};
    storageItems.forEach((item) => {
      idToColor[`${item.contract}:${item.label}`] = colorHash.hex(item.label);
    });

    let maxSlot = 0;
    let slots: Array<Array<ItemWrapper>> = [];
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
      let lastSlotTypeNumberOfBytes = Number(
        storageLayout?.types[storageItems.slice(-1)[0].type].numberOfBytes
      );
      if (lastSlotTypeNumberOfBytes > 32) {
        maxSlot += Math.ceil(lastSlotTypeNumberOfBytes / 32) - 1;
      }

      // Build slots array
      let overflowBytes = 0;
      for (let i = 0; i <= maxSlot; i++) {
        let slotItems = storageItems.filter((item) => Number(item.slot) === i);
        // if previous slot is overflown
        if (overflowBytes > 0) {
          slotItems?.unshift(slots[i - 1].slice(-1)[0].item);
        }
        // compute bytes used by storage objects in the slot it can overflow
        let bytesUsed = overflowBytes;
        slotItems?.forEach(
          (item) =>
            (bytesUsed += Number(storageLayout?.types[item.type].numberOfBytes))
        );
        // Wrap slot Items
        let slotItemsWrapped: ItemWrapper[] = slotItems
          ? slotItems?.map((item, index) => {
              let width: Number = Number(
                storageLayout?.types[item.type].numberOfBytes
              );
              if (index === 0 && overflowBytes > 0) {
                if (overflowBytes >= 32) {
                  width = 32;
                } else {
                  width = overflowBytes;
                }
              }
              Number(width) > 32 ? (width = 32) : width;
              let wrappedItem: ItemWrapper = {
                item: item,
                color: idToColor[`${item.contract}:${item.label}`],
                width: Number(width) * 3.125, // 100%/32Bytes = 3.125
                offset: Number(item.offset) * 3.125, // 100%/32Bytes = 3.125
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
        slots.push(slotItemsWrapped);
      }
    }
    return {
      slots: slots,
      name: name,
      baseSlot: baseSlot,
    };
  }

  // Get root layout base slot
  let baseSlotNormalized = SLOT_ZERO;

  // Parse and set baseSlot if it is present and defined
  if ("baseSlot" in storageLayout && storageLayout.baseSlot) {
    baseSlotNormalized = normalizeUint256Literal(storageLayout.baseSlot);
  }

  // Build storage layouts array for the visualizer
  let storageLayouts: StorageLayoutWrapper[] = [];

  // Root layout
  storageLayouts.push(
    getStorageLayoutWrapper(
      storageLayout.storage,
      storageLayout,
      "Root layout",
      baseSlotNormalized,
      false
    )
  );

  // ERC-7201 namespaces
  if (storageLayout.namespaces !== undefined) {
    Object.keys(storageLayout.namespaces).forEach((namespaceName) => {
      storageLayouts.push(
        getStorageLayoutWrapper(
          storageLayout.namespaces![namespaceName],
          storageLayout,
          namespaceName,
          erc7201(namespaceName.split(":")[1]),
          true
        )
      );
    });
  }

  return (
    <Card className="bg-black border-green-500 md:mb-4 overflow-hidden relative py-0 gap-0 h-full w-full transition-all duration-500 ease-in-out">
      {/* Upper Bar */}
      <div className="flex max-w-full justify-between items-center p-2 border-b border-green-500/50 bg-green-900/20">
        <div className="flex max-w-full truncate items-center gap-2">
          <Code className="text-green-500 h-4 w-4" />
          <span className="text-green-500 text-sm font-bold">
            {contractName}
          </span>
        </div>
        <div className="flex gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-green-500 hover:bg-green-900/30 hover:text-green-500 hover:rounded"
              >
                <Copy className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-black border-green-500 border text-green-500 px-3 py-1 rounded-md shadow-md text-xs transition-colors duration-200">
              Copy
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-green-500 hover:bg-green-900/30 hover:text-green-500 hover:rounded"
              >
                <GitCompareArrows className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-black border-green-500 border text-green-500 px-3 py-1 rounded-md shadow-md text-xs transition-colors duration-200">
              Compare
            </TooltipContent>
          </Tooltip>
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

      {/* Tabs*/}
      <Tabs defaultValue="Root layout" className="w-full">
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
              <>
                <TabsTrigger
                  value={layout.name}
                  className="text-green-500 data-[state=active]:bg-green-900/30 data-[state=active]:text-green-500 data-[state=active]:shadow-none rounded-none border-r"
                >
                  {layout.name}
                </TabsTrigger>
                <div className="w-px h-6 bg-green-500 mx-2 self-center" />
              </>
            ))}
          </TabsList>
        </div>

        {/*Content */}
        {storageLayouts.map((layout, index) => (
          <TabsContent value={layout.name} className="mt-0">
            <div className="px-4 pb-2 text-green-500 text-[8px] md:text-[11px]">
              base slot: {layout.baseSlot}
            </div>
            {layout.slots.length === 0 && (
              <div className="flex items-center justify-center gap-2 px-4 pb-2 my-5 text-green-500">
                <TriangleAlert className="h-4 w-4" />
                <span className="text-center">
                  {layout.name} has no storage items defined.
                </span>
              </div>
            )}
            <div
              key={index}
              className=" px-4 pb-4 overflow-x-auto text-green-500 text-sm leading-relaxed"
            >
              {layout.slots.map((slot, index) => (
                <div className=" flex flex-row my-0.5 ">
                  <div className="w-5 text-[11px]">{index}</div>
                  <div key={index} className=" h-[1.2rem] w-full relative ">
                    {slot.map((item, index) => (
                      <div key={index} className=" flex flex-col">
                        <Tooltip
                          open={
                            visibleTooltips[
                              `${layout.name}|${
                                storageLayout?.types[item.item.type].label
                              }|${item.item.label}`
                            ] ||
                            pinnedTooltips[
                              `${layout.name}|${
                                storageLayout?.types[item.item.type].label
                              }|${item.item.label}`
                            ]
                          }
                          onOpenChange={(isOpen) =>
                            handleOpenTooltip(
                              `${layout.name}|${
                                storageLayout?.types[item.item.type].label
                              }|${item.item.label}`,
                              isOpen
                            )
                          }
                        >
                          <TooltipTrigger
                            asChild
                            onClick={() => {
                              handlePinTooltip(
                                `${layout.name}|${
                                  storageLayout?.types[item.item.type].label
                                }|${item.item.label}`
                              );
                            }}
                          >
                            <div
                              style={{
                                width: `${item.width}%`,
                                left: `${item.offset}%`,
                                backgroundColor: item.color,
                              }}
                              className="h-full absolute border border-green-500"
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
                    ))}
                  </div>
                  <div className="h-[2px]" />
                </div>
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </Card>
  );
}
