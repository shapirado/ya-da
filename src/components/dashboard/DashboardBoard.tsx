"use client";

import { useEffect, useMemo, useState } from "react";
import UnpaidList, { type UnpaidChild, type UnpaidMonthStatus } from "./UnpaidList";
import MonthRow, { monthLabel, type MarkPaidInput } from "./MonthRow";
import ChildEditor from "../families/ChildEditor";
import PayerEditor from "../families/PayerEditor";
import PaymentHistoryList from "../families/PaymentHistoryList";
import type { Child, ChildInput } from "@/src/lib/db/children";
import type { ClassGroup } from "@/src/lib/db/classGroups";
import type { Payer, PayerInput } from "@/src/lib/db/payers";
import type { ReceiptLineRow } from "@/src/lib/db/receipts";

export type DashboardRow = {
  childId: string;
  firstName: string;
  familyName: string;
  classGroupId: string | null;
  className?: string;
  classColor?: string;
  payerId?: string;
  payerName?: string;
  payerRelation?: string;
  payerPhone?: string;
  statuses: UnpaidMonthStatus[];
  history: ReceiptLineRow[];
  currentPrice: number | null;
  fullChild: Child;
};

export type DashboardBoardProps = {
  rows: DashboardRow[];
  months: string[]; // 'YYYY-MM-01', descending, every month that appears for any child
  classGroups: ClassGroup[];
  payers: Payer[];
  onMarkPaid?: (childId: string, input: MarkPaidInput) => Promise<void>;
  onUpdateChild: (id: string, input: Partial<ChildInput>) => void | Promise<void>;
  onSetPrice: (childId: string, input: { amount: number; effectiveFrom: string }) => void | Promise<void>;
  onUpdatePayer: (id: string, input: Partial<PayerInput>) => void | Promise<void>;
};

const STATUS_OPTIONS = [
  { value: "missing", label: "לא שולם" },
  { value: "paid", label: "שולם" },
  { value: "all", label: "הכל" },
] as const;

type StatusFilter = (typeof STATUS_OPTIONS)[number]["value"];
type PanelTab = "payments" | "details";

