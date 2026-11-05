"use client";

import { useState } from "react";
import type { Payer, PayerInput } from "@/src/lib/db/payers";
import SaveButton from "../SaveButton";

export type PayerEditorProps = {
  payer: Payer;
  onSavePayer: (id: string, input: Partial<PayerInput>) => void | Promise<void>;
};

const ROLE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "mom", label: "אמא" },
  { value: "dad", label: "אבא" },
  { value: "other", label: "אחר" },
];

export default function PayerEditor({ payer, onSavePayer }: PayerEditorProps) {
  const [displayName, setDisplayName] = useState(payer.displayName);
  const [role, setRole] = useState(payer.role ?? "mom");
  const [phone, setPhone] = useState(payer.phone ?? "");

  async function handleSave() {
    const update: Partial<PayerInput> = {};
    if (displayName !== payer.displayName) update.displayName = displayName;
    if (role !== (payer.role ?? "mom")) update.role = role;
    if (phone !== (payer.phone ?? "")) update.phone = phone;
    if (Object.keys(update).length > 0) {
      await onSavePayer(payer.id, update);
    }
  }

  return (
    <div className="yd-card yd-pad yd-stack">
      <div className="yd-row">
        <div className="yd-field" style={{ flex: 1 }}>
          <label htmlFor={`payer-name-${payer.id}`}>שם ההורה</label>
          <input
            id={`payer-name-${payer.id}`}
            className="yd-input"
            type="text"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </div>

        <div className="yd-field" style={{ flex: 1 }}>
          <label htmlFor={`payer-role-${payer.id}`}>סוג הקשר</label>
          <select
            id={`payer-role-${payer.id}`}
            className="yd-input"
            value={role}
            onChange={(event) => setRole(event.target.value)}
          >
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="yd-field" style={{ flex: 1 }}>
          <label htmlFor={`payer-phone-${payer.id}`}>טלפון</label>
          <input
            id={`payer-phone-${payer.id}`}
            className="yd-input"
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </div>
      </div>

      <div className="yd-row" style={{ justifyContent: "flex-end" }}>
        <SaveButton onSave={handleSave} />
      </div>
    </div>
  );
}
