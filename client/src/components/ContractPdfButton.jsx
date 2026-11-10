import React, { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFilePdf } from "@fortawesome/free-solid-svg-icons";
import { apiErrorMessage, downloadPdf } from "../lib/contractFiles.js";

// "Contract PDF" button: one click downloads this lease's contract, built from
// the landlord's contract template and the lease's own details. Nothing to fill
// in. If a detail isn't on record yet (like the tenant's address) that spot is
// left as a blank line and we say which one, so it can be added for next time.
//   variant="button" - text button (default), "icon" - compact icon only.
export default function ContractPdfButton({
  contractId,
  variant = "button",
  className = "",
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [missing, setMissing] = useState([]);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const download = async () => {
    setError("");
    setMissing([]);
    clearTimeout(timer.current);
    setBusy(true);
    try {
      const result = await downloadPdf({
        url: `/contracts/${contractId}/pdf`,
        fallbackName: "Lease-Contract.pdf",
      });
      if (result.missing.length) {
        setMissing(result.missing);
        timer.current = setTimeout(() => setMissing([]), 14000);
      }
    } catch (err) {
      setError(await apiErrorMessage(err, "Could not create the PDF."));
    } finally {
      setBusy(false);
    }
  };

  const base =
    variant === "icon"
      ? "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line text-ink/70 hover:bg-canvas disabled:opacity-50"
      : "inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium hover:bg-canvas disabled:opacity-50";

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={download}
        disabled={busy}
        title="Download contract as PDF"
        aria-label="Download contract as PDF"
        className={`${base} ${className}`}
      >
        <FontAwesomeIcon
          icon={faFilePdf}
          className={variant === "icon" ? "text-sm" : "text-[11px]"}
        />
        {variant !== "icon" && (busy ? "Preparing\u2026" : "Contract PDF")}
      </button>
      {missing.length > 0 && (
        <span className="max-w-[18rem] text-right text-[11px] leading-4 text-ink/60">
          Downloaded. Left blank: {missing.join(", ")}. Add{" "}
          {missing.length === 1 ? "it" : "them"} in the tenant, property or
          Settings details to fill {missing.length === 1 ? "it" : "them"} in
          automatically.
        </span>
      )}
      {error && (
        <span className="max-w-[16rem] text-right text-[11px] text-status-overdue">
          {error}
        </span>
      )}
    </span>
  );
}
