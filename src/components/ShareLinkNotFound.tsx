import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
      </DialogContent>
    </Dialog>
  );
}
