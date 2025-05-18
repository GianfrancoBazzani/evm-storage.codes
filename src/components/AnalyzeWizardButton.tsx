import { useContext, useState , useEffect } from "react";
import { StorageLayoutsContext } from "../App";
import {
  Upload,
  Loader2,
  FileX,
  ChevronsUpDown,
  Check,
} from "lucide-react";
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

import { cn } from "@/lib/utils";

import type { SolcInput, SolcOutput } from "@openzeppelin/upgrades-core";
import type { Dispatch, SetStateAction } from "react";
import type { StorageLayout } from "@openzeppelin/upgrades-core";

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
    COMPILING,
    COMPILING_NAMESPACED,
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

  // Address management
  // TODO: add data validation with zod
  //const [address, setAddress] = useState<string>("");

  // Compiler management
  const [solcInput, setSolcInput] = useState<SolcInput | undefined>(undefined);
  setSolcInput // TODO Delete
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
  // TODO Add new state variables
  function resetWizardState() {
    setWizardStep(WizardStep.SELECT_ADDRESS);
    setSolcOutput(undefined);
    setCompiledContracts({});
    setSelectedContract(undefined);
  }

  // Handler for dialog open state change.
  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      resetWizardState();
    }
  };

  // TODO Add fetch address compilation artifacts or code

  // Compile Namespaces useEffect
  async function compileNamespaces() {
    try {
      const response = await fetch("/api/get_namespaced_input", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          solcInput: solcInput,
          solcOutput: solcOutput,
          compilerVersion: "compilerVersion", // TODO Get compiler version from Sourcify
        }),
      });
      const json = await response.json();
      const _namespacedInput = json.namespacedInput;

      //  Compile contract using compiler worker
      const worker = new Worker("/dynSolcWorkerBundle.js");
      worker.addEventListener(
        "message",
        (msg) => {
          const _namespacedOutput: SolcOutput = JSON.parse(msg.data.solcOutput);
          setNamespacedOutput(_namespacedOutput);
          if (_namespacedOutput.errors) {
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
        solcBin: "compilerVersions[compilerVersion]", // TODO Get compiler version from Sourcify
      });
    } catch (error) {
      console.error("Error compiling namespaces" + error);
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

    // Extract storage layout
    var storageLayout: StorageLayout | undefined = undefined;

    // Extract storage layout using backend
    try {
      const response = await fetch("/api/extract_storage_layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          solcInput: solcInput,
          solcOutput: solcOutput,
          namespacedOutput: namespacedOutput,
          sourceName: compiledContracts[selectedContract],
          contractName: selectedContract,
        }),
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
          className="bg-green-900/30 text-green-500 border border-green-500 hover:bg-green-600/40 hover:text-green-300 transition-all duration-300 px-8 py-6 text-lg animate-pulse"
          onClick={() => setDialogOpen(true)}
        >
          <Upload className="mr-2 h-4 w-4" /> ANALYZE ADDRESS
        </Button>
      </DialogTrigger>

      {/* Wizard Step 1: Select Network and Address */}
      {wizardStep === WizardStep.SELECT_ADDRESS && (
        <DialogContent className="bg-black border-green-500 p-6 rounded-md">
          <DialogHeader>
            <DialogTitle className="text-green-500">
              Fetch Smart Contract Code
            </DialogTitle>
            <DialogDescription
              id="upload-dialog-description"
              className="text-green-800"
            >
              Select the network and enter the smart contract address to
              retrieve its code from the blockchain.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <label className="block text-green-500 mb-2">Network</label>
            {/**Chain Search popover  TODO STYLIZE PROPERLY CAUTION IN DEV THE MOUSE IS NOT WORKING*/}
            <Popover open={chainsPopoverOpen} onOpenChange={setChainsPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={chainsPopoverOpen}
                  className="w-full justify-between bg-black text-green-500/50 border border-green-500 hover:bg-black hover:text-green-500/50 rounded-md"
                >
                  {chainName
                    ? `${
                        chains.find((_chain) => _chain.name === chainName)
                          ?.name
                      } (Chain Id: ${
                        chains.find((_chain) => _chain.name === chainName)
                          ?.chainId
                      })`
                    : "Search network..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-2 bg-black border border-green-500 rounded-md">
                <Command>
                  <CommandInput
                    placeholder="Search network..."
                    className="p-2 text-green-500 focus:outline-none focus:border-green-700"
                  />
                  <CommandList className="w-full bg-black text-green-500">
                    <CommandEmpty className="bg-black text-green-500 p-2">
                      No network found.
                    </CommandEmpty>
                    <CommandGroup className="w-full bg-black text-green-500">
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
                                ? "opacity-100"
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
              placeholder="Enter contract address"
              className="w-full p-2 border border-green-500 bg-black text-green-500 rounded-md focus:outline-none focus:border-green-700"
            />
            <Button
              //onClick={handleCompile}
              //disabled={selectedFiles.length === 0 || !compilerVersion}
              className="bg-green-900/30 text-green-500 border border-green-500 hover:bg-green-600/40 hover:text-green-300 transition-all duration-300 px-8 py-6 text-lg w-full"
            >
              Fetch Contract Code
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
