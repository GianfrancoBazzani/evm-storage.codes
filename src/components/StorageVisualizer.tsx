import { useContext } from "react";
import { Code, Copy, X, GitCompareArrows } from "lucide-react"; // changed from "@lucide/astro" to the React version
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
//import { StorageLayout } from "@openzeppelin/upgrades-core";

interface StorageVisualizerProps {
  contractName: string;
  //storageLayout:  null; // Storage layout
}

export default function StorageVisualizer({
  contractName,
}: StorageVisualizerProps) {
  // Global context
  const storageLayoutsContext = useContext(StorageLayoutsContext);
  if (!storageLayoutsContext) {
    throw new Error("StorageLayoutsContext is undefined");
  }
  const { setStorageLayouts } = storageLayoutsContext;

  // Close Visualizer
  function handleClose() {
    setStorageLayouts((prevLayouts) =>
      prevLayouts.filter((layout) => layout !== contractName)
    );
  }

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
        {/*  Roots Nav Tabs*/}
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
          <Dialog>
            <Tooltip>
              <TooltipTrigger asChild>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-green-500 hover:bg-green-900/30 hover:text-green-500 hover:rounded"
                  >
                    <GitCompareArrows className="h-3 w-3" />
                  </Button>
                </DialogTrigger>
              </TooltipTrigger>
              <TooltipContent className="bg-green-700 border-green-950 border text-black px-3 py-1 rounded-md shadow-md text-xs transition-colors duration-200">
                Compare
              </TooltipContent>
            </Tooltip>
            <DialogContent className="bg-black border-green-500 p-6 rounded-md">
              <DialogHeader>
                <DialogTitle className="text-green-500">
                  Compare With
                </DialogTitle>
                <DialogDescription
                  id="upload-dialog-description"
                  className=" text-green-700"
                >
                  Choose a comparison method.
                </DialogDescription>
              </DialogHeader>
              <div className="mt-6 mb-6 flex flex-row justify-center gap-4">
                <UploadWizardButton />
                <AnalyzeWizardButton />
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

      {/*  Roots Content Tabs*/}
      <Tabs defaultValue="root-layout" className="w-full">
        <div className="border-b border-green-500/30 bg-green-900/10">
          <TabsList className="bg-transparent h-9 flex items-center">
            <TabsTrigger
              value="root-layout"
              className="text-green-500 data-[state=active]:bg-green-900/30 data-[state=active]:text-green-500 data-[state=active]:shadow-none rounded-none border-r"
            >
              ROOT Layout
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
          <pre className="p-4 overflow-x-auto text-green-500 text-sm leading-relaxed">
            <code>TODO Add Layout</code>
          </pre>
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
