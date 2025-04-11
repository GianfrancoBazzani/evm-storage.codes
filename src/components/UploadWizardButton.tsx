import { useContext, useState, useRef, useEffect } from "react";
import { StorageLayoutsContext } from "../App";
import { Upload, X, File as FileIcon } from "lucide-react";
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

import type { ChangeEvent, DragEvent } from "react";

export default function UploadWizardButton() {
  // Global context
  const { storageLayouts, setStorageLayouts } = useContext(
    StorageLayoutsContext
  );

  // Files management
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  // Compiler management
  const [compilerVersions, setCompilerVersions] = useState<string[]>([]);
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

  // Query available compilers
  useEffect(() => {
    // Get compilers versions list
    setCompilerVersions(["0.8.0", "0.8.4", "0.8.7", "0.8.10"]);
  }, []);

  // File handling functions
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      setSelectedFile(file);
    }
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedFile(file);
    }
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="bg-green-900/30 text-green-400 border border-green-500 hover:bg-green-600/40 hover:text-green-300 transition-all duration-300 px-8 py-6 text-lg animate-pulse">
          <Upload className="mr-2 h-4 w-4" /> UPLOAD SOURCES
        </Button>
      </DialogTrigger>

      <DialogContent className="bg-black border-green-500 p-6 rounded-md">
        <DialogHeader>
          <DialogTitle className="text-green-500">
            Upload And Compile Contracts
          </DialogTitle>
          <DialogDescription
            id="upload-dialog-description"
            className=" text-green-800"
          >
            Only single sources are supported. If multiple contracts are needed,
            use foundry flatten.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          {/* File upload area */}
          <div
            className={`w-full max-w-lg mb-8 border-2 ${
              isDragging
                ? "border-green-400 bg-green-900/20"
                : "border-green-500/50 bg-black"
            } rounded-md p-6 text-center cursor-pointer transition-all duration-300`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={triggerFileInput}
          >
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileInputChange}
              accept=".sol"
            />

            {selectedFile ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <FileIcon className="h-6 w-6 mr-2 text-green-400" />
                  <span className="text-green-400 truncate max-w-[250px]">
                    {selectedFile.name}
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    clearSelectedFile();
                  }}
                  className="text-green-500 hover:text-green-300"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <Upload className="h-10 w-10 mb-2 text-green-500" />
                <p className="text-green-400 mb-1">UPLOAD CONTRACT FILE</p>
                <p className="text-green-500/70 text-sm">
                  Drag and drop or click to browse
                </p>
                <p className="text-green-500/50 text-xs mt-2">
                  .sol files supported
                </p>
              </div>
            )}
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
                {compilerVersions.map((version) => (
                  <SelectItem key={version} value={version}>
                    {version}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            TODO, build worker, compiler sshould be fetched and compiler
          </div>

          {/*
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
          */}
        </div>
      </DialogContent>
    </Dialog>
  );
}