export default function DashboardBoard({
  rows,
  months,
  classGroups,
  payers,
  onMarkPaid,
  onUpdateChild,
  onSetPrice,
  onUpdatePayer,
}: DashboardBoardProps) {
  const [month, setMonth] = useState("all");
  const [groupId, setGroupId] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("missing");
  const [search, setSearch] = useState("");
  const [editingChildId, setEditingChildId] = useState<string | null>(null);
  const [panelTab, setPanelTab] = useState<PanelTab>("payments");

  useEffect(() => {
    setPanelTab("payments");
  }, [editingChildId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const result: UnpaidChild[] = [];

    for (const row of rows) {
      if (groupId !== "all" && row.classGroupId !== groupId) continue;
      if (q) {
        const haystack = `${row.firstName} ${row.familyName} ${row.payerName ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) continue;
      }

      let relevantMonths: UnpaidMonthStatus[];
      let isPaidInScope: boolean;

      if (month === "all") {
        relevantMonths = row.statuses.filter((candidate) => candidate.status !== "paid");
        isPaidInScope = relevantMonths.length === 0;
      } else {
        const entry = row.statuses.find((candidate) => candidate.month === month);
        if (!entry) continue; // not enrolled yet that month
        isPaidInScope = entry.status === "paid";
        relevantMonths = isPaidInScope ? [] : [entry];
      }

      if (status === "missing" && isPaidInScope) continue;
      if (status === "paid" && !isPaidInScope) continue;

      result.push({
        childId: row.childId,
        childName: `${row.firstName} ${row.familyName}`,
        className: row.className,
        classColor: row.classColor,
        payerId: row.payerId,
        payerName: row.payerName,
        payerRelation: row.payerRelation,
        payerPhone: row.payerPhone,
        months: relevantMonths,
        fullChild: row.fullChild,
      });
    }

    return result;
  }, [rows, month, groupId, status, search]);

  const paidCount = filtered.filter((child) => child.months.length === 0).length;
  const editingRow = editingChildId ? rows.find((row) => row.childId === editingChildId) ?? null : null;
  const editingPayer = editingRow?.payerId ? payers.find((payer) => payer.id === editingRow.payerId) ?? null : null;
  const editingOwedMonths = editingRow ? editingRow.statuses.filter((s) => s.status !== "paid") : [];

  function handleSelectChild(childId: string) {
    setEditingChildId((current) => (current === childId ? null : childId));
  }

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
          value={groupId}
          onChange={(event) => setGroupId(event.target.value)}
          aria-label="קבוצה"
          style={{ width: 150 }}
        >
          <option value="all">כל הקבוצות</option>
          {classGroups.map((group) => (
            <option key={group.id} value={group.id}>
              {[group.day, group.time].filter(Boolean).join(" ") || group.id}
            </option>
          ))}
        </select>

        <select
          className="yd-input"
          value={status}
          onChange={(event) => setStatus(event.target.value as StatusFilter)}
          aria-label="סטטוס תשלום"
          style={{ width: 120 }}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <input
          className="yd-input"
          style={{ flex: 1, minWidth: 180 }}
          type="text"
          placeholder="חיפוש לפי שם ילד/ה, משפחה או הורה"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label="חיפוש"
        />
      </div>

      <div className="yd-dashboard-split" style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
        <div style={{ flex: "1 1 420px", minWidth: 280 }}>
          {filtered.length === 0 ? (
            <div className="yd-card yd-pad">
              <span className="small muted">לא נמצאו תוצאות התואמות לסינון</span>
            </div>
          ) : (
            <UnpaidList
              children={filtered}
              fullyPaidCount={status === "all" ? paidCount : undefined}
              selectedChildId={editingChildId}
              onSelectChild={handleSelectChild}
            />
          )}
        </div>

        <div className="yd-stack" style={{ flex: "1 1 320px", minWidth: 280, position: "sticky", top: 16 }}>
          {editingRow ? (
            <>
              <div className="yd-row" style={{ gap: 8 }}>
                <button
                  type="button"
                  className={`yd-btn sm ${panelTab === "payments" ? "primary" : "secondary"}`}
                  onClick={() => setPanelTab("payments")}
                >
                  תשלומים
                </button>
                <button
                  type="button"
                  className={`yd-btn sm ${panelTab === "details" ? "primary" : "secondary"}`}
                  onClick={() => setPanelTab("details")}
                >
                  פרטים
                </button>
              </div>

              {panelTab === "payments" ? (
                <>
                  <div className="yd-card yd-pad yd-stack">
                    <span className="small muted">לתשלום</span>
                    {editingOwedMonths.length === 0 ? (
                      <span className="small muted">אין תשלומים פתוחים</span>
                    ) : (
                      editingOwedMonths.map((month) => (
                        <MonthRow
                          key={month.month}
                          month={month.month}
                          due={month.due - month.paid}
                          onMarkPaid={(input) =>
                            onMarkPaid?.(editingRow.childId, input) ?? Promise.resolve()
                          }
                        />
                      ))
                    )}
                  </div>
                  <PaymentHistoryList childFirstName={editingRow.firstName} history={editingRow.history} />
                </>
              ) : (
                <>
                  <ChildEditor
                    key={editingRow.childId}
                    child={editingRow.fullChild}
                    groups={classGroups}
                    currentPrice={editingRow.currentPrice}
                    onUpdateChild={onUpdateChild}
                    onSetPrice={onSetPrice}
                  />
                  {editingPayer && (
                    <PayerEditor key={editingPayer.id} payer={editingPayer} onSavePayer={onUpdatePayer} />
                  )}
                </>
              )}
            </>
          ) : (
            <div className="yd-card yd-pad">
              <span className="small muted">בחרי ילד/ה מהרשימה לעריכת הפרטים</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
