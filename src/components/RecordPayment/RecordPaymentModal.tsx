"use client";

import { useMemo, useState } from "react";

export type RecordPaymentChild = {
  id: string;
  name: string;
};

export type RecordPaymentFamily = {
  id: string;
  displayName: string;
};

export type RecordPaymentLine = {
  childId: string;
  month: string;
  amount: null;
};

// Shape handed to onSubmit. The whole-receipt amount is recorded as entered;
// it is NOT auto-split across the selected child/month cells. Per-line
// amounts stay null here and are only ever set later, when whoever resolves
// an ambiguous receipt enters them explicitly.
export type CreateReceiptInput = {
  payerId?: string;
  amount: number;
  date: string; // ddmmyyyy
  method: string;
  paidBy: string;
  receiptNumber: string;
  lines: RecordPaymentLine[];
};

export type RecordPaymentModalProps = {
  families?: RecordPaymentFamily[];
  childrenByPayer?: Record<string, RecordPaymentChild[]>;
  payerChildren?: RecordPaymentChild[];
  months?: string[];
  initial?: { childId?: string; month?: string; payerId?: string };
  onSubmit: (input: CreateReceiptInput) => void;
  onClose?: () => void;
  // Error from the caller's submit handler (e.g. the server action failed),
  // shown alongside this modal's own client-side validation errors.
  error?: string | null;
};

export const PAYMENT_METHODS = ["ביט", "פייבוקס", "העברה בנקאית", "מזומן"];

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

function monthLabel(month: string): string {
  const index = Number(month.slice(5, 7)) - 1;
  return HEBREW_MONTHS[index] ?? month;
}

