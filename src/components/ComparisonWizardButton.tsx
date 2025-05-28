import { useContext, useState } from "react";
import { StorageLayoutsContext } from "../App";
import { GitCompareArrows, CircleX, Loader2 } from "lucide-react";
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

import type { StorageVisualizerProps } from "@/components/StorageVisualizer";

export default function ComparisonWizardButton() {
  // Global context
  const storageLayoutsContext = useContext(StorageLayoutsContext);
  if (!storageLayoutsContext) {
    throw new Error("StorageLayoutsContext is undefined");
  }
  const { storageLayouts } = storageLayoutsContext;

  // New state to control the dialog's open/close state.
  const [dialogOpen, setDialogOpen] = useState(false);

  // Wizard step
  enum WizardStep {
    SELECT_STORAGE_LAYOUTS,
    COMPARING,
    REPORT,
    COMPARING_ERROR,
  }
  const [wizardStep, setWizardStep] = useState<WizardStep>(
    WizardStep.SELECT_STORAGE_LAYOUTS
  );

  // Storage layouts to compare management
  const [originStorageLayout, setOriginStorageLayout] = useState<
    StorageVisualizerProps | undefined
  >(undefined);
  const [destinationStorageLayout, setDestinationStorageLayout] = useState<
    StorageVisualizerProps | undefined
  >(undefined);

  // Compatibility report
  const [compatibilityReport, setCompatibilityReport] = useState<
    string | undefined
  >(undefined);
  const [compatibilityReportErrors, setCompatibilityReportErrors] = useState<
    string | undefined
  >(undefined);

  // Function to reset wizard state when the dialog is closed.
  function resetWizardState() {
    setWizardStep(WizardStep.SELECT_STORAGE_LAYOUTS);
    setOriginStorageLayout(undefined);
    setDestinationStorageLayout(undefined);
    setCompatibilityReport(undefined);
    setCompatibilityReportErrors(undefined);
  }

  // Handler for dialog open state change.
  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      resetWizardState();
    }
  };

  // Fetch artifacts from Sourcify
  async function handleCompareStorageLayouts() {
    setWizardStep(WizardStep.COMPARING);
    const response = await fetch("/api/get_compatibility_report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        originStorageLayout: originStorageLayout?.storageLayout,
        destinationStorageLayout: destinationStorageLayout?.storageLayout,
      }),
    });
    if (!response.ok) {
      const data = await response.json();
      setCompatibilityReportErrors(
        data.message || "An error occurred while generating the report."
      );
      setWizardStep(WizardStep.COMPARING_ERROR);
      return;
    }
    const { compatibilityReport } = await response.json();
    setCompatibilityReport(compatibilityReport);
    console.log(compatibilityReport);
    setWizardStep(WizardStep.REPORT);
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          disabled={storageLayouts.length < 2}
          className={`h-6 w-6 ${
            storageLayouts.length < 2
              ? "text-green-300 cursor-not-allowed"
              : "text-green-500 hover:bg-green-900/30 hover:text-green-500 hover:rounded"
          }`}
          onClick={() => setDialogOpen(true)}
        >
          <GitCompareArrows className="h-3 w-3" />
        </Button>
      </DialogTrigger>

      {/* Wizard Step 1: Select Storage Layouts To compare */}
      {wizardStep === WizardStep.SELECT_STORAGE_LAYOUTS && (
        <DialogContent className="flex w-full flex-col bg-black border-green-500 p-6 rounded-md">
          <DialogHeader>
            <DialogTitle className="text-green-500">
              Select Storage Layouts to Compare
            </DialogTitle>
            <DialogDescription
              id="upload-dialog-description"
              className="text-green-800"
            >
              Select two storage layouts to compare their structures and
              generate a compatibility report
            </DialogDescription>
          </DialogHeader>
          <div className=" flex flex-col w-full space-y-4">
            <label className="flex w-full text-green-500 mb-2">
              Origin Layout
            </label>
            <Select
              onValueChange={(storageLayoutId) => {
                const selectedLayout = storageLayouts.find(
                  (layout) => layout.id.toString() === storageLayoutId
                );
                setOriginStorageLayout(selectedLayout);
              }}
            >
              <SelectTrigger className="w-full text-green-500 border-green-500 data-[placeholder]:text-green-500/50 cursor-pointer">
                <SelectValue placeholder="Select Version" />
              </SelectTrigger>
              <SelectContent
                side="bottom"
                avoidCollisions={false}
                className="bg-black border-green-500 text-green-500 max overflow-y-auto"
              >
                {storageLayouts.map(
                  (storageLayout) =>
                    storageLayout !== destinationStorageLayout && (
                      <SelectItem
                        className="focus:bg-green-700 focus:border focus:border-green-950"
                        key={storageLayout.id.toString()}
                        value={storageLayout.id.toString()}
                      >
                        {storageLayout.contractName}
                      </SelectItem>
                    )
                )}
              </SelectContent>
            </Select>
            <label className="flex w-full text-green-500 mb-2">
              Destination Layout
            </label>
            <Select
              onValueChange={(storageLayoutId) => {
                const selectedLayout = storageLayouts.find(
                  (layout) => layout.id.toString() === storageLayoutId
                );
                setDestinationStorageLayout(selectedLayout);
              }}
            >
              <SelectTrigger className="w-full text-green-500 border-green-500 data-[placeholder]:text-green-500/50 cursor-pointer">
                <SelectValue placeholder="Select Version" />
              </SelectTrigger>
              <SelectContent
                side="bottom"
                avoidCollisions={false}
                className="bg-black border-green-500 text-green-500 max overflow-y-auto"
              >
                {storageLayouts.map(
                  (storageLayout) =>
                    storageLayout !== originStorageLayout && (
                      <SelectItem
                        className="focus:bg-green-700 focus:border focus:border-green-950"
                        key={storageLayout.id.toString()}
                        value={storageLayout.id.toString()}
                      >
                        {storageLayout.contractName}
                      </SelectItem>
                    )
                )}
              </SelectContent>
            </Select>
            <Button
              onClick={handleCompareStorageLayouts}
              disabled={!originStorageLayout || !destinationStorageLayout}
              className="bg-green-900/30 text-green-500 border border-green-500 hover:bg-green-600/40 hover:text-green-300 transition-all duration-300 px-8 py-6 text-lg w-full"
            >
              Compare Storage Layouts
            </Button>
          </div>
        </DialogContent>
      )}

      {/* Wizard Step 2: Generating Report Spinner */}
      {wizardStep === WizardStep.COMPARING && (
        <DialogContent className="bg-black border-green-500 p-6 rounded-md">
          <DialogHeader>
            <DialogTitle className="text-green-500">
              Generation Storage Compatibility Report
            </DialogTitle>
            <DialogDescription
              id="upload-dialog-description"
              className="text-green-800"
            >
              Please wait while your compatibility report is being generated
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center">
            <Loader2 className="animate-spin h-20 w-20 text-green-500 my-8" />
          </div>
        </DialogContent>
      )}

      {/* Wizard Step 3: Compatibility report display */}
      {wizardStep === WizardStep.REPORT && (
        <DialogContent className="bg-black border-green-500 p-6 rounded-md sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="text-green-500">
              Storage Layout Compatibility Report
            </DialogTitle>
            <DialogDescription
              id="upload-dialog-description"
              className="text-green-500"
            >
              <div
                className=" max-h-96 overflow-y-auto minimal-h-scrollbar-green mt-4 
              [&::-webkit-scrollbar]:h-1.5
              [&::-webkit-scrollbar-track]:bg-transparent
              [&::-webkit-scrollbar-thumb]:bg-green-500
              hover:[&::-webkit-scrollbar-thumb]:bg-green-600
              [&::-webkit-scrollbar-thumb]:rounded-sm"
              >
                {compatibilityReport ? (
                  <>
                    <p className="mb-2">
                      Following compatibility issues have been found:
                    </p>
                    {compatibilityReport
                      .split(/\n\s*\n/)
                      .map((paragraph, index) => (
                        <span key={index} className=" mb-2 text-red-500">
                          {paragraph.split(">").map((line, lineIndex) => (
                            <p key={lineIndex}>
                              {lineIndex === 0
                                ? `${index} : ${line}`
                                : ` - ${line}`}
                            </p>
                          ))}
                          <br />
                        </span>
                      ))}
                  </>
                ) : (
                  <p> No compatibility issues found.</p>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      )}

      {/* Wizard Step 4: Compatibility report errors */}
      {wizardStep === WizardStep.COMPARING_ERROR && (
        <DialogContent className="bg-black border-green-500 p-6 rounded-md">
          <DialogHeader>
            <DialogTitle className="text-green-500">
              Errors while generating the report
            </DialogTitle>
            <DialogDescription
              id="upload-dialog-description"
              className="text-green-800"
            >
              <p className="block text-red-500">{compatibilityReportErrors}</p>
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center">
            <CircleX className="h-15 w-15 text-green-500 my-4" />
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
