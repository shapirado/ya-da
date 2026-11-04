"use server";

import { revalidatePath } from "next/cache";
import { listChildrenWithPayer } from "@/src/lib/db/children";
import { createReceipt } from "@/src/lib/db/receipts";
import type { CreateReceiptInput } from "@/src/components/RecordPayment/RecordPaymentModal";

export type MarkMonthPaidInput = {
  amount: number;
  method: string;
  receiptNumber: string;
};

export async function markMonthPaid(
  childId: string,
  month: string,
  input: MarkMonthPaidInput,
): Promise<void> {
  const children = await listChildrenWithPayer();
  const child = children.find((candidate) => candidate.id === childId);
  if (!child) {
    throw new Error(`Child ${childId} not found`);
  }
  if (!child.payerId) {
    throw new Error(`Child ${childId} has no payer`);
  }

  await createReceipt({
    source: "manual",
    method: input.method,
    rawPayload: {
      receiptNumber: input.receiptNumber,
    },
    lines: [
      {
        childId,
        month,
        amount: input.amount,
        payerId: child.payerId,
      },
    ],
  });

  revalidatePath("/dashboard");
}

// Manual payment entry from the dashboard's "רישום תשלום ידני" button.
// The whole-receipt amount comes from the modal as entered; when a single
// child/month cell was selected that whole amount is the line's amount,
// but when several cells were selected the amount is NOT split across them
// — each line's amount stays null until a human resolves the ambiguity.
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

  revalidatePath("/dashboard");
}
