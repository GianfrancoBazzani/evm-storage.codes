import { useContext, useState, useRef, useEffect } from "react";
import { StorageLayoutsContext } from "@/contexts/StorageLayoutsContext";
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
  MIN_VIA_IR_VERSION,
  MIN_NAMESPACED_COMPATIBLE_SOLC_VERSION,
  BROTLI_QUALITY,
} from "@/lib/constants";
import { compilerCrashSolcOutput } from "@/lib/compiler-errors";
import * as versions from "compare-versions";
import brotliPromise from "brotli-wasm";

import type { SolcInput, SolcOutput } from "@openzeppelin/upgrades-core";
import type { ChangeEvent, DragEvent, Dispatch, SetStateAction } from "react";
import type { StorageLayout } from "@openzeppelin/upgrades-core";

interface UploadWizardButtonProps {
  setParentDialogOpen?: Dispatch<SetStateAction<boolean>>;
  triggerVisualizerId?: number;
}

type FileSelection = {
  file: File;
  path: string;
};

// viaIR management
function isViaIRSupported(version: string) {
  if (!version) return false;
  return versions.compare(version, MIN_VIA_IR_VERSION, ">=");
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

  // Files management - allow multiple files, or a whole directory
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [noSolidityFilesFound, setNoSolidityFilesFound] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dirInputRef = useRef<HTMLInputElement>(null);
  const filePathByFileRef = useRef(new WeakMap<File, string>());

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
  const [viaIREnabled, setViaIREnabled] = useState<boolean>(false);
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

  useEffect(() => {
    if (!isViaIRSupported(compilerVersion)) {
      setViaIREnabled(false);
    }
  }, [compilerVersion]);

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
    setNoSolidityFilesFound(false);
    filePathByFileRef.current = new WeakMap();
    setCompilerVersion("");
    setAdvancedOptionsEnabled(false);
    setEvmVersion(undefined);
    setOptimizationEnabled(false);
    setViaIREnabled(false);
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
    if (dirInputRef.current) {
      dirInputRef.current.value = "";
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

  // The single/multi-file input already limits picking to .sol via `accept`,
  // but that attribute has no effect on a webkitdirectory folder pick (nor on
  // drag-and-drop) - filter here so a whole-project folder doesn't also pull
  // in configs, artifacts, or other unrelated files it contains.
  function isSolidityFile(file: File): boolean {
    return isSolidityPath(file.name);
  }

  function isSolidityPath(path: string): boolean {
    return path.toLowerCase().endsWith(".sol");
  }

  function getSolidityFileSelections(fileSelections: FileSelection[]) {
    return fileSelections.filter(({ file, path }) => {
      return isSolidityFile(file) && isSolidityPath(path);
    });
  }

  function applySelectedSolidityFiles(fileSelections: FileSelection[]) {
    const nextPathMap = new WeakMap<File, string>();

    for (const { file, path } of fileSelections) {
      nextPathMap.set(file, path);
    }

    filePathByFileRef.current = nextPathMap;
    setSelectedFiles(fileSelections.map(({ file }) => file));
  }

  function setSelectedSolidityFiles(fileSelections: FileSelection[]) {
    const solFileSelections = getSolidityFileSelections(fileSelections);

    applySelectedSolidityFiles(solFileSelections);
    setNoSolidityFilesFound(solFileSelections.length === 0);
  }

  function appendSelectedSolidityFiles(fileSelections: FileSelection[]) {
    const solFileSelections = getSolidityFileSelections(fileSelections);

    if (solFileSelections.length === 0) {
      setNoSolidityFilesFound(selectedFiles.length === 0);
      return;
    }

    const mergedSelections = new Map<string, FileSelection>();
    for (const file of selectedFiles) {
      const path = filePathOf(file);
      mergedSelections.set(path, { file, path });
    }
    for (const fileSelection of solFileSelections) {
      mergedSelections.set(fileSelection.path, fileSelection);
    }

    applySelectedSolidityFiles(Array.from(mergedSelections.values()));
    setNoSolidityFilesFound(false);
  }

  function hasDroppedFileItems(dataTransfer: DataTransfer) {
    return (
      Array.from(dataTransfer.items).some((item) => item.kind === "file") ||
      dataTransfer.files.length > 0
    );
  }

  async function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFileItems = hasDroppedFileItems(e.dataTransfer);
    if (!droppedFileItems) {
      return;
    }

    const droppedFiles = await getDroppedFiles(e.dataTransfer);
    appendSelectedSolidityFiles(droppedFiles);
  }

  function handleFileInputChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedSolidityFiles(
        Array.from(e.target.files).map((file) => ({
          file,
          path: file.webkitRelativePath || file.name,
        }))
      );
    }
  }

  async function getDroppedFiles(
    dataTransfer: DataTransfer
  ): Promise<FileSelection[]> {
    const entries = Array.from(dataTransfer.items)
      .filter((item) => item.kind === "file")
      .map((item) => item.webkitGetAsEntry?.())
      .filter((entry): entry is FileSystemEntry => Boolean(entry));

    if (entries.length > 0) {
      try {
        const nestedFiles = await Promise.all(
          entries.map((entry) => readDroppedEntry(entry))
        );
        return nestedFiles.flat();
      } catch (error) {
        console.error("Error reading dropped files:", error);
      }
    }

    return Array.from(dataTransfer.files).map((file) => ({
      file,
      path: file.name,
    }));
  }

  async function readDroppedEntry(
    entry: FileSystemEntry,
    parentPath = ""
  ): Promise<FileSelection[]> {
    const entryPath = `${parentPath}${entry.name}`;

    if (entry.isFile) {
      if (!isSolidityPath(entry.name)) {
        return [];
      }
      const file = await readDroppedFileEntry(entry as FileSystemFileEntry);
      return [{ file, path: entryPath }];
    }

    if (entry.isDirectory) {
      const childEntries = await readDroppedDirectoryEntries(
        entry as FileSystemDirectoryEntry
      );
      const childFiles = await Promise.all(
        childEntries.map((childEntry) =>
          readDroppedEntry(childEntry, `${entryPath}/`)
        )
      );
      return childFiles.flat();
    }

    return [];
  }

  function readDroppedFileEntry(
    entry: FileSystemFileEntry
  ): Promise<File> {
    return new Promise((resolve, reject) => {
      entry.file(resolve, reject);
    });
  }

  async function readDroppedDirectoryEntries(
    entry: FileSystemDirectoryEntry
  ): Promise<FileSystemEntry[]> {
    const reader = entry.createReader();
    const entries: FileSystemEntry[] = [];

    while (true) {
      const batch = await new Promise<FileSystemEntry[]>(
        (resolve, reject) => {
          reader.readEntries(resolve, reject);
        }
      );
      if (batch.length === 0) {
        break;
      }
      entries.push(...batch);
    }

    return entries;
  }

  function triggerFileInput() {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }

  function triggerDirInput() {
    if (dirInputRef.current) {
      dirInputRef.current.click();
    }
  }

  function removeFile(fileToRemove: File) {
    filePathByFileRef.current.delete(fileToRemove);
    setSelectedFiles((prevFiles) =>
      prevFiles.filter((file) => file !== fileToRemove)
    );
  }

  // Files picked via the webkitdirectory input carry their path (relative to
  // the selected folder), and folder drops use the same path shape via
  // filePathByFileRef. This keeps cross-file imports resolving against the
  // right source keys instead of colliding on bare filenames.
  function filePathOf(file: File): string {
    return (
      filePathByFileRef.current.get(file) ||
      file.webkitRelativePath ||
      file.name
    );
  }

  // Compile function
  async function handleCompile() {
    setWizardStep(WizardStep.COMPILING);

    // Read source files
    const sources: Record<string, { content: string }> = {};
    for (const file of selectedFiles) {
      const fileContent = await file.text();
      sources[filePathOf(file)] = { content: fileContent };
    }

    // Create solcInput object
    const _solcInput: SolcInput = { sources: sources };
    // @ts-expect-error language is not typed in SolcInput
    _solcInput.language = "Solidity";
    // Only storageLayout + ast are ever used (see extract_storage_layout.js
    // and upgrades-core's own makeNamespacedInput, which narrows to the same
    // two fields for the same reason). Requesting "*" also forces bytecode
    // generation, optimizer runs, gas estimation, and metadata hashing for
    // no benefit - for large/complex contracts this can be enough to
    // exhaust some solc-bin wasm builds' static heap and crash mid-compile.
    _solcInput.settings = {
      outputSelection: {
        "*": {
          "*": ["storageLayout"],
          "": ["ast"],
        },
      },
    };
    if (advancedOptionsEnabled) {
      if (evmVersion && evmVersion !== "default") {
        //@ts-expect-error evmVersion is not typed in SolcInput settings
        _solcInput.settings.evmVersion = evmVersion;
      }
      if (optimizationEnabled) {
        //@ts-expect-error optimizer is not typed in SolcInput settings
        _solcInput.settings.optimizer = {
          enabled: optimizationEnabled,
          runs: numRuns,
        };
      }
      if (viaIREnabled) {
        // @ts-expect-error viaIR is not typed in SolcInput settings
        _solcInput.settings.viaIR = true;
      }
    }
    setSolcInput(_solcInput);

    // Compile contracts using compiler worker
    const worker = new Worker("/dynSolcWorkerBundle.js");
    worker.addEventListener(
      "message",
      (msg) => {
        if (msg.data.error) {
          setSolcOutput(compilerCrashSolcOutput(msg.data.error));
          setWizardStep(WizardStep.COMPILATION_ERROR);
          worker.terminate();
          return;
        }
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
    worker.addEventListener(
      "error",
      (event) => {
        setSolcOutput(compilerCrashSolcOutput(event.message));
        setWizardStep(WizardStep.COMPILATION_ERROR);
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
  useEffect(() => {
    if (
      wizardStep !== WizardStep.COMPILING_NAMESPACED ||
      solcOutput === undefined
    ) {
      return;
    }
    compileNamespaces();

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
          body: new Uint8Array(_compressedBodyRequest),
        });
        if (!response.ok) {
          throw new Error((await response.json()).message);
        }

        // Parse the response
        const _arrayBuffer = await response.arrayBuffer();
        const _textDecoder = new TextDecoder();
        const _namespacedInput = JSON.parse(_textDecoder.decode(_arrayBuffer));

        // Compile contract using compiler worker
        const worker = new Worker("/dynSolcWorkerBundle.js");
        worker.addEventListener(
          "message",
          (msg) => {
            if (msg.data.error) {
              setSolcOutput(compilerCrashSolcOutput(msg.data.error));
              setWizardStep(WizardStep.COMPILATION_ERROR);
              worker.terminate();
              return;
            }
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
        worker.addEventListener(
          "error",
          (event) => {
            setSolcOutput(compilerCrashSolcOutput(event.message));
            setWizardStep(WizardStep.COMPILATION_ERROR);
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
  }, [
    wizardStep,
    solcOutput,
    solcInput,
    compilerVersion,
    compilerVersions,
    WizardStep.COMPILING_NAMESPACED,
    WizardStep.COMPILATION_ERROR,
    WizardStep.SELECT_CONTRACT,
  ]);

  // Load storage layout function
  async function handleLoadStorageLayout() {
    setWizardStep(WizardStep.LOADING);
    if (!selectedContract || !solcInput || !solcOutput) return;

    // Extract storage layout using backend
    let storageLayout: StorageLayout | undefined = undefined;
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
        body: new Uint8Array(_compressedBodyRequest),
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
          address: undefined,
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

  // A folder-sourced path always contains "/" (from webkitRelativePath or
  // the recursive drop walk); a plain file selection never does. Only offer
  // the folder picker when the current selection didn't already come from
  // one.
  const isFolderSelection = selectedFiles.some((file) =>
    filePathOf(file).includes("/")
  );

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
        <DialogContent className="bg-black border-green-500 p-6 rounded-md max-h-[calc(100vh-2rem)] overflow-x-hidden overflow-y-auto minimal-h-scrollbar-green sm:max-w-xl">
          <DialogHeader className="min-w-0 pr-8">
            <DialogTitle className="text-green-500">
              Upload And Compile Contracts
            </DialogTitle>
            <DialogDescription
              id="upload-dialog-description"
              className="break-words text-green-800"
            >
              Upload one or more Solidity source files, or a whole folder.
              They will be compiled together.
            </DialogDescription>
          </DialogHeader>
          <div className="mx-auto mt-4 flex w-full max-w-lg min-w-0 flex-col gap-4">
            {/* Hidden pickers, kept out of the clickable drop zone below:
                input.click() dispatches its own real, bubbling click event,
                and if these were nested inside that zone's onClick div, the
                synthesized click would bubble straight back into it and
                re-trigger the *other* picker - stopPropagation on the
                originating click can't prevent this since it's a separate,
                later event. */}
            <input
              type="file"
              multiple
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileInputChange}
              accept=".sol"
            />
            <input
              type="file"
              multiple
              ref={(el) => {
                dirInputRef.current = el;
                // webkitdirectory isn't part of React's typed input
                // attributes, so it has to be set imperatively.
                el?.setAttribute("webkitdirectory", "");
              }}
              className="hidden"
              onChange={handleFileInputChange}
            />

            {/* File upload area */}
            <div
              className={`w-full min-w-0 border-2 ${
                isDragging
                  ? "border-green-500 bg-green-900/20"
                  : "border-green-500/50 bg-black"
              } rounded-md p-6 text-center cursor-pointer transition-all duration-300`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={triggerFileInput}
            >
              {selectedFiles.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-green-500 text-sm">
                    Selected {selectedFiles.length} Solidity{" "}
                    {selectedFiles.length === 1 ? "file" : "files"}
                  </p>
                  <div
                    className="max-h-64 space-y-2 overflow-x-hidden overflow-y-auto pr-2 minimal-h-scrollbar-green
                    [&::-webkit-scrollbar]:w-1.5
                    [&::-webkit-scrollbar-track]:bg-transparent
                    [&::-webkit-scrollbar-thumb]:bg-green-500
                    hover:[&::-webkit-scrollbar-thumb]:bg-green-600
                    [&::-webkit-scrollbar-thumb]:rounded-sm"
                  >
                    {selectedFiles.map((file) => {
                      const filePath = filePathOf(file);
                      return (
                        <div
                          className="flex w-full min-w-0 items-center justify-between gap-3 overflow-hidden text-left"
                          key={`${filePath}-${file.lastModified}-${file.size}`}
                        >
                          <div className="flex min-w-0 flex-1 items-center overflow-hidden">
                            <FileIcon className="h-6 w-6 mr-2 shrink-0 text-green-500" />
                            <span
                              className="block min-w-0 flex-1 truncate text-green-500"
                              title={filePath}
                            >
                              {filePath}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFile(file);
                            }}
                            className="shrink-0 text-green-500 hover:text-green-300"
                          >
                            <X className="h-5 w-5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  {selectedFiles.length > 8 && (
                    <p className="text-green-500/50 text-xs">
                      Scroll to review all selected files.
                    </p>
                  )}
                  {!isFolderSelection && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        triggerDirInput();
                      }}
                      className="text-green-500/70 text-xs underline hover:text-green-400"
                    >
                      or select a folder
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <Upload className="h-10 w-10 mb-2 text-green-500" />
                  <p className="text-green-500 mb-1">UPLOAD CONTRACT FILES</p>
                  <p className="text-green-500/70 text-sm">
                    Drag and drop or click to browse
                  </p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      triggerDirInput();
                    }}
                    className="text-green-500/70 text-xs underline hover:text-green-400 mt-2"
                  >
                    or select a folder
                  </button>
                  <p className="text-green-500/50 text-xs mt-2">
                    .sol files supported
                  </p>
                  {noSolidityFilesFound && (
                    <p className="text-red-500 text-xs mt-2">
                      No .sol files found in that selection.
                    </p>
                  )}
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
                className="checkbox-green h-4 w-4 appearance-none rounded border border-green-500 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
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
                      id="optimizer-checkbox"
                      className="checkbox-green h-4 w-4 appearance-none rounded border border-green-500 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                    />
                    <label
                      htmlFor="optimizer-checkbox"
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
                {isViaIRSupported(compilerVersion) && (
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={viaIREnabled}
                      onChange={(e) => setViaIREnabled(e.target.checked)}
                      id="via-ir-checkbox"
                      className={`checkbox-green h-4 w-4 appearance-none rounded border border-green-500 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]`}
                    />
                    <label
                      htmlFor="via-ir-checkbox"
                      className={`text-green-500`}
                    >
                      via-IR
                    </label>
                  </div>
                )}
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
        <DialogContent className="bg-black border-red-500 text-red-500 p-6 rounded-md [&>button]:text-red-500 [&>button:hover]:text-red-500 [&>button:hover]:bg-red-900/30">
          <DialogHeader>
            <DialogTitle className="text-red-500 text-center font-bold">
              Errors during compilation
            </DialogTitle>
            <DialogDescription
              id="upload-dialog-description"
              className="text-red-500"
            >
              {solcOutput && solcOutput.errors && (
                <div
                  className="max-h-60 overflow-y-auto
                                 minimal-h-scrollbar-red
          [&::-webkit-scrollbar]:h-1.5
          [&::-webkit-scrollbar-track]:bg-transparent
          [&::-webkit-scrollbar-thumb]:bg-red-500
          hover:[&::-webkit-scrollbar-thumb]:bg-red-600
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
            <FileX className="h-15 w-15 text-red-500 my-4" />
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
