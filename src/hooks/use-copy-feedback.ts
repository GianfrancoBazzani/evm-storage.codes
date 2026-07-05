import { useEffect, useRef, useState } from "react";

type CopyStatus = "copied" | "failed" | null;

/**
 * Transient clipboard-copy feedback for an icon button with a controlled
 * tooltip. Spread `tooltipProps` onto the Tooltip — it keeps the tooltip
 * forced open while feedback is showing — and render `label(idle)` as its
 * content: the idle text normally, "Copied!"/"Copy failed" for `durationMs`
 * after a copy resolves.
 *
 * `copy` resolves the text inside its try/catch, so both text building and
 * the clipboard write surface as "failed". With `optimistic: true` the
 * status flips to "copied" before the write — needed when the click also
 * closes a popover sharing the trigger, so the tooltip's controlled `open`
 * stays true across the popover→tooltip handoff (otherwise there's a
 * microtask gap where both flags are false and the tooltip closes without
 * re-opening); a failure then downgrades the status to "Copy failed".
 */
export function useCopyFeedback(durationMs: number = 3000) {
  const [status, setStatus] = useState<CopyStatus>(null);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  function flash(outcome: "copied" | "failed") {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setStatus(outcome);
    timeoutRef.current = setTimeout(() => setStatus(null), durationMs);
  }

  async function copy(
    getText: () => string,
    { optimistic = false }: { optimistic?: boolean } = {}
  ) {
    if (optimistic) flash("copied");
    try {
      await navigator.clipboard.writeText(getText());
      if (!optimistic) flash("copied");
    } catch {
      flash("failed");
    }
  }

  return {
    copy,
    tooltipProps: {
      open: status !== null || tooltipOpen,
      onOpenChange: setTooltipOpen,
    },
    label(idle: string) {
      return status === "copied"
        ? "Copied!"
        : status === "failed"
          ? "Copy failed"
          : idle;
    },
  };
}
