import AppShell from "@/src/components/AppShell";
import ReceiptReviewList from "@/src/components/receipts/ReceiptReviewList";
import { listChildrenWithPayer } from "@/src/lib/db/children";
import { listPayers } from "@/src/lib/db/payers";
import { listNeedsReviewReceipts } from "@/src/lib/db/receipts";
import { buildReceiptReviewItems } from "@/src/lib/receiptReviewItems";
import { toRecordPaymentFamily } from "@/src/lib/recordPaymentFamily";
import { dismissReceipt, resolveReceipt, type ResolveReceiptLineInput } from "./actions";

// Always show the live needs-review queue rather than a build-time snapshot.
export const dynamic = "force-dynamic";

export default async function ReceiptsPage() {
  const [receipts, payers, children] = await Promise.all([
    listNeedsReviewReceipts(),
    listPayers(),
    listChildrenWithPayer(),
  ]);

  const families = payers.map(toRecordPaymentFamily);
  const childrenByPayer = children.reduce<Record<string, { id: string; name: string }[]>>(
    (map, child) => {
      if (!child.payerId) return map;
      const entry = { id: child.id, name: `${child.firstName} ${child.familyName}` };
      map[child.payerId] = [...(map[child.payerId] ?? []), entry];
      return map;
    },
    {},
  );

  const items = buildReceiptReviewItems(receipts);

  async function handleResolve(lineId: string, input: ResolveReceiptLineInput) {
    "use server";
    await resolveReceipt(lineId, input);
  }

  async function handleDismiss(receiptId: string) {
    "use server";
    await dismissReceipt(receiptId);
  }

  return (
    <AppShell>
      <div className="yd-stack">
        <h1 className="yd-title">קבלות לבדיקה</h1>
        <ReceiptReviewList
          items={items}
          families={families}
          childrenByPayer={childrenByPayer}
          onResolve={handleResolve}
          onDismiss={handleDismiss}
        />
      </div>
    </AppShell>
  );
}
