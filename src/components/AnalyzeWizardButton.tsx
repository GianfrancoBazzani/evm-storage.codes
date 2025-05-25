import { useContext, useState, useEffect } from "react";
import { StorageLayoutsContext } from "../App";
import { Upload, Loader2, FileX, ChevronsUpDown, Check } from "lucide-react";
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
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  MIN_COMPATIBLE_SOLC_VERSION,
  MIN_NAMESPACED_COMPATIBLE_SOLC_VERSION,
  BROTLI_QUALITY,
} from "@/lib/constants";
import { z } from "zod";
import { cn } from "@/lib/utils";
import * as versions from "compare-versions";
import brotliPromise from "brotli-wasm";

import type { SolcInput, SolcOutput } from "@openzeppelin/upgrades-core";
import type { Dispatch, SetStateAction } from "react";
import type { StorageLayout } from "@openzeppelin/upgrades-core";
import type { ReactNode } from "react";

const ethAddressSchema = z
  .string()
  .length(42, {
    message: "Must be exactly 42 characters long including leading '0x'",
  })
  .regex(/^0x[0-9a-fA-F]*$/, {
    message: "Must contain only hexadecimal characters",
  });

interface AnalyzeWizardButtonProps {
  setParentDialogOpen?: Dispatch<SetStateAction<boolean>>;
  triggerVisualizerId?: number;
}

