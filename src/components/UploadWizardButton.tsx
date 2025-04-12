import { useContext, useState, useRef, useEffect } from "react";
import { StorageLayoutsContext } from "../App";
import { Upload, X, File as FileIcon, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
//import DynSolcWorker from "@/lib/dyn_solc_worker.js?worker";

import type { ChangeEvent, DragEvent } from "react";

export default function UploadWizardButton() {
  // Global context
  const storageLayoutsContext = useContext(StorageLayoutsContext);
  if (!storageLayoutsContext) {
    throw new Error("StorageLayoutsContext is undefined");
  }
  const { setStorageLayouts } = storageLayoutsContext;

  // Wizard step
  enum WizardStep {
    SELECT_COMPILER,
    SELECT_CONTRACT,
  }
  const [wizardStep, setWizardStep] = useState<WizardStep>(
    WizardStep.SELECT_COMPILER
  );

  // Files management
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compiler management
  const [compilerVersions, setCompilerVersions] = useState<
    Record<string, string>
  >({});
  const [compilerVersion, setCompilerVersion] = useState<string>("");
  //const [compiledContracts, setCompiledContracts] = useState<string[]>([]);
  //const [selectedContract, setSelectedContract] = useState<string>("");
  const [compilerOutput, setCompilerOutput] = useState<any>(null); // TODO Set type

  // Fetch compiler version useEffect
  async function fetchCompilerVersions() {
    try {
      const response = await fetch("/api/get_solc_versions");
      const json = await response.json();
      setCompilerVersions(json.solc_versions);
    } catch (error) {
      console.error("Error fetching compilers:", error);
    }
  }
  useEffect(() => {
    fetchCompilerVersions();
  }, []);

  // File handling functions
  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      setSelectedFile(file);
    }
  }

  function handleFileInputChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedFile(file);
    }
  }

  function triggerFileInput() {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }

  function clearSelectedFile() {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  // Compile function
  function compile() {
    setWizardStep(WizardStep.SELECT_CONTRACT);

    //const dynSolcWorker = new DynSolcWorker();
    //dynSolcWorker.addEventListener(
    //  "message",
    //  function (msg) {
    //    console.log(msg.data.solcOutput);
    //  },
    //  false
    //);
//
    //dynSolcWorker.postMessage({
    //  solcInput: {},
    //  solcBin: compilerVersions[compilerVersion],
    //  sourceFiles: [],
    //});

    setStorageLayouts((prevLayouts) => [...prevLayouts, "PEPE"]);
    setCompilerOutput("");
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="bg-green-900/30 text-green-500 border border-green-500 hover:bg-green-600/40 hover:text-green-300 transition-all duration-300 px-8 py-6 text-lg animate-pulse">
          <Upload className="mr-2 h-4 w-4" /> UPLOAD SOURCES
        </Button>
      </DialogTrigger>

      {/* Wizard Step 1 upload sources */}
      {wizardStep === WizardStep.SELECT_COMPILER && (
        <DialogContent className="bg-black border-green-500 p-6 rounded-md">
          <DialogHeader>
            <DialogTitle className="text-green-500">
              Upload And Compile Contracts
            </DialogTitle>
            <DialogDescription
              id="upload-dialog-description"
              className=" text-green-800"
            >
              Only single sources are supported. If multiple contracts are
              needed, use foundry flatten.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {/* File upload area */}
            <div
              className={`w-full max-w-lg mb-8 border-2 ${
                isDragging
                  ? "border-green-500 bg-green-900/20"
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
                    <FileIcon className="h-6 w-6 mr-2 text-green-500" />
                    <span className="text-green-500 truncate max-w-[250px]">
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
                  <p className="text-green-500 mb-1">UPLOAD CONTRACT FILE</p>
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
              <Select
                onValueChange={setCompilerVersion}
                value={compilerVersion}
              >
                <SelectTrigger className="w-full text-green-500 border-green-500 data-[placeholder]:text-green-500/50">
                  <SelectValue placeholder="Select Version" />
                </SelectTrigger>
                <SelectContent
                  side="bottom"
                  avoidCollisions={false}
                  className="bg-black border-green-500 text-green-500 max overflow-y-auto"
                >
                  {Object.keys(compilerVersions).map((version) => (
                    <SelectItem
                      className="focus:bg-green-700 focus:border focus:border-green-950"
                      key={version}
                      value={version}
                    >
                      {version}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={compile}
              disabled={!selectedFile || !compilerVersion}
              className="bg-green-900/30 text-green-500 border border-green-500 hover:bg-green-600/40 hover:text-green-300 transition-all duration-300 px-8 py-6 text-lg w-full"
            >
              Compile Sources
            </Button>
          </div>
        </DialogContent>
      )}

      {/* Wizard Step 2 compile */}
      {wizardStep === WizardStep.SELECT_CONTRACT && (
        <>
          {compilerOutput === null ? (
            <DialogContent className="bg-black border-green-500 p-6 rounded-md">
              <DialogHeader>
                <DialogTitle className="text-green-500">
                  Compiling contracts
                </DialogTitle>
                <DialogDescription
                  id="upload-dialog-description"
                  className="text-green-800"
                >
                  Please wait while your contract source file is being compiled.
                </DialogDescription>
              </DialogHeader>
              <div className="flex items-center justify-center">
                <Loader2 className="animate-spin h-25 w-25 text-green-500" />
              </div>
            </DialogContent>
          ) : (
            <DialogContent className="bg-black border-green-500 p-6 rounded-md">
              <DialogHeader>
                <DialogTitle className="text-green-500">
                  Upload And Compile Contracts
                </DialogTitle>
                <DialogDescription
                  id="upload-dialog-description"
                  className=" text-green-800"
                >
                  Only single sources are supported. If multiple contracts are
                  needed, use foundry flatten.
                </DialogDescription>
              </DialogHeader>
              <div className="flex items-center justify-center">
                <Loader2 className="animate-spin h-30 w-30 text-green-500" />
              </div>
            </DialogContent>
          )}
        </>
      )}
    </Dialog>
  );
}
