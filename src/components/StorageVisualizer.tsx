import React from "react";
//import { StorageLayout } from "@openzeppelin/upgrades-core";
import { Code, Copy } from "lucide-react"; // changed from "@lucide/astro" to the React version
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface StorageVisualizerProps {
  contractName: string;
  //storageLayout:  null; // Storage layout
}
export default function StorageVisualizer({
  contractName,
}: StorageVisualizerProps) {
  return (
    <Card className="bg-black border-green-500 mb-6 overflow-hidden relative py-0 gap-0 h-full w-full">
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
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-green-500 hover:bg-green-900/30 hover:text-green-400"
          >
            <Copy className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            className="h-6 w-fill text-green-500 hover:bg-green-900/30 hover:text-green-400 border border-green-500/50 rounded"
          >
            Compare
          </Button>
        </div>
      </div>

      <Tabs defaultValue="html" className="w-full">
        <div className="border-b border-green-500/30 bg-green-900/10">
          <TabsList className="bg-transparent h-9 flex items-center">
            <TabsTrigger
              value="root-layout"
              className="text-green-500 data-[state=active]:bg-green-900/30 data-[state=active]:text-green-400 data-[state=active]:shadow-none rounded-none border-r"
            >
              ROOT Layout
            </TabsTrigger>
            <div className="w-px h-6 bg-green-500 mx-2 self-center" />
            {/*
              TODO: Add other layouts (ERC-7201, Transient storage)
            */}
            <TabsTrigger
              value="html"
              className="text-green-500 data-[state=active]:bg-green-900/30 data-[state=active]:text-green-400 data-[state=active]:shadow-none rounded-none border-r"
            >
              index.html
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="root-layout" className="mt-0">
          <pre className="p-4 overflow-x-auto text-green-400 text-sm leading-relaxed">
            <code>TODO Add Layout</code>
          </pre>
        </TabsContent>
        {/*
          TODO: Add other layouts (ERC-7201, Transient storage)
        */}
        <TabsContent value="html" className="mt-0">
          <pre className="p-4 overflow-x-auto text-green-400 text-sm leading-relaxed">
            <code>Sample</code>
          </pre>
        </TabsContent>
      </Tabs>
    </Card>
  );
}