export default function AnalyzeWizardButton({
  setParentDialogOpen = undefined,
  triggerVisualizerId = undefined,
}: AnalyzeWizardButtonProps) {
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
    SELECT_ADDRESS,
    FETCHING,
    COMPILING,
    COMPILING_NAMESPACED,
    FETCHING_ERROR,
    COMPILATION_ERROR,
    SELECT_CONTRACT,
    LOADING,
    LOADING_ERROR,
  }
  const [wizardStep, setWizardStep] = useState<WizardStep>(
    WizardStep.SELECT_ADDRESS
  );

  // Chains management
  interface Chain {
    name: string;
    chainId: number;
    rpc: string[];
    traceSupportedRPCs: string[];
    supported: boolean;
    etherscanAPI: string;
  }

  // Chain management
  const [chains, setChains] = useState<Array<Chain>>([]);
  const [chainsPopoverOpen, setChainsPopoverOpen] = useState<boolean>(false);
  const [chainName, setChainName] = useState<string | undefined>();

  const handleChainSelect = (newChain: string) => {
    setChainName(newChain);
    setChainsPopoverOpen(false);
  };

  // Fetch chains useEffect
  async function fetchChains() {
    try {
      fetch("https://sourcify.dev/server/chains")
        .then((res) => res.json())
        .then((arr) => {
          setChains(arr);
        });
    } catch (error) {
      console.error("Error fetching compilers:", error);
    }
  }
  useEffect(() => {
    fetchChains();
  }, []);

  // Address management with zod validation
  const [address, setAddress] = useState<string | undefined>(undefined);
  const [addressError, setAddressError] = useState<string | undefined>(
    undefined
  );
  const validateAddress = (addr: string) => {
    const result = ethAddressSchema.safeParse(addr);
    if (!result.success) {
      setAddressError(result.error.errors[0].message);
    } else {
      setAddressError(undefined);
    }
  };

  // Compiler management
  const [compilerBinary, setCompilerBinary] = useState<string>("");
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

  // Verification status
  interface VerificationStatus {
    match: "match" | "exact_match" | null;
    creationMatch: "match" | "exact_match" | null;
    runtimeMatch: "match" | "exact_match" | null;
    isExactMatch: boolean;
  }
  const [verificationStatus, setVerificationStatus] =
    useState<VerificationStatus>({
      match: null,
      creationMatch: null,
      runtimeMatch: null,
      isExactMatch: false,
    });

  // Storage layout loader management
  const [selectedContract, setSelectedContract] = useState<string | undefined>(
    undefined
  );

  // Errors
  const [fetchArtifactsError, setFetchArtifactsError] = useState<
    string | ReactNode
  >("");
  const [storageLayoutLoadingError, setStorageLayoutLoadingError] =
    useState<string>("");

  // Function to reset wizard state when the dialog is closed.
  function resetWizardState() {
    setWizardStep(WizardStep.SELECT_ADDRESS);
    setCompiledContracts({});
    setChainsPopoverOpen(false);
    setChainName(undefined);
    setAddress(undefined);
    setCompilerBinary("");
    setSolcInput(undefined);
    setSolcOutput(undefined);
    setNamespacedOutput(undefined);
    setCompiledContracts({});
    setVerificationStatus({
      match: null,
      creationMatch: null,
      runtimeMatch: null,
      isExactMatch: false,
    });
    setSelectedContract(undefined);
  }

  // Handler for dialog open state change.
  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      resetWizardState();
    }
  };

  // Fetch artifacts from Sourcify
  async function handleFetchArtifactsAndCompile() {
    setWizardStep(WizardStep.FETCHING);

    const chainId = chains.find((_chain) => _chain.name === chainName)?.chainId;
    const response = await fetch(
      `https://sourcify.dev/server/v2/contract/${chainId}/${address}?fields=stdJsonInput,compilation`,
      {
        method: "GET",
      }
    );
    if (!response.ok) {
      if (response.status === 404) {
        const data = await response.json();
        setFetchArtifactsError(
          <>
            {`Contract at ${data.address} on chain id ${data.chainId} not verified on Sourcify. Please verify your contract using the `}
            <a
              href="https://sourcify.dev/#/verifier"
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-500 underline"
            >
              Sourcify Verifier
            </a>
            {". "}
          </>
        );
      } else {
        setFetchArtifactsError((await response.json()).message);
      }
      setWizardStep(WizardStep.FETCHING_ERROR);
      return;
    }

    const {
      stdJsonInput,
      compilation,
      match: _match,
      creationMatch: _creationMatch,
      runtimeMatch: _runtimeMatch,
    } = await response.json();

    if (stdJsonInput.language !== "Solidity") {
      setFetchArtifactsError(
        "Only Solidity contracts are supported at the moment"
      );
      setWizardStep(WizardStep.FETCHING_ERROR);
      return;
    }

    // Check compiler version
    const compilerVersionSemVer =
      compilation.compilerVersion.match(/^(\d+\.\d+\.\d+)/)?.[1] ?? "";
    if (
      versions.compare(compilerVersionSemVer, MIN_COMPATIBLE_SOLC_VERSION, "<")
    ) {
      setFetchArtifactsError(
        `Contract code has been verified using compiler version ${compilerVersionSemVer}, which is not supported. The minimum compatible version is ${MIN_COMPATIBLE_SOLC_VERSION}.`
      );
      setWizardStep(WizardStep.FETCHING_ERROR);
      return;
    }

    // Prepare compilation input
    const _compilerBinary = `solc-emscripten-wasm32-v${compilation.compilerVersion}.js`;
    const _solcInput: SolcInput = stdJsonInput;
    _solcInput.settings = _solcInput.settings || {};
    _solcInput.settings.outputSelection = {
      "*": {
        "*": ["*"],
        "": ["ast"],
      },
    };

    setSolcInput(stdJsonInput);
    setCompilerBinary(_compilerBinary);
    setVerificationStatus({
      match: _match,
      creationMatch: _creationMatch,
      runtimeMatch: _runtimeMatch,
      isExactMatch:
        _creationMatch === "exact_match" || _runtimeMatch === "exact_match",
    });

    // Compile contracts using compiler worker
    setWizardStep(WizardStep.COMPILING);
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
          const _compilerVersionSemver =
            _compilerBinary.match(/v(\d+\.\d+\.\d+)/)?.[1];
          if (
            _compilerVersionSemver &&
            versions.compare(
              _compilerVersionSemver,
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
      solcBin: _compilerBinary,
    });
  }

  // Compile Namespaces useEffect
  async function compileNamespaces() {
    try {
      // To avoid FUNCTION_PAYLOAD_TOO_LARGE compress the  data using brotli
      const _brotli = await brotliPromise;
      const _textEncoder = new TextEncoder();
      const _compilerVersionSemver =
        compilerBinary.match(/v(\d+\.\d+\.\d+)/)?.[1];
      const _uncompressedBodyRequest = _textEncoder.encode(
        JSON.stringify({
          solcInput: solcInput,
          solcOutput: solcOutput,
          compilerVersion: _compilerVersionSemver,
        })
      );
      const _compressedBodyRequest = _brotli.compress(
        _uncompressedBodyRequest,
        {
          quality: BROTLI_QUALITY,
        }
      );

      // Generate namespaced compiler input in the backend
      const response = await fetch("/api/get_namespaced_input", {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
        },
        body: _compressedBodyRequest,
      });
      if (!response.ok) {
        throw new Error((await response.json()).message);
      }
      
      // Decode the response
      const _arrayBuffer = await response.arrayBuffer();
      const _textDecoder = new TextDecoder();
      const _namespacedInput = JSON.parse(
        _textDecoder.decode(_arrayBuffer)
      );

      //  Compile contract using compiler worker
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
        solcBin: compilerBinary,
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
        headers: {
          "Content-Type": "application/octet-stream",
        },
        body: _compressedBodyRequest,
      });
      if (!response.ok) {
        throw new Error((await response.json()).message);
      }
      const json = await response.json();
      storageLayout = json.storageLayout;
    } catch (error) {
      setStorageLayoutLoadingError("Error loading storage layout" + error);
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
          <Upload className="mr-2 h-4 w-4" /> ANALYZE ADDRESS
        </Button>
      </DialogTrigger>

      {/* Wizard Step 1: Select Network and Address */}
      {wizardStep === WizardStep.SELECT_ADDRESS && (
        <DialogContent className="flex w-full flex-col bg-black border-green-500 p-6 rounded-md">
          <DialogHeader>
            <DialogTitle className="text-green-500">
              Fetch Smart Contract Code
            </DialogTitle>
            <DialogDescription
              id="upload-dialog-description"
              className="text-green-800"
            >
              Select the network and enter the smart contract address to retrieve its code from the blockchain.
            </DialogDescription>
          </DialogHeader>
          <div className=" flex flex-col w-full space-y-4 mt-4">
            <label className="flex w-full text-green-500 mb-2">Network</label>
            <Popover open={chainsPopoverOpen} onOpenChange={setChainsPopoverOpen}>
              <PopoverTrigger className="flex l" asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={chainsPopoverOpen}
                  className="flex max-w-full overflow-hidden truncate h-10 justify-between text-base bg-black border border-green-500 hover:bg-black rounded-md p-2"
                >
                  <span className={`flex max-w-full overflow-hidden ${chainName ? "text-green-500" : "text-green-500/50"} `}>
                    {chainName
                      ? `${
                          chains.find((_chain) => _chain.name === chainName)
                            ?.name
                        } (Chain Id: ${
                          chains.find((_chain) => _chain.name === chainName)
                            ?.chainId
                        })`
                      : "Search network..."}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-2 text-base bg-black border border-green-500 rounded-md">
                <Command>
                  <CommandInput
                    placeholder="Search network..."
                    className="p-2 focus:outline-none focus:border-green-700 !placeholder-green-500/50 text-green-500"
                  />
                  <CommandList className="w-[var(--radix-popover-trigger-width)] min-w-full bg-black text-green-500">
                    <CommandEmpty className="bg-black text-green-500 p-2">
                      No network found.
                    </CommandEmpty>
                    <CommandGroup className="bg-black text-green-500">
                      {chains.map((_chain) => (
                        <CommandItem
                          key={_chain.chainId}
                          value={_chain.name}
                          onSelect={handleChainSelect}
                          className="bg-black text-green-500 hover:bg-green-600/40 focus:bg-green-700 focus:border focus:border-green-950 px-2 py-1"
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              chains.find((_chain) => _chain.name === chainName)
                                ?.name === _chain.name
                                ? "opacity-100 text-green-500"
                                : "opacity-0"
                            )}
                          />
                          <span className="truncate">{`${_chain.name} (Chain Id: ${_chain.chainId})`}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <label className="block text-green-500 mb-2">Address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => {
                setAddress(e.target.value);
                validateAddress(e.target.value);
              }}
              placeholder="Enter contract address"
              className="w-full p-2 border border-green-500 bg-black text-green-500 rounded-md focus:outline-none focus:border-green-700 !placeholder-green-500/50"
            />
            {addressError && (
              <p className="text-red-500 text-sm mt-1">{addressError}</p>
            )}
            <Button
              onClick={handleFetchArtifactsAndCompile}
              disabled={!chainName || !address}
              className="bg-green-900/30 text-green-500 border border-green-500 hover:bg-green-600/40 hover:text-green-300 transition-all duration-300 px-8 py-6 text-lg w-full"
            >
              Fetch Contract Code
            </Button>
          </div>
        </DialogContent>
    )}

      {/* Wizard Step 2: Fetching Spinner */}
      {wizardStep === WizardStep.FETCHING && (
        <DialogContent className="bg-black border-green-500 p-6 rounded-md">
          <DialogHeader>
            <DialogTitle className="text-green-500">
              Fetching sources from Sourcify
            </DialogTitle>
            <DialogDescription
              id="upload-dialog-description"
              className="text-green-800"
            >
              Please wait while your contract source files are being fetched
              from sourcify
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center">
            <Loader2 className="animate-spin h-20 w-20 text-green-500 my-8" />
          </div>
        </DialogContent>
      )}

      {/* Wizard Step 3: Compilation Spinner */}
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
              {
                //@ts-ignore
                solcInput?.settings?.optimizer?.enabled && (
                  <p>
                    Compilation might take a while because the optimizer is
                    enabled.
                  </p>
                )
              }
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center">
            <Loader2 className="animate-spin h-20 w-20 text-green-500 my-8" />
          </div>
        </DialogContent>
      )}

      {/* Wizard Step 4: Compilation Namespaces Spinner */}
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

      {/* Wizard Step 5: Fetching from Sourcify Errors */}
      {wizardStep === WizardStep.FETCHING_ERROR && (
        <DialogContent className="bg-black border-green-500 p-6 rounded-md">
          <DialogHeader>
            <DialogTitle className="text-green-500">
              Errors while fetching the contract artifacts from Sourcify
            </DialogTitle>
            <DialogDescription
              id="upload-dialog-description"
              className="text-green-800"
            >
              <span className="text-red-500">{fetchArtifactsError}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center">
            <FileX className="h-15 w-15 text-green-500 my-4" />
          </div>
        </DialogContent>
      )}

      {/* Wizard Step 6: Compilation Errors */}
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

      {/* Wizard Step 7: Contract Selection with verification status tooltips */}
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
            <div className="flex flex-col justify-between mb-2 ">
              <label className="block text-green-500 mb-2 bg-red">
                Sourcify Verification Status
              </label>
              <div className="flex flex-col md:flex-row items-start md:items-center  mb-2 gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge>
                      {verificationStatus.isExactMatch
                        ? "Exact Match"
                        : "Match"}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent className="bg-black border-green-500 border text-green-500 px-3 py-1 rounded-md shadow-md text-xs transition-colors duration-200 max-w-[350px]">
                    {verificationStatus.isExactMatch
                      ? "Exact match: The onchain and compiled bytecode match exactly, including the metadata hashes"
                      : "Match: The onchain and compiled bytecode match, but metadata hashes differ or don't exist"}
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant={
                        verificationStatus.runtimeMatch
                          ? "default"
                          : "destructive"
                      }
                    >
                      Runtime Bytecode
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent className="bg-black border-green-500 border text-green-500  px-3 py-1 rounded-md shadow-md text-xs transition-colors duration-200 max-w-[350px]">
                    {verificationStatus.runtimeMatch
                      ? "Contract matched with runtime bytecode"
                      : "Contract not matched with runtime bytecode"}
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant={
                        verificationStatus.creationMatch
                          ? "default"
                          : "destructive"
                      }
                    >
                      Creation Bytecode
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent className="bg-black border-green-500 border text-green-500 px-3 py-1 rounded-md shadow-md text-xs transition-colors duration-200 max-w-[350px]">
                    {verificationStatus.creationMatch
                      ? "Contract matched with creation bytecode"
                      : "Contract not matched with creation bytecode"}
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
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

      {/* Wizard Step 8: Loading Spinner */}
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

      {/* Wizard Step 9: Storage Layout Loading error */}
      {wizardStep === WizardStep.LOADING_ERROR && (
        <DialogContent className="bg-black border-green-500 p-6 rounded-md">
          <DialogHeader>
            <DialogTitle className="text-green-500">
              Errors storage layout loading
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
