"use client";

import { useState } from "react";

export type MarkPaidInput = {
  month: string;
  amount: number;
  receiptNumber: string;
  method: string;
};

export type MonthRowProps = {
  month: string; // 'YYYY-MM-01'
  due: number;
  onMarkPaid: (input: MarkPaidInput) => void;
};

const HEBREW_MONTHS = [
  "ינואר",
  "פברואר",
  "מרץ",
  "אפריל",
  "מאי",
  "יוני",
  "יולי",
  "אוגוסט",
  "ספטמבר",
  "אוקטובר",
  "נובמבר",
  "דצמבר",
];

export const PAYMENT_METHODS = ["מזומן", "ביט", "פייבוקס", "העברה בנקאית"];

export function monthLabel(month: string): string {
  const index = Number(month.slice(5, 7)) - 1;
  return HEBREW_MONTHS[index] ?? month;
}

export default function MonthRow({ month, due, onMarkPaid }: MonthRowProps) {
  const [open, setOpen] = useState(false);
  const [receiptNumber, setReceiptNumber] = useState("");
  const [method, setMethod] = useState(PAYMENT_METHODS[0]);
  const [error, setError] = useState<string | null>(null);

  function handleOpen() {
    setOpen(true);
  }

  function handleCancel() {
    setOpen(false);
    setError(null);
    setReceiptNumber("");
    setMethod(PAYMENT_METHODS[0]);
  }

  function handleConfirm() {
    const trimmed = receiptNumber.trim();
    if (!trimmed) {
      setError("יש להזין מספר קבלה");
      return;
    }
    setError(null);
    onMarkPaid({ month, amount: due, receiptNumber: trimmed, method });
    setOpen(false);
    setReceiptNumber("");
    setMethod(PAYMENT_METHODS[0]);
  }

  return (
    <div className="yd-month-row">
      <div className="yd-month-row-main yd-row">
        <span className="label">{monthLabel(month)}</span>
        <span className="amt">{due.toLocaleString("he-IL")} ₪</span>
        {!open && (
          <button type="button" className="yd-btn ghost sm" onClick={handleOpen}>
            סמני כשולם
          </button>
        )}
      </div>
      {open && (
        <div className="yd-month-row-form yd-stack">
          <input
            type="text"
            placeholder="מספר קבלה"
            value={receiptNumber}
            onChange={(event) => setReceiptNumber(event.target.value)}
            className="yd-input"
            aria-label="מספר קבלה"
          />
          <select
            value={method}
            onChange={(event) => setMethod(event.target.value)}
            className="yd-input"
            aria-label="אופן תשלום"
          >
            {PAYMENT_METHODS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          {error && (
            <p className="yd-login-error" role="alert">
              {error}
            </p>
          )}
          <div className="yd-row">
            <button type="button" className="yd-btn primary sm" onClick={handleConfirm}>
              אישור
            </button>
            <button type="button" className="yd-btn secondary sm" onClick={handleCancel}>
              ביטול
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
