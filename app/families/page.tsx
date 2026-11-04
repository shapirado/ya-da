import AppShell from "@/src/components/AppShell";
import FamiliesList, { type FamilySummary, type FamilyStatus } from "@/src/components/families/FamiliesList";
import { listChildPrices, listChildrenWithPayer } from "@/src/lib/db/children";
import { listReceiptLinesForChild } from "@/src/lib/db/receipts";
import { computeDueStatus } from "@/src/lib/dues";

// Always show today's live status rather than a build-time snapshot.
export const dynamic = "force-dynamic";

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function worstStatus(statuses: FamilyStatus[]): FamilyStatus {
  if (statuses.includes("missing")) return "missing";
  if (statuses.includes("partial")) return "partial";
  if (statuses.includes("paid")) return "paid";
  return "none";
}

export default async function FamiliesPage() {
  const asOfMonth = currentMonth();
  const children = await listChildrenWithPayer();

  const families = new Map<string, FamilySummary>();

  await Promise.all(
    children.map(async (child) => {
      if (!child.payerId || !child.payer) return;

      const [prices, lines] = await Promise.all([
        listChildPrices(child.id),
        listReceiptLinesForChild(child.id),
      ]);
      const monthStatuses = computeDueStatus(
        child.enrollmentStart,
        prices,
        lines.map((line) => ({ month: line.month, amount: line.amount })),
        asOfMonth,
      );
      const childStatus: FamilyStatus =
        monthStatuses.length === 0
          ? "none"
          : monthStatuses.some((status) => status.status === "missing")
            ? "missing"
            : monthStatuses.some((status) => status.status === "partial")
              ? "partial"
              : "paid";

      const existing = families.get(child.payerId);
      const childName = `${child.firstName} ${child.familyName}`;
      if (existing) {
        existing.childrenNames.push(childName);
        existing.status = worstStatus([existing.status, childStatus]);
      } else {
        families.set(child.payerId, {
          payerId: child.payerId,
          displayName: child.payer.displayName,
          role: child.payer.role,
          childrenNames: [childName],
          status: childStatus,
        });
      }
    }),
  );

  const familyList = Array.from(families.values()).sort((a, b) =>
    a.displayName.localeCompare(b.displayName, "he"),
  );

  return (
    <AppShell>
      <div className="yd-stack">
        <h1 className="yd-title">משפחות</h1>
        <FamiliesList families={familyList} />
      </div>
    </AppShell>
  );
}
