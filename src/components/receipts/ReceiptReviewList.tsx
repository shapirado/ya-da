"use client";

import { useState } from "react";
import RecordPaymentModal, {
  type CreateReceiptInput,
  type RecordPaymentChild,
  type RecordPaymentFamily,
} from "@/src/components/RecordPayment/RecordPaymentModal";
import { monthLabel } from "@/src/components/dashboard/MonthRow";

export type ReceiptReviewLine = {
  id: string;
  childId: string | null;
  month: string | null;
  // null on a multi-cell payment's lines until the total is split per line.
  amount: number | null;
};

export type ReceiptReviewItem = {
  receiptId: string;
  rawPayload: unknown;
  lines: ReceiptReviewLine[];
  // The payer name as parsed from the Morning recipient field, when the
  // receipt came from a document/created webhook we could at least partly
  // parse.
  rawPayerName?: string;
  // The whole-receipt total as recorded (manual entry's amount / Morning
  // document's total), when known. Used to pre-fill the per-line split.
  totalAmount?: number;
};

export type ResolveLineInput = {
  payerId?: string;
  childId: string;
  month: string;
  // Set only when the reviewer entered/confirmed this line's amount (the
  // per-line split of a multi-cell payment); omitted keeps the line's
  // existing amount.
  amount?: number;
  rawPayerName?: string;
};

export type ReceiptReviewListProps = {
  items: ReceiptReviewItem[];
  families: RecordPaymentFamily[];
  childrenByPayer: Record<string, RecordPaymentChild[]>;
  onResolve: (lineId: string, input: ResolveLineInput) => Promise<void>;
  // Marks a receipt with no lines at all as handled (nothing to resolve).
  onDismiss?: (receiptId: string) => Promise<void>;
};

const RESOLVE_ERROR = "לא הצלחנו לשמור את השיוך, נסי שוב";
const SPLIT_INVALID_ERROR = "יש להזין סכום תקין לכל שורה";
const DISMISS_ERROR = "לא הצלחנו לסמן את הקבלה כטופלה, נסי שוב";

// One line's pending assignment, before it is written. `needsAmount` lines
// get their amount from the split step.
type Assignment = {
  lineId: string;
  payerId?: string;
  childId: string;
  month: string;
  needsAmount: boolean;
};

type SplitState = {
  receiptId: string;
  assignments: Assignment[];
  amounts: string[];
  total: number | null;
};

function lacksChildOrMonth(line: ReceiptReviewLine): boolean {
  return !line.childId || !line.month;
}

export function unresolvedLines(item: ReceiptReviewItem): ReceiptReviewLine[] {
  return item.lines.filter((line) => lacksChildOrMonth(line) || line.amount === null);
}

// An even split of `total` across `count` lines, in whole agorot, with any
// leftover agorot going to the first lines so the parts sum to the total.
// Only ever a pre-filled, editable default — the reviewer confirms it.
export function evenSplit(total: number, count: number): number[] {
  if (count <= 0) return [];
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / count);
  const remainder = cents - base * count;
  return Array.from({ length: count }, (_, index) => (base + (index < remainder ? 1 : 0)) / 100);
}

function formatRawPayload(raw: unknown): string {
  return typeof raw === "string" ? raw : JSON.stringify(raw, null, 2);
}

