"use server";

import { revalidatePath } from "next/cache";
import { createReceipt } from "@/src/lib/db/receipts";
import type { CreateReceiptInput } from "@/src/components/RecordPayment/RecordPaymentModal";

// Manual payment entry from the year view's grid cells. Mirrors
// app/dashboard/actions.ts#recordPayment: the whole-receipt amount is
// recorded as entered and is NOT auto-split across several selected
// child/month cells.
export async function recordPayment(input: CreateReceiptInput): Promise<void> {
  const lines =
    input.lines.length === 1
      ? [{ ...input.lines[0], amount: input.amount, payerId: input.payerId }]
      : input.lines.map((line) => ({ ...line, payerId: input.payerId }));

  await createReceipt({
    source: "manual",
    method: input.method,
    rawPayload: {
      amount: input.amount,
      date: input.date,
      paidBy: input.paidBy,
      receiptNumber: input.receiptNumber,
    },
    lines,
  });

  revalidatePath("/year");
}
