import { useContext, useState, useRef, useEffect } from "react";
import { StorageLayoutsContext } from "../App";
import { Upload, X, File as FileIcon, Loader2, FileX } from "lucide-react";
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

 import type {
   SolcInput,
   SolcOutput,
 } from "@openzeppelin/upgrades-core";
import type { ChangeEvent, DragEvent, Dispatch, SetStateAction } from "react";

interface UploadWizardButtonProps {
  setParentDialogOpen?: Dispatch<SetStateAction<boolean>>;
  triggerVisualizerId?: number;
}

export default function UploadWizardButton({
  setParentDialogOpen = undefined,
  triggerVisualizerId = undefined,
}: UploadWizardButtonProps) {
  // Global context
  const storageLayoutsContext = useContext(StorageLayoutsContext);
  if (!storageLayoutsContext) {
    throw new Error("StorageLayoutsContext is undefined");
  }
  const { setStorageLayouts } = storageLayoutsContext;

  // New state to control the dialog's open/close state.
  const [dialogOpen, setDialogOpen] = useState(false);

  // Wizard step
  enum WizardStep {
    SELECT_COMPILER,
    COMPILING,
    COMPILATION_ERROR,
    SELECT_CONTRACT,
    LOADING,
    LOADING_ERROR,
  }
  const [wizardStep, setWizardStep] = useState<WizardStep>(
    WizardStep.SELECT_COMPILER
  );

  // Files management - allow multiple files
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compiler management
  const [compilerVersions, setCompilerVersions] = useState<
    Record<string, string>
  >({});
  const [compilerVersion, setCompilerVersion] = useState<string>("");
  const [compilerOutput, setCompilerOutput] = useState<SolcOutput | null>(null);
  const [compiledContracts, setCompiledContracts] = useState<
    Record<string, string>
  >({});

  // Storage layout loader management
  const [selectedContract, setSelectedContract] = useState<string | undefined>(
    undefined
  );

  // Function to reset wizard state when the dialog is closed.
  function resetWizardState() {
    setWizardStep(WizardStep.SELECT_COMPILER);
    setIsDragging(false);
    setSelectedFiles([]);
    setCompilerVersion("");
    setCompilerOutput(null);
    setCompiledContracts({});
    setSelectedContract(undefined);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  // Handler for dialog open state change.
  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      resetWizardState();
    }
  };

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
      setSelectedFiles(Array.from(e.dataTransfer.files));
    }
  }

  function handleFileInputChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFiles(Array.from(e.target.files));
    }
  }

  function triggerFileInput() {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }

  function removeFile(fileToRemove: File) {
    setSelectedFiles((prevFiles) =>
      prevFiles.filter((file) => file !== fileToRemove)
    );
  }

  // Compile function
  async function handleCompile() {
    setWizardStep(WizardStep.COMPILING);

    // Read source files
    const sources: Record<string, { content: string }> = {};
    for (const file of selectedFiles) {
      const fileContent = await file.text();
      sources[file.name] = { content: fileContent };
    }

    // Create solcInput object
    const solcInput: SolcInput = { sources: sources };
    // @ts-ignore
    solcInput.language = "Solidity";
    solcInput.settings = {
      outputSelection: {
        "*": {
          "*": ["*"],
        },
      },
    };

    // Initialize compiler worker
    const worker = new Worker("/dynSolcWorkerBundle.js");
    worker.addEventListener(
      "message",
      (msg) => {
        const solcOutput: SolcOutput = JSON.parse(msg.data.solcOutput);
        setCompilerOutput(solcOutput);

        if (solcOutput.errors) {
          setWizardStep(WizardStep.COMPILATION_ERROR);
        } else {
          for (const source of Object.keys(solcOutput.contracts)) {
            for (const contract of Object.keys(solcOutput.contracts[source])) {
              setCompiledContracts((prevContracts) => ({
                ...prevContracts,
                [contract]: source,
              }));
            }
          }
          setWizardStep(WizardStep.SELECT_CONTRACT);
        }
        worker.terminate();
      },
      false
    );
    worker.postMessage({
      solcInput: JSON.stringify(solcInput),
      solcBin: compilerVersions[compilerVersion],
    });
  }

  // Load storage layout function
  function handleLoadStorageLayout() {
    setWizardStep(WizardStep.LOADING);

    // Load Storage layout
    setStorageLayouts((prevLayouts) => {
      if (triggerVisualizerId !== undefined) {
        const newLayouts = [
          ...prevLayouts.slice(0, triggerVisualizerId + 1),
          {
            contractName: selectedContract || "",
            id: 0,
          },
          ...prevLayouts.slice(triggerVisualizerId + 1),
        ];
        for (let i = 0; i < newLayouts.length; i++) {
          newLayouts[i].id = i;
        }
        console.log(newLayouts);
        return newLayouts;
      }
      return [
        {
          contractName: selectedContract || "",
          id: 0,
        },
      ];
    });
    // Close dialog
    setDialogOpen(false);
    // Close parent dialog if exist
    if (setParentDialogOpen) {
      setParentDialogOpen(false);
    }
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
      <DialogTrigger asChild>
        <Button
          className="bg-green-900/30 text-green-500 border border-green-500 hover:bg-green-600/40 hover:text-green-300 transition-all duration-300 px-8 py-6 text-lg animate-pulse"
          onClick={() => setDialogOpen(true)}
        >
          <Upload className="mr-2 h-4 w-4" /> UPLOAD SOURCES
        </Button>
      </DialogTrigger>

      {/* Wizard Step 1: Upload Sources */}
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
              Upload one or more Solidity source files. They will be compiled
              together.
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
                multiple
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileInputChange}
                accept=".sol"
              />

              {selectedFiles.length > 0 ? (
                <div className="space-y-2">
                  {selectedFiles.map((file, index) => (
                    <div
                      className="flex items-center justify-between"
                      key={index}
                    >
                      <div className="flex items-center">
                        <FileIcon className="h-6 w-6 mr-2 text-green-500" />
                        <span className="text-green-500 truncate max-w-[250px]">
                          {file.name}
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(file);
                        }}
                        className="text-green-500 hover:text-green-300"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <Upload className="h-10 w-10 mb-2 text-green-500" />
                  <p className="text-green-500 mb-1">UPLOAD CONTRACT FILES</p>
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
              onClick={handleCompile}
              disabled={selectedFiles.length === 0 || !compilerVersion}
              className="bg-green-900/30 text-green-500 border border-green-500 hover:bg-green-600/40 hover:text-green-300 transition-all duration-300 px-8 py-6 text-lg w-full"
            >
              Compile Sources
            </Button>
          </div>
        </DialogContent>
      )}

      {/* Wizard Step 2: Compilation Spinner */}
      {wizardStep === WizardStep.COMPILING && (
        <DialogContent className="bg-black border-green-500 p-6 rounded-md">
          <DialogHeader>
            <DialogTitle className="text-green-500">
              Compiling contracts
            </DialogTitle>
            <DialogDescription
              id="upload-dialog-description"
              className="text-green-800"
            >
              Please wait while your contract source files are being compiled.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center">
            <Loader2 className="animate-spin h-20 w-20 text-green-500 my-8" />
          </div>
        </DialogContent>
      )}

      {/* Wizard Step 3: Compilation Errors */}
      {wizardStep === WizardStep.COMPILATION_ERROR && (
        <DialogContent className="bg-black border-green-500 p-6 rounded-md">
          <DialogHeader>
            <DialogTitle className="text-green-500">
              Errors during compilation
            </DialogTitle>
            <DialogDescription
              id="upload-dialog-description"
              className="text-green-800"
            >
              {compilerOutput && compilerOutput.errors && (
                <>
                  {compilerOutput.errors.map((error, index) => (
                    <span key={index} className="text-red-500">
                      {error.formattedMessage}
                    </span>
                  ))}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center">
            <FileX className="h-20 w-20 text-green-500 my-8" />
          </div>
        </DialogContent>
      )}

      {/* Wizard Step 4: Contract Selection */}
      {wizardStep === WizardStep.SELECT_CONTRACT && (
        <DialogContent className="bg-black border-green-500 p-6 rounded-md">
          <DialogHeader>
            <DialogTitle className="text-green-500">
              Select a Contract
            </DialogTitle>
            <DialogDescription
              id="upload-dialog-description"
              className="text-green-800"
            >
              The contracts have been compiled successfully. Please select a
              contract to load storage layout.
            </DialogDescription>
          </DialogHeader>
          <div>
            <label className="block text-green-500 mb-2">
              Compiled contracts
            </label>
            <Select
              onValueChange={setSelectedContract}
              value={selectedContract}
            >
              <SelectTrigger className="w-full text-green-500 border-green-500 data-[placeholder]:text-green-500/50">
                <SelectValue placeholder="Select Contract" />
              </SelectTrigger>
              <SelectContent
                side="bottom"
                avoidCollisions={false}
                className="bg-black border-green-500 text-green-500 max overflow-y-auto"
              >
                {Object.keys(compiledContracts).map((version) => (
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
            onClick={handleLoadStorageLayout}
            disabled={!selectedContract}
            className="bg-green-900/30 text-green-500 border border-green-500 hover:bg-green-600/40 hover:text-green-300 transition-all duration-300 px-8 py-6 text-lg w-full"
          >
            Load Storage Layout
          </Button>
        </DialogContent>
      )}

      {/* Wizard Step 5: Loading Spinner */}
      {wizardStep === WizardStep.LOADING && (
        <DialogContent className="bg-black border-green-500 p-6 rounded-md">
          <DialogHeader>
            <DialogTitle className="text-green-500">
              Loading Storage Layout
            </DialogTitle>
            <DialogDescription
              id="upload-dialog-description"
              className="text-green-800"
            >
              Please wait while the storage layout for the selected contract is
              being loaded.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center">
            <Loader2 className="animate-spin h-20 w-20 text-green-500 my-8" />
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
