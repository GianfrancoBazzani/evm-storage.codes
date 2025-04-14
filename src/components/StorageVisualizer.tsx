import { useContext, useState } from "react";
import { Code, Copy, X, GitCompareArrows, Cross } from "lucide-react"; // changed from "@lucide/astro" to the React version
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

import type { StorageLayout, StorageItem } from "@openzeppelin/upgrades-core";

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

  // Storage visualizer state
  // Interface for itemWrapper to add additional visualization properties
  interface itemWrapper {
    item: StorageItem;
    color: string;
    width: Number;
    offset: Number;
  }

  // Build astIdToColor object
  const colorHash = new ColorHash();
  let idToColor: { [key: string]: string } = {};
  storageLayout?.storage.forEach((item) => {
    idToColor[`${item.contract}:${item.label}`] = colorHash.hex(item.label);
  });

  // Set maxSlot
  let maxSlot = Number(
    storageLayout?.storage
      .map((storageItem) => storageItem.slot)
      .reduce((previousValue, currentValue) =>
        Number(previousValue) >= Number(currentValue)
          ? previousValue
          : currentValue
      )
  );
  // Extend max Slot if there is an overflow in the "last" slot
  let lastSlotTypeNumberOfBytes = Number(
    storageLayout?.types[storageLayout?.storage.slice(-1)[0].type].numberOfBytes
  );
  if (lastSlotTypeNumberOfBytes > 32) {
    maxSlot += Math.ceil(lastSlotTypeNumberOfBytes / 32) - 1;
  }

  // Build slots array
  let slots: Array<Array<itemWrapper>> = [];
  // build slots array
  let overflowBytes = 0;
  for (let i = 0; i <= maxSlot; i++) {
    let slotItems = storageLayout?.storage.filter(
      (item) => Number(item.slot) === i
    );
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
    let slotItemsWrapped: itemWrapper[] = slotItems
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
          let wrappedItem: itemWrapper = {
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

  console.log("slots:", slots);

  return (
    <Card className="bg-black border-green-500 mb-6 overflow-hidden relative py-0 gap-0 h-full w-full transition-all duration-500 ease-in-out">
      <div className="absolute inset-0 pointer-events-none">
        <div className="w-full h-full opacity-10 bg-[linear-gradient(transparent_50%,rgba(0,255,0,0.05)_50%)] bg-[length:100%_4px]"></div>
      </div>
      <div className="flex justify-between items-center p-2 border-b border-green-500/50 bg-green-900/20">
        <div className="flex items-center gap-2">
          <Code className="text-green-500 h-4 w-4" />
          <span className="text-green-500 text-sm font-bold">
            {contractName}
          </span>
        </div>
        {/* Nav Tabs*/}
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
            <TooltipContent className="bg-green-700 border-green-950 border text-black px-3 py-1 rounded-md shadow-md text-xs transition-colors duration-200">
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
            <TooltipContent className="bg-green-700 border-green-950 border text-black px-3 py-1 rounded-md shadow-md text-xs transition-colors duration-200">
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
              <TooltipContent className="bg-green-700 border-green-950 border text-black px-3 py-1 rounded-md shadow-md text-xs transition-colors duration-200">
                Add Contract
              </TooltipContent>
            </Tooltip>
            <DialogContent
              onCloseAutoFocus={(e) => e.preventDefault()}
              className="bg-black border-green-500 p-6 rounded-md"
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
              <div className="mt-6 mb-6 flex flex-row justify-center gap-4">
                <UploadWizardButton
                  setParentDialogOpen={setAddContractDialogOpen}
                  triggerVisualizerId={id}
                />
                <AnalyzeWizardButton
                //setParent={handleChildDialogClose} TODO: fix
                //triggerVisualizerId={id}
                />
                {/* TODO: Add option to upload exported json */}
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
            <TooltipContent className="bg-green-700 border-green-950 border text-black  px-3 py-1 rounded-md shadow-md text-xs transition-colors duration-200">
              Close
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/*  Content Tabs*/}
      <Tabs defaultValue="root-layout" className="w-full">
        <div className="border-b border-green-500/30 bg-green-900/10">
          <TabsList className="bg-transparent h-9 flex items-center">
            <TabsTrigger
              value="root-layout"
              className="text-green-500 data-[state=active]:bg-green-900/30 data-[state=active]:text-green-500 data-[state=active]:shadow-none rounded-none border-r"
            >
              Root Layout
            </TabsTrigger>
            <div className="w-px h-6 bg-green-500 mx-2 self-center" />
            {/*
              TODO: Add other layouts (ERC-7201, Transient storage)
            <TabsTrigger
              value="html"
              className="text-green-500 data-[state=active]:bg-green-900/30 data-[state=active]:text-green-500 data-[state=active]:shadow-none rounded-none border-r"
            >
              index.html
            </TabsTrigger>
            */}
          </TabsList>
        </div>
        <TabsContent value="root-layout" className="mt-0">
          <div className="p-4 overflow-x-auto text-green-500 text-sm leading-relaxed">
            {slots.map((slot, index) => (
              <div key={index} className=" h-[1.2rem] w-full relative">
                {slot.map((item, index) => (
                  <div key={index} className=" flex flex-col">
                    <div
                      style={{
                        width: `${item.width}%`,
                        left: `${item.offset}%`,
                        backgroundColor: item.color,
                      }}
                      className="h-full absolute"
                    ></div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </TabsContent>
        {/*
          TODO: Add other layouts (ERC-7201, Transient storage)
        <TabsContent value="html" className="mt-0">
          <pre className="p-4 overflow-x-auto text-green-500 text-sm leading-relaxed">
            <code>Sample</code>
          </pre>
        </TabsContent>
        */}
      </Tabs>
    </Card>
  );
}
