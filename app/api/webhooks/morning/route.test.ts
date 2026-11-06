import { afterEach, describe, expect, test } from "vitest";
import { createHmac } from "crypto";
import { getSupabaseClient } from "@/src/lib/db/client";
import { createChild } from "@/src/lib/db/children";
import { createPayer } from "@/src/lib/db/payers";
import { listNeedsReviewReceipts, listReceiptLinesForChild } from "@/src/lib/db/receipts";
import { POST } from "./route";

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function postRequest(body: string, headers: Record<string, string> = {}): Request {
  return new Request("http://x/api/webhooks/morning", {
    method: "POST",
    headers,
    body,
  });
}

async function cleanupReceiptByMarker(marker: string): Promise<void> {
  const needsReview = await listNeedsReviewReceipts();
  const found = needsReview.find((r) => {
    const raw = r.rawPayload;
    if (typeof raw === "string") return raw.includes(marker);
    if (raw && typeof raw === "object") return JSON.stringify(raw).includes(marker);
    return false;
  });
  if (found) {
    await getSupabaseClient().from("receipt_lines").delete().eq("receipt_id", found.id);
    await getSupabaseClient().from("receipts").delete().eq("id", found.id);
  }
}

describe("POST /api/webhooks/morning", () => {
  afterEach(() => {
    delete process.env.MORNING_WEBHOOK_SECRET;
  });

  test("a malformed, non-JSON body is still captured as needs_review, never dropped", async () => {
    const marker = `not-json-${uniqueSuffix()}`;
    const res = await POST(postRequest(`not json {{{ ${marker}`));
    expect(res.status).toBe(200);

    const needsReview = await listNeedsReviewReceipts();
    const found = needsReview.find(
      (r) => typeof r.rawPayload === "string" && r.rawPayload.includes(marker),
    );
    expect(found).toBeTruthy();

    await cleanupReceiptByMarker(marker);
  });

  test("document/created type 320 with a resolvable payer+child and a valid signature becomes a matched receipt", async () => {
    process.env.MORNING_WEBHOOK_SECRET = "test-secret";
    const suffix = uniqueSuffix();
    const payer = await createPayer({ displayName: `צפי ברנר ${suffix}`, role: "mom" });
    const { data: groupData, error: groupError } = await getSupabaseClient()
      .from("class_groups")
      .insert({ day: `day-${suffix}`, time: "09:00", color: "#112233" })
      .select()
      .single();
    if (groupError) throw groupError;
    const classGroupId = groupData!.id as string;
    const child = await createChild({
      firstName: `עמליה ${suffix}`,
      familyName: "ברנר",
      classGroupId,
      gender: "girl",
      payerId: payer.id,
      enrollmentStart: "2026-01-01",
    });

    try {
      const payload = {
        type: 320,
        number: 1565,
        recipient: { name: `${payer.displayName} (${child.firstName})` },
        items: [{ description: "אוקטובר", sku: "חוג אומנות", price: 300, quantity: 1 }],
        date: "2026-10-15",
        total: 300,
        transactions: [{ price: 300, date: "2026-10-07" }],
      };

      const body = JSON.stringify(payload);
      const signature = createHmac("sha256", "test-secret").update(body, "utf8").digest("hex");
      const res = await POST(
        postRequest(body, {
          "x-webhook-topic": "document/created",
          "x-webhook-signature": signature,
        }),
      );
      expect(res.status).toBe(200);

      const { data, error } = await getSupabaseClient()
        .from("receipt_lines")
        .select("*, receipts(*)")
        .eq("child_id", child.id);
      if (error) throw error;
      expect(data!.length).toBe(1);
      expect(data![0].month).toBe("2026-10-01");
      expect(data![0].amount).toBe(300);
      const storedReceipt = data![0].receipts as {
        status: string;
        payer_id: string;
        external_doc_number: string;
        transaction_date: string;
      };
      expect(storedReceipt.status).toBe("matched");
      expect(storedReceipt.payer_id).toBe(payer.id);
      expect(storedReceipt.external_doc_number).toBe("1565");
      expect(storedReceipt.transaction_date).toBe("2026-10-07");
    } finally {
      const { data: lineRows } = await getSupabaseClient()
        .from("receipt_lines")
        .select("id, receipt_id")
        .eq("child_id", child.id);
      const receiptIds = (lineRows ?? []).map((row) => row.receipt_id as string);
      await getSupabaseClient().from("receipt_lines").delete().eq("child_id", child.id);
      if (receiptIds.length > 0) {
        await getSupabaseClient().from("receipts").delete().in("id", receiptIds);
      }
      await getSupabaseClient().from("children").delete().eq("id", child.id);
      await getSupabaseClient().from("class_groups").delete().eq("id", classGroupId);
      await getSupabaseClient().from("payers").delete().eq("id", payer.id);
    }
  });

  test("with no MORNING_WEBHOOK_SECRET, a fully resolvable receipt is NOT auto-matched and doesn't count for the child", async () => {
    delete process.env.MORNING_WEBHOOK_SECRET;
    const suffix = uniqueSuffix();
    const payer = await createPayer({ displayName: `נועה שגיא ${suffix}`, role: "mom" });
    const { data: groupData, error: groupError } = await getSupabaseClient()
      .from("class_groups")
      .insert({ day: `day-${suffix}`, time: "09:00", color: "#112233" })
      .select()
      .single();
    if (groupError) throw groupError;
    const classGroupId = groupData!.id as string;
    const child = await createChild({
      firstName: `תמר ${suffix}`,
      familyName: "שגיא",
      classGroupId,
      gender: "girl",
      payerId: payer.id,
      enrollmentStart: "2026-01-01",
    });

    try {
      const payload = {
        type: 320,
        recipient: { name: `${payer.displayName} (${child.firstName})` },
        items: [{ description: "אוקטובר", sku: "חוג אומנות", price: 300, quantity: 1 }],
        date: "2026-10-15",
        total: 300,
      };
      const res = await POST(
        postRequest(JSON.stringify(payload), { "x-webhook-topic": "document/created" }),
      );
      expect(res.status).toBe(200);

      const needsReview = await listNeedsReviewReceipts();
      const found = needsReview.find((r) => JSON.stringify(r.rawPayload ?? {}).includes(suffix));
      expect(found).toBeTruthy();
      expect(found!.status).toBe("needs_review");
      expect(found!.lines).toHaveLength(1);
      expect(found!.payerId).toBeNull();
      expect(found!.lines[0]).toMatchObject({ childId: null, month: "2026-10-01", amount: 300 });

      expect(await listReceiptLinesForChild(child.id)).toHaveLength(0);
    } finally {
      await cleanupReceiptByMarker(suffix);
      await getSupabaseClient().from("children").delete().eq("id", child.id);
      await getSupabaseClient().from("class_groups").delete().eq("id", classGroupId);
      await getSupabaseClient().from("payers").delete().eq("id", payer.id);
    }
  });

  test("document/created type 320 with an unresolvable payer falls back to needs_review", async () => {
    const suffix = uniqueSuffix();
    const payload = {
      type: 320,
      recipient: { name: `אין כזו משלמת ${suffix} (ילד כלשהו)` },
      items: [{ description: "אוקטובר", sku: "חוג אומנות", price: 300, quantity: 1 }],
      date: "2026-10-15",
      total: 300,
    };

    const res = await POST(
      postRequest(JSON.stringify(payload), { "x-webhook-topic": "document/created" }),
    );
    expect(res.status).toBe(200);

    const needsReview = await listNeedsReviewReceipts();
    const found = needsReview.find(
      (r) => JSON.stringify(r.rawPayload ?? {}).includes(suffix),
    );
    expect(found).toBeTruthy();
    expect(found!.lines.every((l) => !l.childId)).toBe(true);

    await cleanupReceiptByMarker(suffix);
  });

  test("document/created with a non-receipt type (!== 320) falls back to needs_review", async () => {
    const suffix = uniqueSuffix();
    const payload = {
      type: 100,
      recipient: { name: `מישהו ${suffix} (ילד)` },
      items: [{ description: "אוקטובר", sku: "x", price: 100, quantity: 1 }],
      date: "2026-10-15",
    };

    const res = await POST(
      postRequest(JSON.stringify(payload), { "x-webhook-topic": "document/created" }),
    );
    expect(res.status).toBe(200);

    const needsReview = await listNeedsReviewReceipts();
    const found = needsReview.find((r) => JSON.stringify(r.rawPayload ?? {}).includes(suffix));
    expect(found).toBeTruthy();
    expect(found!.lines.length).toBe(0);

    await cleanupReceiptByMarker(suffix);
  });

  test("client/created (signed) updates the matched payer's phone/email, preferring mobile", async () => {
    process.env.MORNING_WEBHOOK_SECRET = "test-secret";
    const suffix = uniqueSuffix();
    const displayName = `מיכל לוי ${suffix}`;
    const payer = await createPayer({ displayName, role: "mom" });

    try {
      const payload = {
        name: displayName,
        phone: "050-0000000",
        mobile: "052-9999999",
        emails: ["michal@example.com"],
      };
      const body = JSON.stringify(payload);
      const signature = createHmac("sha256", "test-secret").update(body, "utf8").digest("hex");
      const res = await POST(
        postRequest(body, { "x-webhook-topic": "client/created", "x-webhook-signature": signature }),
      );
      expect(res.status).toBe(200);

      const { data, error } = await getSupabaseClient()
        .from("payers")
        .select("phone, email")
        .eq("id", payer.id)
        .single();
      if (error) throw error;
      expect(data!.phone).toBe("052-9999999");
      expect(data!.email).toBe("michal@example.com");
    } finally {
      await getSupabaseClient().from("payers").delete().eq("id", payer.id);
    }
  });

  test("client/created with no MORNING_WEBHOOK_SECRET does not touch the payer's contact details", async () => {
    delete process.env.MORNING_WEBHOOK_SECRET;
    const suffix = uniqueSuffix();
    const displayName = `רוני כץ ${suffix}`;
    const payer = await createPayer({ displayName, role: "dad" });

    try {
      const payload = { name: displayName, mobile: "052-1111111", emails: ["x@example.com"] };
      const res = await POST(
        postRequest(JSON.stringify(payload), { "x-webhook-topic": "client/created" }),
      );
      expect(res.status).toBe(200);

      const { data, error } = await getSupabaseClient()
        .from("payers")
        .select("phone, email")
        .eq("id", payer.id)
        .single();
      if (error) throw error;
      expect(data!.phone).toBeNull();
      expect(data!.email).toBeNull();
    } finally {
      await getSupabaseClient().from("payers").delete().eq("id", payer.id);
    }
  });

  test("client/created with no matching payer is a quiet no-op, still 200", async () => {
    const suffix = uniqueSuffix();
    const payload = { name: `לא קיימת ${suffix}`, mobile: "052-0000000" };
    const res = await POST(
      postRequest(JSON.stringify(payload), { "x-webhook-topic": "client/created" }),
    );
    expect(res.status).toBe(200);
  });

  test("an unknown/unhandled topic is acknowledged with 200 and ignored (no receipt stored)", async () => {
    const suffix = uniqueSuffix();
    const payload = { marker: suffix, something: "else" };
    const res = await POST(
      postRequest(JSON.stringify(payload), { "x-webhook-topic": "invoice/paid" }),
    );
    expect(res.status).toBe(200);

    const needsReview = await listNeedsReviewReceipts();
    const found = needsReview.find((r) => JSON.stringify(r.rawPayload ?? {}).includes(suffix));
    expect(found).toBeFalsy();
  });

  test("an invalid signature (when a secret is configured) falls back to needs_review", async () => {
    process.env.MORNING_WEBHOOK_SECRET = "test-secret";
    const suffix = uniqueSuffix();
    const payload = {
      type: 320,
      recipient: { name: `לא משנה ${suffix} (ילד)` },
      items: [{ description: "אוקטובר", sku: "x", price: 100, quantity: 1 }],
      date: "2026-10-15",
    };
    const body = JSON.stringify(payload);

    const res = await POST(
      postRequest(body, {
        "x-webhook-topic": "document/created",
        "x-webhook-signature": "0".repeat(64),
      }),
    );
    expect(res.status).toBe(200);

    const needsReview = await listNeedsReviewReceipts();
    const found = needsReview.find((r) => {
      const raw = r.rawPayload;
      return typeof raw === "string" ? raw.includes(suffix) : JSON.stringify(raw ?? {}).includes(suffix);
    });
    expect(found).toBeTruthy();
    // Stored as the raw, unprocessed body (string) since verification
    // happens before any processing, not the re-serialized JSON object.
    expect(typeof found!.rawPayload).toBe("string");

    await cleanupReceiptByMarker(suffix);
  });

  test("a valid signature (when a secret is configured) is processed normally", async () => {
    process.env.MORNING_WEBHOOK_SECRET = "test-secret";
    const suffix = uniqueSuffix();
    const payload = {
      type: 320,
      recipient: { name: `לא משנה ${suffix} (ילד)` },
      items: [{ description: "אוקטובר", sku: "x", price: 100, quantity: 1 }],
      date: "2026-10-15",
    };
    const body = JSON.stringify(payload);
    const signature = createHmac("sha256", "test-secret").update(body, "utf8").digest("hex");

    const res = await POST(
      postRequest(body, {
        "x-webhook-topic": "document/created",
        "x-webhook-signature": signature,
      }),
    );
    expect(res.status).toBe(200);

    const needsReview = await listNeedsReviewReceipts();
    const found = needsReview.find((r) => JSON.stringify(r.rawPayload ?? {}).includes(suffix));
    expect(found).toBeTruthy();
    // Processed (not the raw-signature-rejection path): rawPayload is the
    // parsed object, not the raw string.
    expect(typeof found!.rawPayload).toBe("object");

    await cleanupReceiptByMarker(suffix);
  });
});
