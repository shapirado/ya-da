"use client";

import { useState } from "react";

export type SaveButtonProps = {
  onSave: () => void | Promise<void>;
  label?: string;
  className?: string;
};

const SAVED_DURATION_MS = 2000;

// A save button that gives a brief, visible confirmation once onSave
// resolves ("נשמר ✓" for 2s) rather than leaving the user guessing whether
// their change actually took.
export default function SaveButton({ onSave, label = "שמירה", className = "yd-btn primary sm" }: SaveButtonProps) {
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");

  async function handleClick() {
    setStatus("saving");
    try {
      await onSave();
      setStatus("saved");
      setTimeout(() => setStatus("idle"), SAVED_DURATION_MS);
    } catch {
      setStatus("idle");
    }
  }

  return (
    <span className="yd-row" style={{ gap: 8 }}>
      {status === "saved" && (
        <span className="small" style={{ color: "var(--paid-ink)" }} role="status">
          נשמר ✓
        </span>
      )}
      <button type="button" className={className} onClick={handleClick} disabled={status === "saving"}>
        {status === "saving" ? "שומרת..." : label}
      </button>
    </span>
  );
}
