import AppShell from "@/src/components/AppShell";
import YearGrid, { type YearFamily } from "@/src/components/YearGrid";
import type { CreateReceiptInput } from "@/src/components/RecordPayment/RecordPaymentModal";
import { listChildPrices, listChildrenWithPayer } from "@/src/lib/db/children";
import { listReceiptLinesForChild } from "@/src/lib/db/receipts";
import { computeDueStatus } from "@/src/lib/dues";
import { recordPayment } from "./actions";

// Always show today's live status rather than a build-time snapshot.
export const dynamic = "force-dynamic";

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

export default async function YearPage() {
  const asOfMonth = currentMonth();
  const children = await listChildrenWithPayer();
  const activeChildren = children.filter((child) => child.active);

  const childrenWithStatus = await Promise.all(
    activeChildren.map(async (child) => {
      const [prices, lines] = await Promise.all([
        listChildPrices(child.id),
        listReceiptLinesForChild(child.id),
      ]);
      const statuses = computeDueStatus(
        child.enrollmentStart,
        prices,
        lines.map((line) => ({ month: line.month, amount: line.amount })),
        asOfMonth,
      );
      return { child, statuses };
    }),
  );

  const families = new Map<string, YearFamily>();
  for (const { child, statuses } of childrenWithStatus) {
    if (!child.payerId || !child.payer) continue;

    const childEntry = {
      childId: child.id,
      childName: `${child.firstName} ${child.familyName}`,
      statuses,
    };

    const existing = families.get(child.payerId);
    if (existing) {
      existing.children.push(childEntry);
    } else {
      families.set(child.payerId, {
        payerId: child.payerId,
        payerName: child.payer.displayName,
        children: [childEntry],
      });
    }
  }

  const familyList = Array.from(families.values()).sort((a, b) =>
    a.payerName.localeCompare(b.payerName, "he"),
  );

  async function handleRecordPayment(input: CreateReceiptInput) {
    "use server";
    await recordPayment(input);
  }

  return (
    <AppShell>
      <div className="yd-stack">
        <h1 className="yd-title">תצוגה שנתית</h1>
        <YearGrid families={familyList} asOfMonth={asOfMonth} onRecordPayment={handleRecordPayment} />
      </div>
    </AppShell>
  );
}
