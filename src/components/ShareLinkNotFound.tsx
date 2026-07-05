import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import AnalyzeWizardButton from "@/components/AnalyzeWizardButton";

export type ShareLinkMissKind = "not-cached" | "error" | "invalid";

interface ShareLinkNotFoundProps {
  kind: ShareLinkMissKind;
  chainId: string;
  address: string;
  onDismiss: () => void;
}

const truncateMiddle = (value: string) =>
  value.length > 20 ? `${value.slice(0, 10)}...${value.slice(-8)}` : value;

export default function ShareLinkNotFound({
  kind,
  chainId,
  address,
  onDismiss,
}: ShareLinkNotFoundProps) {
  const heading =
    kind === "not-cached"
      ? "ERROR 404 — STORAGE LAYOUT NOT FOUND"
      : kind === "error"
        ? "ERROR — STORAGE LAYOUT NOT FOUND"
        : "ERROR — INVALID SHARE LINK";

  // A valid chainId/address just means this specific contract hasn't been
  // compiled and cached before - the user can still generate its layout
  // themselves via the normal wizard, pre-filled so they don't have to
  // re-type the address. An "invalid" link has nothing valid to pre-fill.
  const canGenerate = kind !== "invalid";

  return (
    <Dialog open onOpenChange={(open) => !open && onDismiss()}>
      <DialogContent className="bg-black border-red-500 text-red-500 p-6 [&>button]:text-red-500 [&>button:hover]:text-red-500 [&>button:hover]:bg-red-900/30">
        <DialogHeader>
          <DialogTitle className="text-red-500 text-center font-bold">
            {heading}
          </DialogTitle>
          <DialogDescription className="text-red-500 text-center">
            {kind === "invalid"
              ? `This link is not valid: address "${
                  truncateMiddle(address) || "(missing)"
                }", chain id "${chainId || "(missing)"}".`
              : kind === "not-cached"
                ? `${truncateMiddle(address)} (Chain Id: ${chainId}) is not found.`
                : "Storage layout not found."}
          </DialogDescription>
        </DialogHeader>
        {canGenerate && (
          <div className="flex justify-center">
            <AnalyzeWizardButton
              initialChainId={Number(chainId)}
              initialAddress={address}
              triggerLabel="Generate this storage layout"
              triggerClassName="w-auto max-w-full animate-none whitespace-normal px-5 py-4 text-base leading-tight"
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
