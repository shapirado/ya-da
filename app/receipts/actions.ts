"use server";

import { revalidatePath } from "next/cache";
import { recordPayerNameAlias } from "@/src/lib/db/payers";
import { resolveReceiptLine } from "@/src/lib/db/receipts";

export type ResolveReceiptLineInput = {
  payerId?: string;
  childId: string;
  month: string;
  // The reviewer's entered/confirmed amount for this line (e.g. their split
  // of a multi-cell payment's total). Omitted keeps the line's amount.
  amount?: number;
  // The raw payer name as it appeared on the Morning document (parsed from
  // recipient.name), when known. Recording it against the resolved payer
  // means the same raw name auto-matches next time, via
  // findPayerByNameOrAlias.
  rawPayerName?: string;
};

export async function resolveReceipt(lineId: string, input: ResolveReceiptLineInput): Promise<void> {
  await resolveReceiptLine(lineId, {
    childId: input.childId,
    month: input.month,
    amount: input.amount,
  });

  if (input.payerId && input.rawPayerName) {
    await recordPayerNameAlias(input.payerId, input.rawPayerName);
  }

  revalidatePath("/receipts");
}
