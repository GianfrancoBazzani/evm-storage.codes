import AnalyzeWizardButton from "@/components/AnalyzeWizardButton";

export type ShareLinkMissKind = "not-cached" | "error" | "invalid";

interface ShareLinkNotFoundProps {
  kind: ShareLinkMissKind;
  chainId: string;
  address: string;
}

const truncateMiddle = (value: string) =>
  value.length > 20 ? `${value.slice(0, 10)}...${value.slice(-8)}` : value;

export default function ShareLinkNotFound({
  kind,
  chainId,
  address,
}: ShareLinkNotFoundProps) {
  const heading =
    kind === "not-cached"
      ? "ERROR 404 — STORAGE LAYOUT NOT FOUND"
      : kind === "error"
        ? "ERROR — STORAGE LAYOUT NOT FOUND"
        : "ERROR — INVALID SHARE LINK";

  return (
    <div className="flex flex-col items-center md:w-xl border border-red-500 text-red-500 mt-6 mx-6 p-6 rounded-lg">
      <span className="mb-4 font-bold">{heading}</span>
      {kind === "invalid" ? (
        <span>
          This link is not valid: address "
          {truncateMiddle(address) || "(missing)"}", chain id "
          {chainId || "(missing)"}".
        </span>
      ) : (
        <>
          <span className="mb-4">
            {kind === "not-cached"
              ? `${truncateMiddle(address)} (Chain Id: ${chainId}) is not in the cache. You can compile and analyze it locally in your browser:`
              : "Couldn't reach the storage layout cache. You can still compile and analyze the contract locally:"}
          </span>
          <AnalyzeWizardButton
            initialChainId={Number(chainId)}
            initialAddress={address}
            triggerLabel="ANALYZE THIS ADDRESS"
          />
        </>
      )}
    </div>
  );
}
