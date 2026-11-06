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
  const [firstName, setFirstName] = useState(payer.firstName ?? "");
  const [lastName, setLastName] = useState(payer.lastName ?? "");
  const [role, setRole] = useState(payer.role ?? "mom");
  const [phone, setPhone] = useState(payer.phone ?? "");
  const [email, setEmail] = useState(payer.email ?? "");

  async function handleSave() {
    const update: Partial<PayerInput> = {};
    if (firstName !== (payer.firstName ?? "")) update.firstName = firstName;
    if (lastName !== (payer.lastName ?? "")) update.lastName = lastName;
    if (role !== (payer.role ?? "mom")) update.role = role;
    if (phone !== (payer.phone ?? "")) update.phone = phone;
    if (email !== (payer.email ?? "")) update.email = email;

    // Keep display_name (the exact-match key used to auto-resolve incoming
    // Morning receipts) in sync whenever the structured name changes.
    const joined = [firstName, lastName].filter(Boolean).join(" ").trim();
    if (joined && joined !== payer.displayName) update.displayName = joined;

    if (Object.keys(update).length > 0) {
      await onSavePayer(payer.id, update);
    }
  }

  return (
    <div className="yd-card yd-pad yd-stack">
      <div className="yd-row">
        <div className="yd-field" style={{ flex: 1 }}>
          <label htmlFor={`payer-first-name-${payer.id}`}>שם פרטי</label>
          <input
            id={`payer-first-name-${payer.id}`}
            className="yd-input"
            type="text"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
          />
        </div>

        <div className="yd-field" style={{ flex: 1 }}>
          <label htmlFor={`payer-last-name-${payer.id}`}>שם משפחה</label>
          <input
            id={`payer-last-name-${payer.id}`}
            className="yd-input"
            type="text"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
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
      </div>

      <div className="yd-row">
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

        <div className="yd-field" style={{ flex: 1 }}>
          <label htmlFor={`payer-email-${payer.id}`}>אימייל</label>
          <input
            id={`payer-email-${payer.id}`}
            className="yd-input"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
      </div>

      <div className="yd-row" style={{ justifyContent: "flex-end" }}>
        <SaveButton onSave={handleSave} />
      </div>
    </div>
  );
}