export default function ReceiptReviewList({
  items,
  families,
  childrenByPayer,
  onResolve,
  onDismiss,
}: ReceiptReviewListProps) {
  const [openReceiptId, setOpenReceiptId] = useState<string | null>(null);
  const [split, setSplit] = useState<SplitState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedRaw, setExpandedRaw] = useState<Record<string, boolean>>({});
  const [dismissError, setDismissError] = useState<{ receiptId: string; message: string } | null>(
    null,
  );

  async function handleDismiss(receiptId: string) {
    if (!onDismiss) return;
    try {
      await onDismiss(receiptId);
      setDismissError(null);
    } catch {
      setDismissError({ receiptId, message: DISMISS_ERROR });
    }
  }

  const openItem = items.find((item) => item.receiptId === openReceiptId);

  const childNames: Record<string, string> = {};
  for (const list of Object.values(childrenByPayer)) {
    for (const child of list) childNames[child.id] = child.name;
  }

  async function writeAssignments(
    item: ReceiptReviewItem,
    assignments: Assignment[],
    amounts?: Array<number | undefined>,
  ) {
    for (const [index, assignment] of assignments.entries()) {
      await onResolve(assignment.lineId, {
        payerId: assignment.payerId,
        childId: assignment.childId,
        month: assignment.month,
        amount: amounts?.[index],
        rawPayerName: item.rawPayerName,
      });
    }
  }

  function startSplit(item: ReceiptReviewItem, assignments: Assignment[], total: number | null) {
    const needing = assignments.filter((a) => a.needsAmount);
    const defaults = total !== null ? evenSplit(total, needing.length) : [];
    let cursor = 0;
    setSplit({
      receiptId: item.receiptId,
      assignments,
      amounts: assignments.map((a) => (a.needsAmount ? String(defaults[cursor++] ?? "") : "")),
      total,
    });
  }

  // Lines that already have a child and month and only lack an amount (a
  // multi-cell manual payment) keep their child/month as-is.
  function amountOnlyAssignments(item: ReceiptReviewItem): Assignment[] {
    return item.lines
      .filter((line) => !lacksChildOrMonth(line) && line.amount === null)
      .map((line) => ({
        lineId: line.id,
        childId: line.childId!,
        month: line.month!,
        needsAmount: true,
      }));
  }

  async function handleModalSubmit(item: ReceiptReviewItem, input: CreateReceiptInput) {
    if (!input.payerId) {
      setError(RESOLVE_ERROR);
      return;
    }

    const pending = item.lines.filter(lacksChildOrMonth);
    const remaining = [...input.lines];
    const assignments: Assignment[] = [];

    for (const line of pending) {
      // Prefer a selected cell matching this line's already-known month
      // (the common case: Morning parsed the month fine, only the
      // payer/child failed to resolve); otherwise fall back to
      // consuming the next selected cell in order.
      let matchIndex = line.month ? remaining.findIndex((l) => l.month === line.month) : -1;
      if (matchIndex === -1) matchIndex = 0;
      const match = remaining[matchIndex];
      if (!match) continue;
      remaining.splice(matchIndex, 1);

      assignments.push({
        lineId: line.id,
        payerId: input.payerId,
        childId: match.childId,
        month: match.month,
        needsAmount: line.amount === null,
      });
    }
    assignments.push(...amountOnlyAssignments(item));

    if (assignments.some((a) => a.needsAmount)) {
      setOpenReceiptId(null);
      setError(null);
      startSplit(item, assignments, input.amount);
      return;
    }

    try {
      await writeAssignments(item, assignments);
      setOpenReceiptId(null);
      setError(null);
    } catch {
      setError(RESOLVE_ERROR);
    }
  }

  async function handleSplitConfirm(item: ReceiptReviewItem, state: SplitState) {
    const amounts: Array<number | undefined> = [];
    for (const [index, assignment] of state.assignments.entries()) {
      if (!assignment.needsAmount) {
        amounts.push(undefined);
        continue;
      }
      const raw = state.amounts[index].trim();
      const value = Number(raw);
      if (raw === "" || Number.isNaN(value) || value < 0) {
        setError(SPLIT_INVALID_ERROR);
        return;
      }
      amounts.push(value);
    }

    try {
      await writeAssignments(item, state.assignments, amounts);
      setSplit(null);
      setError(null);
    } catch {
      setError(RESOLVE_ERROR);
    }
  }

  if (items.length === 0) {
    return <p className="small muted">אין קבלות לבדיקה</p>;
  }

  return (
    <div className="yd-stack">
      {items.map((item) => {
        const pending = unresolvedLines(item);
        const needsCells = item.lines.some(lacksChildOrMonth);
        const knownMonths = item.lines
          .filter(lacksChildOrMonth)
          .map((l) => l.month)
          .filter((m): m is string => !!m);
        const splitOpen = split?.receiptId === item.receiptId ? split : null;
        const splitSum = splitOpen
          ? splitOpen.amounts.reduce(
              (sum, value, index) =>
                splitOpen.assignments[index].needsAmount ? sum + (Number(value) || 0) : sum,
              0,
            )
          : 0;

        return (
          <div key={item.receiptId} className="yd-card yd-pad yd-stack">
            <div className="yd-row" style={{ justifyContent: "space-between" }}>
              <span>
                {item.rawPayerName ?? "קבלה לא מזוהה"} ·{" "}
                {item.lines.length === 0
                  ? "אין בקבלה שורות תשלום לשיוך"
                  : `${pending.length} שורות לא משויכות`}
              </span>
              {item.lines.length === 0 ? (
                onDismiss ? (
                  <button
                    type="button"
                    className="yd-btn secondary sm"
                    onClick={() => handleDismiss(item.receiptId)}
                  >
                    סימון כטופלה
                  </button>
                ) : null
              ) : needsCells ? (
                <button
                  type="button"
                  className="yd-btn primary sm"
                  onClick={() => {
                    setError(null);
                    setSplit(null);
                    setOpenReceiptId(item.receiptId);
                  }}
                >
                  שיוך למשפחה
                </button>
              ) : pending.length > 0 ? (
                <button
                  type="button"
                  className="yd-btn primary sm"
                  onClick={() => {
                    setError(null);
                    setOpenReceiptId(null);
                    startSplit(item, amountOnlyAssignments(item), item.totalAmount ?? null);
                  }}
                >
                  חלוקת הסכום
                </button>
              ) : null}
            </div>

            {dismissError?.receiptId === item.receiptId && (
              <p className="yd-login-error" role="alert">
                {dismissError.message}
              </p>
            )}

            {splitOpen && (
              <div className="yd-stack" aria-label="חלוקת הסכום">
                {splitOpen.total !== null && (
                  <span className="small muted">
                    סכום הקבלה: {splitOpen.total.toLocaleString("he-IL")} ₪ · סה״כ בחלוקה:{" "}
                    {splitSum.toLocaleString("he-IL")} ₪
                  </span>
                )}
                {splitOpen.assignments.map((assignment, index) =>
                  assignment.needsAmount ? (
                    <div key={assignment.lineId} className="yd-field">
                      <label htmlFor={`split-${assignment.lineId}`}>
                        {childNames[assignment.childId] ?? "ילד/ה"} · {monthLabel(assignment.month)}
                      </label>
                      <input
                        id={`split-${assignment.lineId}`}
                        className="yd-input"
                        type="number"
                        value={splitOpen.amounts[index]}
                        onChange={(event) => {
                          const value = event.target.value;
                          setSplit((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  amounts: prev.amounts.map((a, i) => (i === index ? value : a)),
                                }
                              : prev,
                          );
                        }}
                      />
                    </div>
                  ) : null,
                )}
                {error && (
                  <p className="yd-login-error" role="alert">
                    {error}
                  </p>
                )}
                <div className="yd-row">
                  <button
                    type="button"
                    className="yd-btn primary sm"
                    onClick={() => handleSplitConfirm(item, splitOpen)}
                  >
                    אישור החלוקה
                  </button>
                  <button
                    type="button"
                    className="yd-btn secondary sm"
                    onClick={() => {
                      setSplit(null);
                      setError(null);
                    }}
                  >
                    ביטול
                  </button>
                </div>
              </div>
            )}

            <button
              type="button"
              className="yd-btn ghost sm"
              onClick={() =>
                setExpandedRaw((prev) => ({ ...prev, [item.receiptId]: !prev[item.receiptId] }))
              }
            >
              {expandedRaw[item.receiptId] ? "הסתרת המקור" : "הצגת המקור"}
            </button>
            {expandedRaw[item.receiptId] && (
              <pre className="small muted" style={{ whiteSpace: "pre-wrap", direction: "ltr" }}>
                {formatRawPayload(item.rawPayload)}
              </pre>
            )}

            {openItem?.receiptId === item.receiptId && (
              <RecordPaymentModal
                families={families}
                childrenByPayer={childrenByPayer}
                months={knownMonths.length > 0 ? knownMonths : undefined}
                onSubmit={(input) => handleModalSubmit(item, input)}
                onClose={() => setOpenReceiptId(null)}
                error={error}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
