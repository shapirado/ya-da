"use server";

import { revalidatePath } from "next/cache";
import { updatePayer, type PayerInput } from "@/src/lib/db/payers";
import { updateChild, setChildPrice, type ChildInput } from "@/src/lib/db/children";

export async function saveChild(
  childId: string,
  input: Partial<ChildInput>,
): Promise<void> {
  if (Object.keys(input).length === 0) return;
  await updateChild(childId, input);
  revalidatePath("/families");
}

export async function savePrice(
  childId: string,
  input: { amount: number; effectiveFrom: string },
): Promise<void> {
  await setChildPrice(childId, input);
  revalidatePath("/families");
}

export async function savePayer(
  payerId: string,
  input: Partial<PayerInput>,
): Promise<void> {
  if (Object.keys(input).length === 0) return;
  await updatePayer(payerId, input);
  revalidatePath("/families");
}
