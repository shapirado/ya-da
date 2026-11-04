"use client";

import { useState } from "react";
import RecordPaymentModal, {
  type CreateReceiptInput,
  type RecordPaymentChild,
  type RecordPaymentFamily,
} from "@/src/components/RecordPayment/RecordPaymentModal";

export type ReceiptReviewLine = {
  id: string;
  childId: string | null;
  month: string | null;
};

export type ReceiptReviewItem = {
  receiptId: string;
  rawPayload: unknown;
  lines: ReceiptReviewLine[];
  // The payer name as parsed from the Morning recipient field, when the
  // receipt came from a document/created webhook we could at least partly
  // parse.
  rawPayerName?: string;
};

export type ReceiptReviewListProps = {
  items: ReceiptReviewItem[];
  families: RecordPaymentFamily[];
  childrenByPayer: Record<string, RecordPaymentChild[]>;
  onResolve: (
    lineId: string,
    input: { payerId: string; childId: string; month: string; rawPayerName?: string },
  ) => Promise<void>;
};

const RESOLVE_ERROR = "לא הצלחנו לשמור את השיוך, נסי שוב";

function unresolvedLines(item: ReceiptReviewItem): ReceiptReviewLine[] {
  return item.lines.filter((line) => !line.childId || !line.month);
}

function formatRawPayload(raw: unknown): string {
  return typeof raw === "string" ? raw : JSON.stringify(raw, null, 2);
}

export default function ReceiptReviewList({
  items,
  families,
  childrenByPayer,
  onResolve,
}: ReceiptReviewListProps) {
  const [openReceiptId, setOpenReceiptId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedRaw, setExpandedRaw] = useState<Record<string, boolean>>({});

  const openItem = items.find((item) => item.receiptId === openReceiptId);

  async function handleSubmit(item: ReceiptReviewItem, input: CreateReceiptInput) {
    if (!input.payerId) {
      setError(RESOLVE_ERROR);
      return;
    }

    const pending = unresolvedLines(item);
    const remaining = [...input.lines];

    try {
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

        await onResolve(line.id, {
          payerId: input.payerId!,
          childId: match.childId,
          month: match.month,
          rawPayerName: item.rawPayerName,
        });
      }
      setOpenReceiptId(null);
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
        const knownMonths = pending.map((l) => l.month).filter((m): m is string => !!m);

        return (
          <div key={item.receiptId} className="yd-card yd-pad yd-stack">
            <div className="yd-row" style={{ justifyContent: "space-between" }}>
              <span>
                {item.rawPayerName ?? "קבלה לא מזוהה"} · {pending.length} שורות לא משויכות
              </span>
              <button
                type="button"
                className="yd-btn primary sm"
                onClick={() => {
                  setError(null);
                  setOpenReceiptId(item.receiptId);
                }}
              >
                שיוך למשפחה
              </button>
            </div>

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
                onSubmit={(input) => handleSubmit(item, input)}
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
