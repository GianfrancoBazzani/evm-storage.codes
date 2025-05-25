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
import {
  EVM_VERSIONS,
  MIN_COMPATIBLE_SOLC_VERSION,
  MIN_NAMESPACED_COMPATIBLE_SOLC_VERSION,
  BROTLI_QUALITY,
} from "@/lib/constants";
import * as versions from "compare-versions";
import brotliPromise from "brotli-wasm";

import type { SolcInput, SolcOutput } from "@openzeppelin/upgrades-core";
import type { ChangeEvent, DragEvent, Dispatch, SetStateAction } from "react";
import type { StorageLayout } from "@openzeppelin/upgrades-core";

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
    COMPILING_NAMESPACED,
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
  const [advancedOptionsEnabled, setAdvancedOptionsEnabled] = useState<
    boolean | undefined
  >(undefined);
  const [evmVersion, setEvmVersion] = useState<string | undefined>(undefined);
  const [optimizationEnabled, setOptimizationEnabled] =
    useState<boolean>(false);
  const [numRuns, setNumRuns] = useState<number | undefined>(undefined);
  const [solcInput, setSolcInput] = useState<SolcInput | undefined>(undefined);
  const [solcOutput, setSolcOutput] = useState<SolcOutput | undefined>(
    undefined
  );
  const [namespacedOutput, setNamespacedOutput] = useState<
    SolcOutput | undefined
  >(undefined);
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
    setAdvancedOptionsEnabled(false);
    setEvmVersion(undefined);
    setOptimizationEnabled(false);
    setNumRuns(undefined);
    setSolcInput(undefined);
    setSolcOutput(undefined);
    setNamespacedOutput(undefined);
    setCompiledContracts({});
    setSelectedContract(undefined);
    setStorageLayoutLoadingError("");
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

      const compatibleVersions = Object.keys(json.solc_versions)
        .filter((version) =>
          versions.compare(version, MIN_COMPATIBLE_SOLC_VERSION, ">=")
        )
        .reduce<Record<string, string>>((acc, version) => {
          acc[version] = json.solc_versions[version] as string;
          return acc;
        }, {});
      setCompilerVersions(compatibleVersions);
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
    if (advancedOptionsEnabled) {
      if (evmVersion && evmVersion !== "default") {
        //@ts-ignore
        _solcInput.settings.evmVersion = evmVersion;
      }
      if (optimizationEnabled) {
        //@ts-ignore
        _solcInput.settings.optimizer = {
          enabled: optimizationEnabled,
          runs: numRuns,
        };
      }
    }
    setSolcInput(_solcInput);

    // Compile contracts using compiler worker
    const worker = new Worker("/dynSolcWorkerBundle.js");
    worker.addEventListener(
      "message",
      (msg) => {
        const _solcOutput: SolcOutput = JSON.parse(msg.data.solcOutput);
        setSolcOutput(_solcOutput);

        if (
          _solcOutput.errors &&
          _solcOutput.errors.some(
            (error: { severity: string }) => error.severity === "error"
          )
        ) {
          setWizardStep(WizardStep.COMPILATION_ERROR);
        } else {
          for (const source of Object.keys(_solcOutput.contracts)) {
            for (const contract of Object.keys(_solcOutput.contracts[source])) {
              setCompiledContracts((prevContracts) => ({
                ...prevContracts,
                [contract]: source,
              }));
            }
          }
          if (
            versions.compare(
              compilerVersion,
              MIN_NAMESPACED_COMPATIBLE_SOLC_VERSION,
              ">="
            )
          ) {
            setWizardStep(WizardStep.COMPILING_NAMESPACED);
          } else {
            setWizardStep(WizardStep.SELECT_CONTRACT);
          }
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

  // Compile Namespaces useEffect
  async function compileNamespaces() {
    try {
      // To avoid FUNCTION_PAYLOAD_TOO_LARGE compress the  data using brotli
      const _brotli = await brotliPromise;
      const _textEncoder = new TextEncoder();
      const _uncompressedBodyRequest = _textEncoder.encode(
        JSON.stringify({
          solcInput: solcInput,
          solcOutput: solcOutput,
          compilerVersion: compilerVersion,
        })
      );
      const _compressedBodyRequest = _brotli.compress(
        _uncompressedBodyRequest,
        {
          quality: BROTLI_QUALITY,
        }
      );

      const response = await fetch("/api/get_namespaced_input", {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: _compressedBodyRequest,
      });
      if (!response.ok) {
        throw new Error((await response.json()).message);
      }

      // Parse the response
      const _arrayBuffer = await response.arrayBuffer();
      const _textDecoder = new TextDecoder();
      const _namespacedInput = JSON.parse(
        _textDecoder.decode(_arrayBuffer)
      );

      // Compile contract using compiler worker
      const worker = new Worker("/dynSolcWorkerBundle.js");
      worker.addEventListener(
        "message",
        (msg) => {
          const _namespacedOutput: SolcOutput = JSON.parse(msg.data.solcOutput);
          setNamespacedOutput(_namespacedOutput);
          if (
            _namespacedOutput.errors &&
            _namespacedOutput.errors.some(
              (error: { severity: string }) => error.severity === "error"
            )
          ) {
            setWizardStep(WizardStep.COMPILATION_ERROR);
          } else {
            setWizardStep(WizardStep.SELECT_CONTRACT);
          }
          worker.terminate();
        },
        false
      );
      worker.postMessage({
        solcInput: JSON.stringify(_namespacedInput),
        solcBin: compilerVersions[compilerVersion],
      });
    } catch (error) {
      const _solcOutput: SolcOutput = {
        errors: [
          {
            severity: "error",
            formattedMessage: "Error compiling namespaces: " + error,
          },
        ],
        contracts: {},
        sources: {},
      };
      setSolcOutput(_solcOutput);
      setWizardStep(WizardStep.COMPILATION_ERROR);
      return;
    }
  }
  useEffect(() => {
    if (
      wizardStep === WizardStep.COMPILING_NAMESPACED &&
      solcOutput !== undefined
    ) {
      compileNamespaces();
    }
  }, [wizardStep]);

  // Load storage layout function
  async function handleLoadStorageLayout() {
    setWizardStep(WizardStep.LOADING);
    if (!selectedContract || !solcInput || !solcOutput) return;

    // Extract storage layout using backend
    var storageLayout: StorageLayout | undefined = undefined;
    try {
      // To avoid Vercel FUNCTION_PAYLOAD_TOO_LARGE minimize the solcOutput
      const _brotli = await brotliPromise;
      const _textEncoder = new TextEncoder();
      const _uncompressedBodyRequest = _textEncoder.encode(
        JSON.stringify({
          solcInput: solcInput,
          solcOutput: solcOutput,
          namespacedOutput: namespacedOutput,
          sourceName: compiledContracts[selectedContract],
          contractName: selectedContract,
          chainId: undefined,
          address: undefined,
        })
      );
      const _compressedBodyRequest = _brotli.compress(
        _uncompressedBodyRequest,
        {
          quality: BROTLI_QUALITY,
        }
      );
      const response = await fetch("/api/extract_storage_layout", {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: _compressedBodyRequest,
      });
      if (!response.ok) {
        throw new Error((await response.json()).message);
      }
      const json = await response.json();
      storageLayout = json.storageLayout;
    } catch (error) {
      setStorageLayoutLoadingError("Error loading storage layout: " + error);
      setWizardStep(WizardStep.LOADING_ERROR);
      return;
    }

    // Set storage layouts
    setStorageLayouts((prevLayouts) => {
      if (triggerVisualizerId !== undefined) {
        const newLayouts = [
          ...prevLayouts.slice(0, triggerVisualizerId + 1),
          {
            contractName: selectedContract,
            id: 0,
            storageLayout: storageLayout!,
            chainId: undefined,
            address: undefined,
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
          contractName: selectedContract,
          id: 0,
          storageLayout: storageLayout!,
          chainId: undefined,
          address: undefined
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
          className="w-52 bg-green-900/30 text-green-500 border border-green-500 hover:bg-green-600/40 hover:text-green-300 transition-all duration-300 px-8 py-6 text-lg animate-pulse"
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
                <SelectTrigger className="w-full text-green-500 border-green-500 data-[placeholder]:text-green-500/50 cursor-pointer">
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

            {/* Advanced Compiler Options */}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={advancedOptionsEnabled}
                onChange={(e) => setAdvancedOptionsEnabled(e.target.checked)}
                id="advanced-options-checkbox"
                className="h-4 w-4 not-checked:appearance-none rounded border border-green-500 accent-green-500"
              />
              <label
                htmlFor="advanced-options-checkbox"
                className="text-green-500"
              >
                Advanced Compiler Options
              </label>
            </div>

            {advancedOptionsEnabled === true && (
              <div className=" flex flex-col space-y-4 pl-6 border-l border-green-500">
                <div>
                  <label
                    htmlFor="num-runs"
                    className="block text-green-500 mb-1"
                  >
                    EVM Version
                  </label>
                  <Select onValueChange={setEvmVersion} value={evmVersion}>
                    <SelectTrigger className="w-full text-green-500 border-green-500 data-[placeholder]:text-green-500/50 cursor-pointer">
                      <SelectValue placeholder="Select Version" />
                    </SelectTrigger>
                    <SelectContent
                      side="bottom"
                      avoidCollisions={false}
                      className="bg-black border-green-500 text-green-500 max overflow-y-auto"
                    >
                      {EVM_VERSIONS.map((version) => (
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
                <div className="flex flex-row gap-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={optimizationEnabled}
                      onChange={(e) => setOptimizationEnabled(e.target.checked)}
                      id="advanced-options-checkbox"
                      className="h-4 w-4 not-checked:appearance-none rounded border border-green-500 accent-green-500"
                    />
                    <label
                      htmlFor="advanced-options-checkbox"
                      className="text-green-500"
                    >
                      Optimization
                    </label>
                  </div>
                  <div className="flex flex-row items-center gap-2">
                    <label htmlFor="num-runs" className="block text-green-500">
                      Runs
                    </label>
                    <input
                      type="number"
                      id="num-runs"
                      value={numRuns}
                      onChange={(e) => setNumRuns(parseInt(e.target.value))}
                      className="appearance-none w-full bg-black border border-green-500 text-green-500 px-3 py-2 rounded-md focus:outline-none focus:border-green-700"
                      style={{
                        WebkitAppearance: "none",
                        MozAppearance: "textfield",
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

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
              {optimizationEnabled && (
                <p>
                  Compilation might take a while because the optimizer is
                  enabled.
                </p>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center">
            <Loader2 className="animate-spin h-20 w-20 text-green-500 my-8" />
          </div>
        </DialogContent>
      )}

      {/* Wizard Step 3: Compilation Namespaces Spinner */}
      {wizardStep === WizardStep.COMPILING_NAMESPACED && (
        <DialogContent className="bg-black border-green-500 p-6 rounded-md">
          <DialogHeader>
            <DialogTitle className="text-green-500">
              Compiling ERC-7201 namespaces
            </DialogTitle>
            <DialogDescription
              id="upload-dialog-description"
              className="text-green-800"
            >
              Selected Compiler version allows ERC-7201 namespaces. Please wait
              while your contract's namespaces are being compiled.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center">
            <Loader2 className="animate-spin h-20 w-20 text-green-500 my-8" />
          </div>
        </DialogContent>
      )}

      {/* Wizard Step 4: Compilation Errors */}
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
              {solcOutput && solcOutput.errors && (
                <div
                  className="max-h-60 overflow-y-auto
                                 minimal-h-scrollbar-green
          [&::-webkit-scrollbar]:h-1.5
          [&::-webkit-scrollbar-track]:bg-transparent
          [&::-webkit-scrollbar-thumb]:bg-green-500
          hover:[&::-webkit-scrollbar-thumb]:bg-green-600 
          [&::-webkit-scrollbar-thumb]:rounded-sm
                "
                >
                  {solcOutput.errors.map((error, index) => (
                    <span key={index} className="block text-red-500">
                      {error.formattedMessage}
                    </span>
                  ))}
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center">
            <FileX className="h-15 w-15 text-green-500 my-4" />
          </div>
        </DialogContent>
      )}

      {/* Wizard Step 5: Contract Selection */}
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
          <div className="overflow-hidden">
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
                className="bg-black border-green-500 text-green-500"
              >
                {Object.keys(compiledContracts).map((contract) => (
                  <SelectItem
                    className="focus:bg-green-700 focus:border focus:border-green-950"
                    key={contract}
                    value={contract}
                  >
                    {contract}
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

      {/* Wizard Step 6: Loading Spinner */}
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

      {/* Wizard Step 7: Storage Layout Loading error */}
      {wizardStep === WizardStep.LOADING_ERROR && (
        <DialogContent className="bg-black border-green-500 p-6 rounded-md">
          <DialogHeader>
            <DialogTitle className="text-green-500">
              Error loading storage layout
            </DialogTitle>
            <DialogDescription
              id="upload-dialog-description"
              className="text-green-800"
            >
              <span className="text-red-500">{storageLayoutLoadingError}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center">
            <FileX className="h-15 w-15 text-green-500 my-4" />
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
