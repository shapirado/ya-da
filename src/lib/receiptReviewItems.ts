import type { ReceiptReviewItem } from "@/src/components/receipts/ReceiptReviewList";
import type { ReceiptWithLines } from "@/src/lib/db/receipts";
import { parseRecipientName } from "@/src/lib/morning";

type ManualPayload = { amount?: unknown; date?: unknown; receiptNumber?: unknown };
type MorningItem = { description?: string; sku?: string };
type MorningTransaction = { date?: string };
type MorningPayload = {
  recipient?: { name?: string };
  total?: unknown;
  date?: unknown;
  number?: unknown;
  items?: MorningItem[];
  transactions?: MorningTransaction[];
};

function isoToDdmmyyyy(iso: string): string | undefined {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return undefined;
  const [, yyyy, mm, dd] = match;
  return `${dd}${mm}${yyyy}`;
}

// Builds the review-queue items the ReceiptReviewList component renders,
// shared by the dedicated /receipts page and the dashboard's embedded
// queue — including pre-fill values (amount, date, document number) so
// resolving a receipt into a manual payment doesn't require retyping
// anything the source already carried.
export function buildReceiptReviewItems(receipts: ReceiptWithLines[]): ReceiptReviewItem[] {
  return receipts.map((receipt) => {
    const payload =
      receipt.rawPayload && typeof receipt.rawPayload === "object" ? receipt.rawPayload : undefined;

    let totalAmount: number | undefined;
    let documentDate: string | undefined;
    let paymentDate: string | undefined;
    let documentNumber: string | undefined;
    let product: string | undefined;
    let rawPayerName: string | undefined;

    if (receipt.source === "manual") {
      const manual = payload as ManualPayload | undefined;
      totalAmount = typeof manual?.amount === "number" ? manual.amount : undefined;
      documentDate = typeof manual?.date === "string" ? manual.date : undefined; // already ddmmyyyy
      paymentDate = documentDate;
      documentNumber = typeof manual?.receiptNumber === "string" ? manual.receiptNumber : undefined;
    } else {
      const morning = payload as MorningPayload | undefined;
      totalAmount = typeof morning?.total === "number" ? morning.total : undefined;
      documentDate = typeof morning?.date === "string" ? isoToDdmmyyyy(morning.date) : undefined;
      const transactionDate = morning?.transactions?.[0]?.date;
      paymentDate = typeof transactionDate === "string" ? isoToDdmmyyyy(transactionDate) : documentDate;
      documentNumber = morning?.number !== undefined ? String(morning.number) : undefined;
      product = morning?.items
        ?.map((item) => [item.description, item.sku].filter(Boolean).join(" - "))
        .filter(Boolean)
        .join(" · ");
      const parsed = morning?.recipient?.name ? parseRecipientName(morning.recipient.name) : null;
      rawPayerName = parsed?.payerName;
    }

    // The DB columns (filled in going forward by createReceipt, and
    // backfilled on older rows) are the authoritative source once set —
    // prefer them over whatever could be parsed out of the raw payload.
    documentNumber = receipt.externalDocNumber ?? documentNumber;
    paymentDate = receipt.transactionDate ? isoToDdmmyyyy(receipt.transactionDate) : paymentDate;
    const receivedAt = receipt.receivedAt ? isoToDdmmyyyy(receipt.receivedAt) : undefined;

    return {
      receiptId: receipt.id,
      rawPayload: receipt.rawPayload,
      lines: receipt.lines.map((line) => ({
        id: line.id,
        childId: line.childId,
        month: line.month,
        amount: line.amount,
      })),
      rawPayerName,
      totalAmount,
      documentDate,
      paymentDate,
      documentNumber,
      product: product || undefined,
      receivedAt,
    };
  });
}
