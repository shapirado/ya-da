import { describe, expect, test } from "vitest";
import { getSupabaseClient } from "./client";
import { createPayer } from "./payers";
import { createChild } from "./children";
import {
  createReceipt,
  listNeedsReviewReceipts,
  listReceiptLinesForChild,
  resolveReceiptLine,
} from "./receipts";

async function makePayer(label: string) {
  return createPayer({ displayName: `${label}-${Date.now()}-${Math.random().toString(36).slice(2)}`, role: "mom" });
}

async function makeClassGroup(label: string) {
  const { data, error } = await getSupabaseClient()
    .from("class_groups")
    .insert({ day: `${label}-${Date.now()}-${Math.random().toString(36).slice(2)}`, time: "09:00", color: "#654321" })
    .select()
    .single();
  if (error) throw error;
  return data!.id as string;
}

describe("receipts", () => {
  test("createReceipt with fully-resolved lines is matched", async () => {
    const payer = await makePayer("payerR1");
    const classGroupId = await makeClassGroup("groupR1");
    const child = await createChild({
      firstName: `ילדR1-${Date.now()}`,
      familyName: "כהן",
      classGroupId,
      gender: "boy",
      payerId: payer.id,
      enrollmentStart: "2026-09-01",
    });

    let receiptId: string | undefined;
    try {
      const receipt = await createReceipt({
        source: "manual",
        lines: [{ childId: child.id, month: "2026-09-01", amount: 500, payerId: payer.id }],
      });
      receiptId = receipt.id;

      expect(receipt.status).toBe("matched");

      const lines = await listReceiptLinesForChild(child.id);
      expect(lines.length).toBe(1);
      expect(lines[0].month).toBe("2026-09-01");
      expect(lines[0].amount).toBe(500);
    } finally {
      if (receiptId) {
        await getSupabaseClient().from("receipt_lines").delete().eq("receipt_id", receiptId);
        await getSupabaseClient().from("receipts").delete().eq("id", receiptId);
      }
      await getSupabaseClient().from("children").delete().eq("id", child.id);
      await getSupabaseClient().from("class_groups").delete().eq("id", classGroupId);
      await getSupabaseClient().from("payers").delete().eq("id", payer.id);
    }
  });

  test("createReceipt with an unresolved line is needs_review; resolveReceiptLine flips it to matched", async () => {
    const payer = await makePayer("payerR2");
    const classGroupId = await makeClassGroup("groupR2");
    const child = await createChild({
      firstName: `ילדR2-${Date.now()}`,
      familyName: "לוי",
      classGroupId,
      gender: "girl",
      payerId: payer.id,
      enrollmentStart: "2026-09-01",
    });

    let receiptId: string | undefined;
    try {
      const receipt = await createReceipt({
        source: "manual",
        lines: [
          { childId: child.id, month: "2026-09-01", amount: 500, payerId: payer.id },
          { amount: 300, payerId: payer.id }, // unresolved: no childId/month
        ],
      });
      receiptId = receipt.id;
      expect(receipt.status).toBe("needs_review");

      const needsReview = await listNeedsReviewReceipts();
      const found = needsReview.find((r) => r.id === receiptId);
      expect(found).toBeTruthy();
      expect(found!.lines.length).toBe(2);

      const unresolvedLine = found!.lines.find((l) => l.childId === null || l.childId === undefined);
      expect(unresolvedLine).toBeTruthy();

      const resolved = await resolveReceiptLine(unresolvedLine!.id, {
        childId: child.id,
        month: "2026-10-01",
      });
      expect(resolved.childId).toBe(child.id);
      expect(resolved.month).toBe("2026-10-01");

      const stillNeedsReview = await listNeedsReviewReceipts();
      expect(stillNeedsReview.find((r) => r.id === receiptId)).toBeFalsy();

      const linesForChild = await listReceiptLinesForChild(child.id);
      expect(linesForChild.length).toBe(2);
    } finally {
      if (receiptId) {
        await getSupabaseClient().from("receipt_lines").delete().eq("receipt_id", receiptId);
        await getSupabaseClient().from("receipts").delete().eq("id", receiptId);
      }
      await getSupabaseClient().from("children").delete().eq("id", child.id);
      await getSupabaseClient().from("class_groups").delete().eq("id", classGroupId);
      await getSupabaseClient().from("payers").delete().eq("id", payer.id);
    }
  });
});
