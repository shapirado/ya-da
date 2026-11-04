import AppShell from "@/src/components/AppShell";
import ReceiptReviewList, {
  type ReceiptReviewItem,
} from "@/src/components/receipts/ReceiptReviewList";
import { listChildrenWithPayer } from "@/src/lib/db/children";
import { listPayers } from "@/src/lib/db/payers";
import { listNeedsReviewReceipts } from "@/src/lib/db/receipts";
import { parseRecipientName } from "@/src/lib/morning";
import { resolveReceipt, type ResolveReceiptLineInput } from "./actions";

// Always show the live needs-review queue rather than a build-time snapshot.
export const dynamic = "force-dynamic";

export default async function ReceiptsPage() {
  const [receipts, payers, children] = await Promise.all([
    listNeedsReviewReceipts(),
    listPayers(),
    listChildrenWithPayer(),
  ]);

  const families = payers.map((payer) => ({ id: payer.id, displayName: payer.displayName }));
  const childrenByPayer = children.reduce<Record<string, { id: string; name: string }[]>>(
    (map, child) => {
      if (!child.payerId) return map;
      const entry = { id: child.id, name: `${child.firstName} ${child.familyName}` };
      map[child.payerId] = [...(map[child.payerId] ?? []), entry];
      return map;
    },
    {},
  );

  const items: ReceiptReviewItem[] = receipts.map((receipt) => {
    const recipientName =
      receipt.rawPayload && typeof receipt.rawPayload === "object"
        ? (receipt.rawPayload as { recipient?: { name?: string } }).recipient?.name
        : undefined;
    const parsed = recipientName ? parseRecipientName(recipientName) : null;

    return {
      receiptId: receipt.id,
      rawPayload: receipt.rawPayload,
      lines: receipt.lines.map((line) => ({ id: line.id, childId: line.childId, month: line.month })),
      rawPayerName: parsed?.payerName,
    };
  });

  async function handleResolve(lineId: string, input: ResolveReceiptLineInput) {
    "use server";
    await resolveReceipt(lineId, input);
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
        />
      </div>
    </AppShell>
  );
}
