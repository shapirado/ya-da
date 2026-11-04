"use server";

import { revalidatePath } from "next/cache";
import { listChildrenWithPayer } from "@/src/lib/db/children";
import { createReceipt } from "@/src/lib/db/receipts";

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
    rawPayload: {
      method: input.method,
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
