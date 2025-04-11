import { useContext, useState } from "react";
import { StorageLayoutsContext } from "../App";
import { Search } from "lucide-react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { ChangeEvent } from "react";

export default function AnalyzeWizardButton() {
  // Global context
  const { storageLayouts, setStorageLayouts } = useContext(
    StorageLayoutsContext
  );

  // Local state for file upload, compiler version, and contract selection
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [compilerVersion, setCompilerVersion] = useState<string>("");
  const [compiledContracts, setCompiledContracts] = useState<string[]>([]);
  const [selectedContract, setSelectedContract] = useState<string>("");

  function handleFileUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    setUploadedFile(file);
    // Simulate compilation to produce a list of contracts
    if (file) {
      setCompiledContracts(["MyContract", "YourContract"]);
    }
  }

  function handleAnalyze() {
    if (selectedContract && compilerVersion) {
      // For demonstration, update global storage layouts with the selected contract
      setStorageLayouts([...storageLayouts, selectedContract]);
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="bg-green-900/30 text-green-400 border border-green-500 hover:bg-green-600/40 hover:text-green-300 transition-all duration-300 px-8 py-6 text-lg animate-pulse">
          <Search className="mr-2 h-4 w-4" /> ANALYZE ADDRESS
        </Button>
      </DialogTrigger>

      <DialogContent className="bg-black border-green-500 p-6 rounded-md">
        <DialogHeader>
          <DialogTitle className="text-green-500">
            Enter the address of the contract you want to analyze
          </DialogTitle>
          <DialogDescription
            id="upload-dialog-description"
            className=" text-green-700"
          >
            Insert contract address and network.
          </DialogDescription>
        </DialogHeader>

        {/*<div className="space-y-4 mt-4">
          
          <div>
            <label className="block text-green-500 mb-2">Upload File</label>
            <Input
              type="file"
              onChange={handleFileUpload}
              className="bg-black text-green-500"
            />
          </div>

          <div>
            <label className="block text-green-500 mb-2">
              Solidity Compiler Version
            </label>
            <Select onValueChange={setCompilerVersion} value={compilerVersion}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select Version" />
              </SelectTrigger>
              <SelectContent>
                {["0.8.0", "0.8.4", "0.8.7", "0.8.10"].map((version) => (
                  <SelectItem key={version} value={version}>
                    {version}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-green-500 mb-2">
              Compiled Contracts
            </label>
            <Select
              onValueChange={setSelectedContract}
              value={selectedContract}
              disabled={compiledContracts.length === 0}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select Contract" />
              </SelectTrigger>
              <SelectContent>
                {compiledContracts.map((contract) => (
                  <SelectItem key={contract} value={contract}>
                    {contract}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleAnalyze}
            disabled={!selectedContract || !compilerVersion}
            className="w-full"
          >
            Analyze Selected Contract
          </Button>
        </div>
        */}
      </DialogContent>
    </Dialog>
  );
}
