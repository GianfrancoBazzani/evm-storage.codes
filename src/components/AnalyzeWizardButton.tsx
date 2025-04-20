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
// import { makeNamespacedInput } from "@openzeppelin/upgrades-core";

import type { SolcInput, SolcOutput } from "@openzeppelin/upgrades-core";
import type { ChangeEvent, DragEvent, Dispatch, SetStateAction } from "react";
import type { StorageLayout } from "@openzeppelin/upgrades-core";

interface UploadWizardButtonProps {
  setParentDialogOpen?: Dispatch<SetStateAction<boolean>>;
  triggerVisualizerId?: number;
}

export default function AnalyzeWizardButton({
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
  const [solcOutput, setSolcOutput] = useState<SolcOutput | undefined>(
    undefined
  );
  const [solcInput, setSolcInput] = useState<SolcInput | undefined>(undefined);
  const [compiledContracts, setCompiledContracts] = useState<
    Record<string, string>
  >({});

  // Storage layout loader management
  const [selectedContract, setSelectedContract] = useState<string | undefined>(
    undefined
  );
  const [storageLayoutLoadingError, setStorageLayoutLoadingError] =
    useState<string>("");

  // Function to reset wizard state when the dialog is closed.
  function resetWizardState() {
    setWizardStep(WizardStep.SELECT_COMPILER);
    setIsDragging(false);
    setSelectedFiles([]);
    setCompilerVersion("");
    setSolcOutput(undefined);
    setCompiledContracts({});
    setSelectedContract(undefined);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }
  // TODO Clean all state, remember this when namespaced layouts will be added

  // Handler for dialog open state change.
  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      resetWizardState();
    }
  };


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
    const _solcInput: SolcInput = { sources: sources };
    // @ts-ignore
    _solcInput.language = "Solidity";
    _solcInput.settings = {
      outputSelection: {
        "*": {
          "*": ["*"],
          "": ["ast"],
        },
      },
    };
    setSolcInput(_solcInput);

    // Initialize compiler worker
    const worker = new Worker("/dynSolcWorkerBundle.js");
    worker.addEventListener(
      "message",
      (msg) => {
        const solcOutput: SolcOutput = JSON.parse(msg.data.solcOutput);
        setSolcOutput(solcOutput);

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
      solcInput: JSON.stringify(_solcInput),
      solcBin: compilerVersions[compilerVersion],
    });
  }

  // Load storage layout function
  async function handleLoadStorageLayout() {
    setWizardStep(WizardStep.LOADING);
    if (!selectedContract || !solcInput || !solcOutput) return;

    // Extract storage layout
    var storageLayout: StorageLayout | undefined = undefined;

    // TODO implement this to make the analysis in the frontend instead of the backend ???
    // TODO Compile namespaces context in the frontend
    try {
      const response = await fetch("/api/extract_storage_layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          solcInput: solcInput,
          solcOutput: solcOutput,
          sourceName: compiledContracts[selectedContract],
          contractName: selectedContract,
        }),
      });
      const json = await response.json();
      storageLayout = json.storageLayout;
    } catch (error) {
      setStorageLayoutLoadingError("Error loading storage layout" + error);
      setWizardStep(WizardStep.LOADING_ERROR);
      return;
    }

    // ONLY ROOT STORAGE LAYOUT BUT NO BACKEND REQUIRED
    //let storageLayout =
    //  solcOutput?.contracts[compiledContracts[selectedContract]][
    //    selectedContract
    //  ].storageLayout;

    // TODO Try to delete this check
    if (!storageLayout) {
      setWizardStep(WizardStep.LOADING_ERROR);
      setStorageLayoutLoadingError("Storage layout extraction failed");
      return;
    }

    // Set storage layouts
    setStorageLayouts((prevLayouts) => {
      if (triggerVisualizerId !== undefined) {
        const newLayouts = [
          ...prevLayouts.slice(0, triggerVisualizerId + 1),
          {
            contractName: `${compiledContracts[selectedContract].replace(
              ".sol",
              ""
            )}:${selectedContract}`,
            id: 0,
            storageLayout: storageLayout!,
          },
          ...prevLayouts.slice(triggerVisualizerId + 1),
        ];
        for (let i = 0; i < newLayouts.length; i++) {
          newLayouts[i].id = i;
        }
        return newLayouts;
      }
      return [
        {
          contractName: `${compiledContracts[selectedContract].replace(
            ".sol",
            ""
          )}:${selectedContract}`,
          id: 0,
          storageLayout: storageLayout!,
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
          <div className="space-y-4 mt-4">{/* File upload area */}</div>
        </DialogContent>
      )}
    </Dialog>
  );
}
