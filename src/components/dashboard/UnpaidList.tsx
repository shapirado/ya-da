"use client";

import { useState } from "react";
import MonthRow, { type MarkPaidInput } from "./MonthRow";

export type UnpaidMonthStatus = {
  month: string;
  due: number;
  paid: number;
  status: "paid" | "partial" | "missing";
};

export type UnpaidChild = {
  childId: string;
  childName: string;
  className?: string;
  payerName?: string;
  payerRelation?: string;
  months: UnpaidMonthStatus[];
};

export type UnpaidListProps = {
  children: UnpaidChild[];
  onMarkPaid?: (childId: string, input: MarkPaidInput) => void;
  fullyPaidCount?: number;
};

export default function UnpaidList({ children, onMarkPaid, fullyPaidCount }: UnpaidListProps) {
  return (
    <div className="yd-unpaid-children yd-stack">
      {children.map((child) => (
        <UnpaidChildCard key={child.childId} child={child} onMarkPaid={onMarkPaid} />
      ))}
      {typeof fullyPaidCount === "number" && fullyPaidCount > 0 && (
        <div className="yd-card yd-pad yd-row yd-fully-paid-summary">
          <span>{fullyPaidCount} ילדים ששילמו החודש</span>
        </div>
      )}
    </div>
  );
}

function UnpaidChildCard({
  child,
  onMarkPaid,
}: {
  child: UnpaidChild;
  onMarkPaid?: UnpaidListProps["onMarkPaid"];
}) {
  const [expanded, setExpanded] = useState(true);
  const owedMonths = child.months.filter((month) => month.status !== "paid");
  const total = owedMonths.reduce((sum, month) => sum + (month.due - month.paid), 0);

  function toggle() {
    setExpanded((value) => !value);
  }

  return (
    <div className="yd-card yd-unpaid-child">
      <div className="yd-unpaid-child-head" onClick={toggle} role="button" tabIndex={0}>
        <div className="info">
          <span className="name">{child.childName}</span>
          {child.className && <span className="small muted">{child.className}</span>}
          {child.payerName && (
            <span className="small muted">
              {child.payerName}
              {child.payerRelation ? ` (${child.payerRelation})` : ""}
            </span>
          )}
        </div>
        <span className="amt">{total.toLocaleString("he-IL")} ₪</span>
        <button
          type="button"
          aria-label="ערוך"
          className="yd-btn icon ghost"
          onClick={(event) => event.stopPropagation()}
        >
          <EditIcon />
        </button>
        <button
          type="button"
          aria-label={expanded ? "כווצי" : "הרחיבי"}
          className="yd-btn icon ghost yd-chevron"
          onClick={(event) => {
            event.stopPropagation();
            toggle();
          }}
        >
          <ChevronIcon expanded={expanded} />
        </button>
      </div>
      {expanded && (
        <div className="yd-unpaid-child-months">
          {owedMonths.map((month) => (
            <MonthRow
              key={month.month}
              month={month.month}
              due={month.due - month.paid}
              onMarkPaid={(input) => onMarkPaid?.(child.childId, input)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EditIcon() {
  return (
    <svg
      className="ic"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 20h4L19.5 8.5a2 2 0 0 0 0-2.8l-1.2-1.2a2 2 0 0 0-2.8 0L4 16v4z" />
    </svg>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className="ic"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ transform: expanded ? "rotate(180deg)" : "none" }}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
