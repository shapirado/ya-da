import AppShell from "@/src/components/AppShell";
import UnpaidList, { type UnpaidChild, type UnpaidMonthStatus } from "@/src/components/dashboard/UnpaidList";
import MissingTotal from "@/src/components/dashboard/MissingTotal";
import { listChildPrices, listChildrenWithPayer } from "@/src/lib/db/children";
import { listClassGroups } from "@/src/lib/db/classGroups";
import { listReceiptLinesForChild } from "@/src/lib/db/receipts";
import { computeDueStatus } from "@/src/lib/dues";
import { markMonthPaid, type MarkMonthPaidInput } from "./actions";

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
  const [children, classGroups] = await Promise.all([
    listChildrenWithPayer(),
    listClassGroups(),
  ]);
  const activeChildren = children.filter((child) => child.active);

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

  return (
    <AppShell>
      <div className="yd-stack">
        <h1 className="yd-title">לוח בקרה</h1>
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
