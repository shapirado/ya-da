import { describe, expect, test } from "vitest";
import { getSupabaseClient } from "./client";
import { createPayer } from "./payers";
import { createChild } from "./children";
import { computeDueStatus } from "../dues";
import {
  createReceipt,
  isLineUnresolved,
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
    let payer: Awaited<ReturnType<typeof makePayer>> | undefined;
    let classGroupId: string | undefined;
    let child: Awaited<ReturnType<typeof createChild>> | undefined;
    let receiptId: string | undefined;

    try {
      payer = await makePayer("payerR1");
      classGroupId = await makeClassGroup("groupR1");
      child = await createChild({
        firstName: `ילדR1-${Date.now()}`,
        familyName: "כהן",
        classGroupId,
        gender: "boy",
        payerId: payer.id,
        enrollmentStart: "2026-09-01",
      });

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
      if (child) {
        await getSupabaseClient().from("children").delete().eq("id", child.id);
      }
      if (classGroupId) {
        await getSupabaseClient().from("class_groups").delete().eq("id", classGroupId);
      }
      if (payer) {
        await getSupabaseClient().from("payers").delete().eq("id", payer.id);
      }
    }
  });

  test("createReceipt with an unresolved line is needs_review; resolveReceiptLine flips it to matched", async () => {
    let payer: Awaited<ReturnType<typeof makePayer>> | undefined;
    let classGroupId: string | undefined;
    let child: Awaited<ReturnType<typeof createChild>> | undefined;
    let receiptId: string | undefined;

    try {
      payer = await makePayer("payerR2");
      classGroupId = await makeClassGroup("groupR2");
      child = await createChild({
        firstName: `ילדR2-${Date.now()}`,
        familyName: "לוי",
        classGroupId,
        gender: "girl",
        payerId: payer.id,
        enrollmentStart: "2026-09-01",
      });

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
      if (child) {
        await getSupabaseClient().from("children").delete().eq("id", child.id);
      }
      if (classGroupId) {
        await getSupabaseClient().from("class_groups").delete().eq("id", classGroupId);
      }
      if (payer) {
        await getSupabaseClient().from("payers").delete().eq("id", payer.id);
      }
    }
  });

  test("createReceipt with a known child/month but null amount is needs_review (ambiguous multi-cell manual payment)", async () => {
    let payer: Awaited<ReturnType<typeof makePayer>> | undefined;
    let classGroupId: string | undefined;
    let child: Awaited<ReturnType<typeof createChild>> | undefined;
    let receiptId: string | undefined;

    try {
      payer = await makePayer("payerR4");
      classGroupId = await makeClassGroup("groupR4");
      child = await createChild({
        firstName: `ילדR4-${Date.now()}`,
        familyName: "אבני",
        classGroupId,
        gender: "boy",
        payerId: payer.id,
        enrollmentStart: "2026-09-01",
      });

      // Simulates a multi-cell dashboard submission: childId/month are known
      // for each line, but the amount is intentionally left null because the
      // whole receipt amount is not auto-split across cells.
      const receipt = await createReceipt({
        source: "manual",
        lines: [
          { childId: child.id, month: "2026-09-01", amount: null, payerId: payer.id },
          { childId: child.id, month: "2026-10-01", amount: null, payerId: payer.id },
        ],
      });
      receiptId = receipt.id;

      expect(receipt.status).toBe("needs_review");

      const needsReview = await listNeedsReviewReceipts();
      expect(needsReview.find((r) => r.id === receiptId)).toBeTruthy();
    } finally {
      if (receiptId) {
        await getSupabaseClient().from("receipt_lines").delete().eq("receipt_id", receiptId);
        await getSupabaseClient().from("receipts").delete().eq("id", receiptId);
      }
      if (child) {
        await getSupabaseClient().from("children").delete().eq("id", child.id);
      }
      if (classGroupId) {
        await getSupabaseClient().from("class_groups").delete().eq("id", classGroupId);
      }
      if (payer) {
        await getSupabaseClient().from("payers").delete().eq("id", payer.id);
      }
    }
  });

  test("createReceipt stores method in its own column, not just raw_payload", async () => {
    let payer: Awaited<ReturnType<typeof makePayer>> | undefined;
    let classGroupId: string | undefined;
    let child: Awaited<ReturnType<typeof createChild>> | undefined;
    let receiptId: string | undefined;

    try {
      payer = await makePayer("payerR3");
      classGroupId = await makeClassGroup("groupR3");
      child = await createChild({
        firstName: `ילדR3-${Date.now()}`,
        familyName: "מזרחי",
        classGroupId,
        gender: "boy",
        payerId: payer.id,
        enrollmentStart: "2026-09-01",
      });

      const receipt = await createReceipt({
        source: "manual",
        method: "ביט",
        lines: [{ childId: child.id, month: "2026-09-01", amount: 500, payerId: payer.id }],
      });
      receiptId = receipt.id;

      expect(receipt.method).toBe("ביט");

      const { data, error } = await getSupabaseClient()
        .from("receipts")
        .select("method")
        .eq("id", receiptId)
        .single();
      if (error) throw error;
      expect((data as { method: string | null }).method).toBe("ביט");
    } finally {
      if (receiptId) {
        await getSupabaseClient().from("receipt_lines").delete().eq("receipt_id", receiptId);
        await getSupabaseClient().from("receipts").delete().eq("id", receiptId);
      }
      if (child) {
        await getSupabaseClient().from("children").delete().eq("id", child.id);
      }
      if (classGroupId) {
        await getSupabaseClient().from("class_groups").delete().eq("id", classGroupId);
      }
      if (payer) {
        await getSupabaseClient().from("payers").delete().eq("id", payer.id);
      }
    }
  });

  test("a multi-cell manual payment's null-amount lines need review; resolving them with entered amounts counts the months as paid", async () => {
    let payer: Awaited<ReturnType<typeof makePayer>> | undefined;
    let classGroupId: string | undefined;
    let child: Awaited<ReturnType<typeof createChild>> | undefined;
    let receiptId: string | undefined;

    try {
      payer = await makePayer("payerR5");
      classGroupId = await makeClassGroup("groupR5");
      child = await createChild({
        firstName: `ילדR5-${Date.now()}`,
        familyName: "גולן",
        classGroupId,
        gender: "girl",
        payerId: payer.id,
        enrollmentStart: "2026-09-01",
      });
      const prices = [{ amount: 300, effectiveFrom: "2026-09-01" }];

      const receipt = await createReceipt({
        source: "manual",
        rawPayload: { amount: 600 },
        lines: [
          { childId: child.id, month: "2026-09-01", amount: null, payerId: payer.id },
          { childId: child.id, month: "2026-10-01", amount: null, payerId: payer.id },
        ],
      });
      receiptId = receipt.id;

      const found = (await listNeedsReviewReceipts()).find((r) => r.id === receiptId);
      expect(found).toBeTruthy();
      // child/month are known, but the lines still count as needing review.
      expect(found!.lines.every((line) => line.childId && line.month)).toBe(true);
      expect(found!.lines.filter(isLineUnresolved).length).toBe(2);

      const before = computeDueStatus(
        child.enrollmentStart,
        prices,
        await listReceiptLinesForChild(child.id),
        "2026-10-01",
      );
      expect(before.map((m) => m.status)).toEqual(["missing", "missing"]);

      // Resolve the first line only: receipt stays needs_review.
      const [first, second] = found!.lines.sort((a, b) => (a.month! < b.month! ? -1 : 1));
      const resolvedFirst = await resolveReceiptLine(first.id, {
        childId: child.id,
        month: first.month!,
        amount: 300,
      });
      expect(resolvedFirst.amount).toBe(300);
      expect((await listNeedsReviewReceipts()).find((r) => r.id === receiptId)).toBeTruthy();

      await resolveReceiptLine(second.id, { childId: child.id, month: second.month!, amount: 300 });
      expect((await listNeedsReviewReceipts()).find((r) => r.id === receiptId)).toBeFalsy();

      const after = computeDueStatus(
        child.enrollmentStart,
        prices,
        await listReceiptLinesForChild(child.id),
        "2026-10-01",
      );
      expect(after.map((m) => m.status)).toEqual(["paid", "paid"]);
    } finally {
      if (receiptId) {
        await getSupabaseClient().from("receipt_lines").delete().eq("receipt_id", receiptId);
        await getSupabaseClient().from("receipts").delete().eq("id", receiptId);
      }
      if (child) {
        await getSupabaseClient().from("children").delete().eq("id", child.id);
      }
      if (classGroupId) {
        await getSupabaseClient().from("class_groups").delete().eq("id", classGroupId);
      }
      if (payer) {
        await getSupabaseClient().from("payers").delete().eq("id", payer.id);
      }
    }
  });

  test("resolveReceiptLine without an amount leaves the line's existing amount untouched", async () => {
    let payer: Awaited<ReturnType<typeof makePayer>> | undefined;
    let classGroupId: string | undefined;
    let child: Awaited<ReturnType<typeof createChild>> | undefined;
    let receiptId: string | undefined;

    try {
      payer = await makePayer("payerR6");
      classGroupId = await makeClassGroup("groupR6");
      child = await createChild({
        firstName: `ילדR6-${Date.now()}`,
        familyName: "שחר",
        classGroupId,
        gender: "boy",
        payerId: payer.id,
        enrollmentStart: "2026-09-01",
      });

      const receipt = await createReceipt({
        source: "morning_webhook",
        lines: [{ month: "2026-10-01", amount: 250 }],
      });
      receiptId = receipt.id;
      const line = (await listNeedsReviewReceipts()).find((r) => r.id === receiptId)!.lines[0];

      const resolved = await resolveReceiptLine(line.id, { childId: child.id, month: "2026-10-01" });
      expect(resolved.amount).toBe(250);
    } finally {
      if (receiptId) {
        await getSupabaseClient().from("receipt_lines").delete().eq("receipt_id", receiptId);
        await getSupabaseClient().from("receipts").delete().eq("id", receiptId);
      }
      if (child) {
        await getSupabaseClient().from("children").delete().eq("id", child.id);
      }
      if (classGroupId) {
        await getSupabaseClient().from("class_groups").delete().eq("id", classGroupId);
      }
      if (payer) {
        await getSupabaseClient().from("payers").delete().eq("id", payer.id);
      }
    }
  });
});
