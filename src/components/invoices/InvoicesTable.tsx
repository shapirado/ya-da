"use client";

import { useMemo, useState } from "react";
import { monthLabel } from "@/src/components/dashboard/MonthRow";
import type { InvoiceRow } from "@/src/lib/invoiceRows";

export type InvoicesTableProps = {
  rows: InvoiceRow[];
  months: string[]; // 'YYYY-MM-01', descending
};

const STATUS_OPTIONS = [
  { value: "all", label: "כל הסטטוסים" },
  { value: "matched", label: "שויך" },
  { value: "needs_review", label: "לבדיקה" },
] as const;

const SOURCE_OPTIONS = [
  { value: "all", label: "כל המקורות" },
  { value: "morning_webhook", label: "Morning" },
  { value: "manual", label: "ידני" },
] as const;

const METHOD_CLASS: Record<string, string> = {
  "ביט": "bit",
  "פייבוקס": "paybox",
  "העברה בנקאית": "transfer",
  "מזומן": "cash",
};

export default function InvoicesTable({ rows, months }: InvoicesTableProps) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]["value"]>("all");
  const [source, setSource] = useState<(typeof SOURCE_OPTIONS)[number]["value"]>("all");
  const [month, setMonth] = useState("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (status !== "all" && row.status !== status) return false;
      if (source !== "all" && row.source !== source) return false;
      if (month !== "all" && !row.months.includes(month)) return false;
      if (q) {
        const haystack = [row.payerName, ...row.childNames, row.documentNumber]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, status, source, month]);

  return (
    <div className="yd-stack">
      <div className="yd-card yd-pad yd-row yd-dashboard-filters" style={{ flexWrap: "wrap", gap: 12 }}>
        <select
          className="yd-input"
          value={month}
          onChange={(event) => setMonth(event.target.value)}
          aria-label="חודש"
          style={{ width: 150 }}
        >
          <option value="all">כל החודשים</option>
          {months.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)} {m.slice(0, 4)}
            </option>
          ))}
        </select>

        <select
          className="yd-input"
          value={status}
          onChange={(event) => setStatus(event.target.value as typeof status)}
          aria-label="סטטוס"
          style={{ width: 140 }}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <select
          className="yd-input"
          value={source}
          onChange={(event) => setSource(event.target.value as typeof source)}
          aria-label="מקור"
          style={{ width: 140 }}
        >
          {SOURCE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <input
          className="yd-input"
          style={{ flex: 1, minWidth: 180 }}
          type="text"
          placeholder="חיפוש לפי הורה, ילד/ה או מספר קבלה"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label="חיפוש"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="yd-card yd-pad">
          <span className="small muted">לא נמצאו קבלות התואמות לסינון</span>
        </div>
      ) : (
        <div className="yd-card" style={{ overflow: "hidden" }}>
          <div
            className="yd-pay head label"
            style={{ gridTemplateColumns: "1.5fr 80px 100px 75px 85px 85px 80px" }}
          >
            <span>הורה / ילד/ה / מוצר</span>
            <span>סכום</span>
            <span>אופן תשלום</span>
            <span>סטטוס</span>
            <span>תאריך קבלה</span>
            <span>תאריך תשלום</span>
            <span>קבלה</span>
          </div>
          {filtered.map((row) => (
            <div
              key={row.receiptId}
              className="yd-pay"
              style={{ gridTemplateColumns: "1.5fr 80px 100px 75px 85px 85px 80px" }}
            >
              <span className="fam">
                {row.payerName ?? "לא ידוע"}
                {row.payerPhone && <span className="small muted"> · {row.payerPhone}</span>}
                {row.childNames.length > 0 && (
                  <span className="small muted"> · {row.childNames.join(", ")}</span>
                )}
                {row.product && <span className="small muted"> · {row.product}</span>}
              </span>
              <span className="amt">{row.amount !== undefined ? `${row.amount.toLocaleString("he-IL")} ₪` : "—"}</span>
              <span>
                {row.method ? (
                  <span className={`yd-chip small ${METHOD_CLASS[row.method] ?? "neutral"}`}>
                    {row.method}
                  </span>
                ) : (
                  <span className="small muted">—</span>
                )}
              </span>
              <span>
                {row.status === "matched" ? (
                  <span className="yd-chip paid small">
                    <span className="dot" />
                    שויך
                  </span>
                ) : (
                  <span className="yd-chip missing small">
                    <span className="dot" />
                    לבדיקה
                  </span>
                )}
              </span>
              <span className="meta">{row.date ?? "—"}</span>
              <span className="meta">{row.paymentDate ?? "—"}</span>
              <span className="rcpt">{row.documentNumber ? `#${row.documentNumber}` : "—"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
