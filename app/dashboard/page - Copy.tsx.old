import AppShell from "@/src/components/AppShell";
import UnpaidList, { type UnpaidChild, type UnpaidMonthStatus } from "@/src/components/dashboard/UnpaidList";
import MissingTotal from "@/src/components/dashboard/MissingTotal";
import RecordPaymentButton from "@/src/components/dashboard/RecordPaymentButton";
import type { CreateReceiptInput } from "@/src/components/RecordPayment/RecordPaymentModal";
import { listChildPrices, listChildrenWithPayer } from "@/src/lib/db/children";
import { listClassGroups } from "@/src/lib/db/classGroups";
import { listPayers } from "@/src/lib/db/payers";
import { listReceiptLinesForChild } from "@/src/lib/db/receipts";
import { computeDueStatus } from "@/src/lib/dues";
import { markMonthPaid, recordPayment, type MarkMonthPaidInput } from "./actions";

// Always show today's live status rather than a build-time snapshot.
export const dynamic = "force-dynamic";

const RELATION_LABELS: Record<string, string> = {
  mom: "אמא",
  dad: "אבא",
};

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

export default async function DashboardPage() {
  const asOfMonth = currentMonth();
  const [children, classGroups, payers] = await Promise.all([
    listChildrenWithPayer(),
    listClassGroups(),
    listPayers(),
  ]);
  const activeChildren = children.filter((child) => child.active);

  const families = payers.map((payer) => ({ id: payer.id, displayName: payer.displayName }));
  const childrenByPayer = activeChildren.reduce<Record<string, { id: string; name: string }[]>>(
    (map, child) => {
      if (!child.payerId) return map;
      const entry = { id: child.id, name: `${child.firstName} ${child.familyName}` };
      map[child.payerId] = [...(map[child.payerId] ?? []), entry];
      return map;
    },
    {},
  );

  const childrenWithStatus = await Promise.all(
    activeChildren.map(async (child) => {
      const [prices, lines] = await Promise.all([
        listChildPrices(child.id),
        listReceiptLinesForChild(child.id),
      ]);
      const statuses: UnpaidMonthStatus[] = computeDueStatus(
        child.enrollmentStart,
        prices,
        lines.map((line) => ({ month: line.month, amount: line.amount })),
        asOfMonth,
      );
      const classGroup = classGroups.find((group) => group.id === child.classGroupId);
      const className = classGroup
        ? [classGroup.day, classGroup.time].filter(Boolean).join(" ")
        : undefined;
      const payerRelation = child.payer?.role
        ? RELATION_LABELS[child.payer.role] ?? child.payer.role
        : undefined;

      return {
        child,
        statuses,
        owedMonths: statuses.filter((status) => status.status !== "paid"),
        className,
        payerName: child.payer?.displayName,
        payerRelation,
      };
    }),
  );

  const childrenDue: UnpaidChild[] = childrenWithStatus
    .filter((entry) => entry.owedMonths.length > 0)
    .map((entry) => ({
      childId: entry.child.id,
      childName: `${entry.child.firstName} ${entry.child.familyName}`,
      className: entry.className,
      payerName: entry.payerName,
      payerRelation: entry.payerRelation,
      months: entry.owedMonths,
    }));

  const fullyPaidCount = childrenWithStatus.filter(
    (entry) => entry.statuses.length > 0 && entry.owedMonths.length === 0,
  ).length;

  async function handleMarkPaid(childId: string, input: MarkMonthPaidInputFromRow) {
    "use server";
    await markMonthPaid(childId, input.month, {
      amount: input.amount,
      method: input.method,
      receiptNumber: input.receiptNumber,
    });
  }

  async function handleRecordPayment(input: CreateReceiptInput) {
    "use server";
    await recordPayment(input);
  }

  return (
    <AppShell>
      <div className="yd-stack">
        <div className="yd-row" style={{ justifyContent: "space-between" }}>
          <h1 className="yd-title">לוח בקרה</h1>
          <RecordPaymentButton
            families={families}
            childrenByPayer={childrenByPayer}
            onRecordPayment={handleRecordPayment}
          />
        </div>
        <MissingTotal children={childrenDue} />
        <UnpaidList
          children={childrenDue}
          onMarkPaid={handleMarkPaid}
          fullyPaidCount={fullyPaidCount}
        />
      </div>
    </AppShell>
  );
}

type MarkMonthPaidInputFromRow = MarkMonthPaidInput & { month: string };
