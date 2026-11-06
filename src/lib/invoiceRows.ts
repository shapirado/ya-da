import type { ChildWithPayer } from "@/src/lib/db/children";
import { payerFullName, type Payer } from "@/src/lib/db/payers";
import type { ReceiptWithLines } from "@/src/lib/db/receipts";
import { parseRecipientName } from "@/src/lib/morning";

export type InvoiceRow = {
  receiptId: string;
  status: "matched" | "needs_review";
  source: "morning_webhook" | "manual";
  method: string | null;
  documentNumber?: string;
  date?: string; // ddmmyyyy — the document's own issue date, for display
  paymentDate?: string; // ddmmyyyy — the actual payment date, when known (may differ from `date`)
  product?: string; // line-item description(s)/SKU, e.g. "אוקטובר · חוג אומנות - ממשיכים"
  amount?: number;
  payerName?: string;
  payerPhone?: string;
  payerEmail?: string;
  childNames: string[];
  months: string[]; // 'YYYY-MM-01', every distinct month this receipt's lines cover
};

function isoToDdmmyyyy(iso: string): string | undefined {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return undefined;
  const [, yyyy, mm, dd] = match;
  return `${dd}${mm}${yyyy}`;
}

type MorningItem = { description?: string; sku?: string };
type MorningTransaction = { date?: string };

// Builds one display row per receipt for the full invoices log — unlike
// buildReceiptReviewItems (src/lib/receiptReviewItems.ts), this covers
// every receipt regardless of status and resolves real child/payer names
// for every line, not just the unresolved ones.
export function buildInvoiceRows(
  receipts: ReceiptWithLines[],
  children: ChildWithPayer[],
  payers: Payer[],
): InvoiceRow[] {
  const childById = new Map(children.map((child) => [child.id, child]));
  const payerById = new Map(payers.map((payer) => [payer.id, payer]));

  return receipts.map((receipt) => {
    const payload =
      receipt.rawPayload && typeof receipt.rawPayload === "object"
        ? (receipt.rawPayload as {
            recipient?: { name?: string };
            amount?: unknown;
            total?: unknown;
            date?: unknown;
            number?: unknown;
            receiptNumber?: unknown;
            items?: MorningItem[];
            transactions?: MorningTransaction[];
          })
        : undefined;

    let amount: number | undefined;
    let date: string | undefined;
    let paymentDate: string | undefined;
    let documentNumber: string | undefined;
    let product: string | undefined;
    let fallbackPayerName: string | undefined;

    if (receipt.source === "manual") {
      amount = typeof payload?.amount === "number" ? payload.amount : undefined;
      date = typeof payload?.date === "string" ? payload.date : undefined; // already ddmmyyyy
      paymentDate = date; // a manual entry's one date serves both purposes
      documentNumber = typeof payload?.receiptNumber === "string" ? payload.receiptNumber : undefined;
    } else {
      amount = typeof payload?.total === "number" ? payload.total : undefined;
      date = typeof payload?.date === "string" ? isoToDdmmyyyy(payload.date) : undefined;
      const transactionDate = payload?.transactions?.[0]?.date;
      paymentDate = typeof transactionDate === "string" ? isoToDdmmyyyy(transactionDate) : date;
      documentNumber = payload?.number !== undefined ? String(payload.number) : undefined;
      product = payload?.items
        ?.map((item) => [item.description, item.sku].filter(Boolean).join(" - "))
        .filter(Boolean)
        .join(" · ");
      const parsed = payload?.recipient?.name ? parseRecipientName(payload.recipient.name) : null;
      fallbackPayerName = parsed?.payerName;
    }

    const childNames = Array.from(
      new Set(
        receipt.lines
          .map((line) => (line.childId ? childById.get(line.childId) : undefined))
          .filter((child): child is ChildWithPayer => !!child)
          .map((child) => `${child.firstName} ${child.familyName}`),
      ),
    );

    const matchedPayer = receipt.payerId ? payerById.get(receipt.payerId) : undefined;
    const payerName = matchedPayer ? payerFullName(matchedPayer) : fallbackPayerName;
    const payerPhone = matchedPayer?.phone ?? undefined;
    const payerEmail = matchedPayer?.email ?? undefined;

    const months = Array.from(
      new Set(receipt.lines.map((line) => line.month).filter((m): m is string => !!m)),
    ).sort();

    // Fall back to summing resolved line amounts when the raw payload
    // carried none (e.g. an amount-only manual mark-as-paid entry).
    if (amount === undefined) {
      const lineSum = receipt.lines.reduce((sum, line) => sum + (line.amount ?? 0), 0);
      amount = lineSum > 0 ? lineSum : undefined;
    }

    // The DB columns (filled in going forward by createReceipt, and
    // backfilled on older rows) are authoritative once set.
    documentNumber = receipt.externalDocNumber ?? documentNumber;
    paymentDate = receipt.transactionDate ? isoToDdmmyyyy(receipt.transactionDate) : paymentDate;

    return {
      receiptId: receipt.id,
      status: receipt.status,
      source: receipt.source,
      method: receipt.method,
      documentNumber,
      date,
      paymentDate,
      product: product || undefined,
      amount,
      payerName,
      payerPhone,
      payerEmail,
      childNames,
      months,
    };
  });
}
