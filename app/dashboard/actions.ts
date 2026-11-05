"use server";

import { revalidatePath } from "next/cache";
import {
  listChildrenWithPayer,
  updateChild,
  setChildPrice,
  createChild,
  type ChildInput,
} from "@/src/lib/db/children";
import { updatePayer, createPayer, type PayerInput } from "@/src/lib/db/payers";
import { createReceipt } from "@/src/lib/db/receipts";
import type { CreateReceiptInput } from "@/src/components/RecordPayment/RecordPaymentModal";
import type { CreateStudentInput } from "@/src/components/dashboard/NewStudentModal";

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

export async function updateChildFromDashboard(
  childId: string,
  input: Partial<ChildInput>,
): Promise<void> {
  if (Object.keys(input).length === 0) return;
  await updateChild(childId, input);
  revalidatePath("/dashboard");
  revalidatePath("/families");
}

export async function setChildPriceFromDashboard(
  childId: string,
  input: { amount: number; effectiveFrom: string },
): Promise<void> {
  await setChildPrice(childId, input);
  revalidatePath("/dashboard");
  revalidatePath("/families");
}

export async function updatePayerFromDashboard(
  payerId: string,
  input: Partial<PayerInput>,
): Promise<void> {
  if (Object.keys(input).length === 0) return;
  await updatePayer(payerId, input);
  revalidatePath("/dashboard");
  revalidatePath("/families");
}

// Creates a new student from the dashboard's "תלמיד/ה חדש/ה" button. Either
// an existing payer is reused (input.payerId) or a new one is created first
// (input.newPayer) — exactly one of the two is set, enforced by the modal.
export async function createStudent(input: CreateStudentInput): Promise<void> {
  const payerId = input.payerId ?? (await createPayer(input.newPayer!)).id;

  const child = await createChild({
    firstName: input.firstName,
    familyName: input.familyName,
    classGroupId: input.classGroupId,
    gender: input.gender,
    payerId,
    enrollmentStart: input.enrollmentStart,
  });

  if (input.startingPrice) {
    await setChildPrice(child.id, {
      amount: input.startingPrice,
      effectiveFrom: input.enrollmentStart,
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/families");
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
