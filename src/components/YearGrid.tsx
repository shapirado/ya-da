"use client";

import { useState } from "react";
import type { MonthStatus } from "@/src/lib/dues";
import RecordPaymentModal, {
  type CreateReceiptInput,
  type RecordPaymentChild,
  type RecordPaymentFamily,
} from "@/src/components/RecordPayment/RecordPaymentModal";

export type YearChildStatuses = {
  childId: string;
  childName: string;
  statuses: MonthStatus[];
};

export type YearFamily = {
  payerId?: string;
  payerName: string;
  children: YearChildStatuses[];
};

export type YearGridProps = {
  families: YearFamily[];
  // Defaults to the current real-world month; passed explicitly in tests
  // for determinism.
  asOfMonth?: string;
  onRecordPayment: (input: CreateReceiptInput) => void | Promise<void>;
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

const SUBMIT_ERROR = "לא הצלחנו לשמור את התשלום, נסי שוב";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
}

// September through June of the school year containing `asOfMonth`.
function schoolYearMonths(asOfMonth: string): string[] {
  const year = Number(asOfMonth.slice(0, 4));
  const month = Number(asOfMonth.slice(5, 7));
  const startYear = month >= 9 ? year : year - 1;

  const months: string[] = [];
  for (let m = 9; m <= 12; m += 1) months.push(`${startYear}-${pad(m)}-01`);
  for (let m = 1; m <= 6; m += 1) months.push(`${startYear + 1}-${pad(m)}-01`);
  return months;
}

function monthLabel(month: string): string {
  const index = Number(month.slice(5, 7)) - 1;
  return HEBREW_MONTHS[index] ?? month;
}

type Status = MonthStatus["status"];

function worstStatus(statuses: Status[]): Status | null {
  if (statuses.includes("missing")) return "missing";
  if (statuses.includes("partial")) return "partial";
  if (statuses.includes("paid")) return "paid";
  return null;
}

function statusForMonth(child: YearChildStatuses, month: string): MonthStatus | undefined {
  return child.statuses.find((entry) => entry.month === month);
}

function familyStatusForMonth(family: YearFamily, month: string): Status | null {
  const statuses = family.children
    .map((child) => statusForMonth(child, month)?.status)
    .filter((status): status is Status => status !== undefined);
  return worstStatus(statuses);
}

// Which child a clicked family/month cell should pre-scope the modal to:
// prefer the child with the worst status for that month, since that's the
// one most likely owed; fall back to the family's first child.
function childForCell(family: YearFamily, month: string): YearChildStatuses | undefined {
  const withStatus = family.children.map((child) => ({
    child,
    status: statusForMonth(child, month)?.status,
  }));
  const missing = withStatus.find((entry) => entry.status === "missing");
  if (missing) return missing.child;
  const partial = withStatus.find((entry) => entry.status === "partial");
  if (partial) return partial.child;
  const withAny = withStatus.find((entry) => entry.status !== undefined);
  if (withAny) return withAny.child;
  return family.children[0];
}

function familyKey(family: YearFamily, index: number): string {
  return family.payerId ?? `family-${index}`;
}

export default function YearGrid({ families, asOfMonth, onRecordPayment }: YearGridProps) {
  const asOf = asOfMonth ?? currentMonth();
  const months = schoolYearMonths(asOf);

  const [selectedCell, setSelectedCell] = useState<{
    payerId: string;
    childId: string;
    month: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const modalFamilies: RecordPaymentFamily[] = families.map((family, index) => ({
    id: familyKey(family, index),
    displayName: family.payerName,
  }));
  const childrenByPayer: Record<string, RecordPaymentChild[]> = {};
  families.forEach((family, index) => {
    childrenByPayer[familyKey(family, index)] = family.children.map((child) => ({
      id: child.childId,
      name: child.childName,
    }));
  });

  function handleCellClick(family: YearFamily, index: number, month: string) {
    if (month > asOf) return; // future months have no data yet
    const child = childForCell(family, month);
    if (!child) return;
    setError(null);
    setSelectedCell({ payerId: familyKey(family, index), childId: child.childId, month });
  }

  async function handleSubmit(input: CreateReceiptInput) {
    try {
      await onRecordPayment(input);
      setSelectedCell(null);
      setError(null);
    } catch {
      setError(SUBMIT_ERROR);
    }
  }

  return (
    <div className="yd-yearwrap">
      <table className="yd-year">
        <thead>
          <tr>
            <th className="fam" />
            {months.map((month) => (
              <th
                key={month}
                data-testid={`month-head-${month}`}
                className={month === asOf ? "cur" : undefined}
              >
                <span>{monthLabel(month)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {families.map((family, index) => (
            <tr key={familyKey(family, index)}>
              <td className="fam">
                <b>{family.payerName}</b>
              </td>
              {months.map((month) => {
                const isFuture = month > asOf;
                const status = isFuture ? null : familyStatusForMonth(family, month);
                const classes = ["yd-ycell"];
                if (isFuture) {
                  classes.push("future");
                } else if (status) {
                  classes.push(status);
                }

                return (
                  <td key={month}>
                    <button
                      type="button"
                      data-testid={`cell-${month}`}
                      aria-label={`${family.payerName} ${monthLabel(month)}`}
                      className={classes.join(" ")}
                      disabled={isFuture}
                      onClick={() => handleCellClick(family, index, month)}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {selectedCell && (
        <RecordPaymentModal
          families={modalFamilies}
          childrenByPayer={childrenByPayer}
          initial={selectedCell}
          onSubmit={handleSubmit}
          onClose={() => setSelectedCell(null)}
          error={error}
        />
      )}
    </div>
  );
}