function defaultMonths(): string[] {
  const now = new Date();
  const months: string[] = [];
  for (let offset = -6; offset <= 1; offset += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`);
  }
  return months;
}

function todayDdmmyyyy(): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  return `${dd}${mm}${now.getFullYear()}`;
}

const ERROR_NO_CELLS = "יש לבחור חודש אחד לפחות";
const ERROR_NO_AMOUNT = "יש להזין סכום";

export default function RecordPaymentModal({
  families,
  childrenByPayer,
  payerChildren,
  months,
  initial,
  onSubmit,
  onClose,
  error: submitError,
}: RecordPaymentModalProps) {
  const showFamilySelect = !payerChildren && !!families && families.length > 0;

  const [selectedPayerId, setSelectedPayerId] = useState<string>(
    initial?.payerId ?? families?.[0]?.id ?? "",
  );

  const children = payerChildren ?? childrenByPayer?.[selectedPayerId] ?? [];
  const monthList = useMemo(() => months ?? defaultMonths(), [months]);

  const [selectedCells, setSelectedCells] = useState<Record<string, Set<string>>>(() => {
    if (initial?.childId && initial?.month) {
      return { [initial.childId]: new Set([initial.month]) };
    }
    return {};
  });
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayDdmmyyyy());
  const [method, setMethod] = useState(PAYMENT_METHODS[0]);
  const [paidBy, setPaidBy] = useState("");
  const [receiptNumber, setReceiptNumber] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleFamilyChange(payerId: string) {
    setSelectedPayerId(payerId);
    setSelectedCells({});
  }

  function toggleCell(childId: string, month: string) {
    setSelectedCells((prev) => {
      const next: Record<string, Set<string>> = { ...prev };
      const current = new Set(next[childId] ?? []);
      if (current.has(month)) {
        current.delete(month);
      } else {
        current.add(month);
      }
      if (current.size === 0) {
        delete next[childId];
      } else {
        next[childId] = current;
      }
      return next;
    });
  }

  function buildLines(): RecordPaymentLine[] {
    const lines: RecordPaymentLine[] = [];
    for (const [childId, monthsSet] of Object.entries(selectedCells)) {
      for (const month of monthsSet) {
        lines.push({ childId, month, amount: null });
      }
    }
    return lines;
  }

  function handleSubmit() {
    const lines = buildLines();
    if (lines.length === 0) {
      setError(ERROR_NO_CELLS);
      return;
    }

    const numericAmount = Number(amount);
    if (!amount.trim() || Number.isNaN(numericAmount)) {
      setError(ERROR_NO_AMOUNT);
      return;
    }

    setError(null);
    onSubmit({
      payerId: selectedPayerId || undefined,
      amount: numericAmount,
      date,
      method,
      paidBy,
      receiptNumber,
      lines,
    });
  }

  return (
    <div className="yd-scrim" role="dialog" aria-modal="true" aria-label="רישום תשלום">
      <div className="yd-modal">
        <div className="hd">
          <h2 className="yd-title">רישום תשלום</h2>
          {onClose && (
            <button type="button" className="yd-btn ghost sm" onClick={onClose}>
              סגירה
            </button>
          )}
        </div>

        <div className="bd yd-stack">
          {showFamilySelect && (
            <div className="yd-field">
              <label htmlFor="record-payment-family">משפחה</label>
              <select
                id="record-payment-family"
                className="yd-input"
                value={selectedPayerId}
                onChange={(event) => handleFamilyChange(event.target.value)}
              >
                {families!.map((family) => (
                  <option key={family.id} value={family.id}>
                    {family.displayName}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="yd-payment-grid">
            <div className="yd-payment-grid-row yd-payment-grid-head">
              <span />
              {monthList.map((month) => (
                <span key={month} className="small muted">
                  {monthLabel(month)}
                </span>
              ))}
            </div>
            {children.map((child) => (
              <div key={child.id} className="yd-payment-grid-row">
                <span>{child.name}</span>
                {monthList.map((month) => {
                  const selected = selectedCells[child.id]?.has(month) ?? false;
                  return (
                    <button
                      key={month}
                      type="button"
                      data-testid={`cell-${child.id}-${month}`}
                      aria-pressed={selected}
                      aria-label={`${child.name} ${monthLabel(month)}`}
                      className={`yd-payment-cell${selected ? " selected" : ""}`}
                      onClick={() => toggleCell(child.id, month)}
                    >
                      {selected ? "✓" : ""}
                    </button>
                  );
                })}
              </div>
            ))}
            {children.length === 0 && <p className="small muted">בחרי משפחה כדי לראות ילדים</p>}
          </div>

          <div className="yd-field">
            <label htmlFor="record-payment-amount">סכום</label>
            <input
              id="record-payment-amount"
              className="yd-input"
              type="number"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              aria-label="סכום"
            />
          </div>

          <div className="yd-field">
            <label htmlFor="record-payment-date">תאריך</label>
            <input
              id="record-payment-date"
              className="yd-input"
              type="text"
              placeholder="יום/חודש/שנה"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              aria-label="תאריך"
            />
          </div>

          <div className="yd-field">
            <span>אופן תשלום</span>
            <div className="yd-row">
              {PAYMENT_METHODS.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={method === option}
                  className={`yd-btn sm${method === option ? " primary" : " secondary"}`}
                  onClick={() => setMethod(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div className="yd-field">
            <label htmlFor="record-payment-paid-by">מי שילם/ה</label>
            <input
              id="record-payment-paid-by"
              className="yd-input"
              type="text"
              value={paidBy}
              onChange={(event) => setPaidBy(event.target.value)}
              aria-label="מי שילם/ה"
            />
          </div>

          <div className="yd-field">
            <label htmlFor="record-payment-receipt-number">מספר קבלה (מורנינג)</label>
            <input
              id="record-payment-receipt-number"
              className="yd-input"
              type="text"
              value={receiptNumber}
              onChange={(event) => setReceiptNumber(event.target.value)}
              aria-label="מספר קבלה"
            />
          </div>

          {(error || submitError) && (
            <p className="yd-login-error" role="alert">
              {error || submitError}
            </p>
          )}
        </div>

        <div className="ft">
          <button type="button" className="yd-btn primary" onClick={handleSubmit}>
            שמירה
          </button>
          {onClose && (
            <button type="button" className="yd-btn secondary" onClick={onClose}>
              ביטול
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
