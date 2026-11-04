import { describe, expect, test, afterEach } from "vitest";
import { getSupabaseClient } from "./db/client";
import { createChild } from "./db/children";
import { createPayer } from "./db/payers";
import {
  CLIENT_CREATED_TOPIC,
  DOCUMENT_CREATED_TOPIC,
  RECEIPT_DOCUMENT_TYPE,
  computeContactUpdate,
  hebrewMonthNameToNumber,
  parseRecipientName,
  processClientCreated,
  resolveDocumentCreatedLines,
  verifyMorningSignature,
  type MorningDocumentPayload,
} from "./morning";

describe("morning: topic constants", () => {
  test("names match Morning's own header values", () => {
    expect(DOCUMENT_CREATED_TOPIC).toBe("document/created");
    expect(CLIENT_CREATED_TOPIC).toBe("client/created");
    expect(RECEIPT_DOCUMENT_TYPE).toBe(320);
  });
});

describe("hebrewMonthNameToNumber", () => {
  const cases: Array<[string, string]> = [
    ["ינואר", "01"],
    ["פברואר", "02"],
    ["מרץ", "03"],
    ["אפריל", "04"],
    ["מאי", "05"],
    ["יוני", "06"],
    ["יולי", "07"],
    ["אוגוסט", "08"],
    ["ספטמבר", "09"],
    ["אוקטובר", "10"],
    ["נובמבר", "11"],
    ["דצמבר", "12"],
  ];

  test.each(cases)("maps %s to %s", (name, expected) => {
    expect(hebrewMonthNameToNumber(name)).toBe(expected);
  });

  test("trims whitespace", () => {
    expect(hebrewMonthNameToNumber("  אוקטובר  ")).toBe("10");
  });

  test("returns null for an unrecognized name", () => {
    expect(hebrewMonthNameToNumber("לא חודש")).toBeNull();
  });
});

describe("parseRecipientName", () => {
  test("splits '<payer> (<child>)' into trimmed payer/child names", () => {
    expect(parseRecipientName("צפי ברנר (עמליה)")).toEqual({
      payerName: "צפי ברנר",
      childName: "עמליה",
    });
  });

  test("trims extra whitespace around the parenthetical", () => {
    expect(parseRecipientName("  דני כהן   ( יובל )  ")).toEqual({
      payerName: "דני כהן",
      childName: "יובל",
    });
  });

  test("returns null when there is no parenthetical", () => {
    expect(parseRecipientName("צפי ברנר")).toBeNull();
  });
});

describe("verifyMorningSignature", () => {
  const secret = "test-secret";
  const body = JSON.stringify({ hello: "world" });

  function validSignature(): string {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createHmac } = require("crypto");
    return createHmac("sha256", secret).update(body, "utf8").digest("hex");
  }

  test("skips verification (returns true) when no secret is configured", () => {
    expect(verifyMorningSignature(body, null, undefined)).toBe(true);
    expect(verifyMorningSignature(body, "garbage", undefined)).toBe(true);
  });

  test("accepts a correct HMAC-SHA256 hex signature over the raw body", () => {
    expect(verifyMorningSignature(body, validSignature(), secret)).toBe(true);
  });

  test("rejects a missing signature when a secret is configured", () => {
    expect(verifyMorningSignature(body, null, secret)).toBe(false);
    expect(verifyMorningSignature(body, undefined, secret)).toBe(false);
  });

  test("rejects an incorrect signature", () => {
    expect(verifyMorningSignature(body, "0".repeat(64), secret)).toBe(false);
  });

  test("rejects when the body was tampered with after signing", () => {
    const sig = validSignature();
    expect(verifyMorningSignature(body + "x", sig, secret)).toBe(false);
  });
});

describe("resolveDocumentCreatedLines", () => {
  afterEach(async () => {
    // individual tests clean up their own fixtures
  });

  test("resolves payer + child and maps Hebrew month items to YYYY-MM-01 lines", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
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
      const payload: MorningDocumentPayload = {
        type: RECEIPT_DOCUMENT_TYPE,
        recipient: { name: `${payer.displayName} (${child.firstName})` },
        items: [
          { description: "אוקטובר", sku: "חוג אומנות", price: 300, quantity: 1 },
          { description: "נובמבר", sku: "חוג אומנות", price: 300, quantity: 1 },
        ],
        date: "2026-10-15",
        total: 600,
      };

      const { lines } = await resolveDocumentCreatedLines(payload);
      expect(lines).toEqual([
        { month: "2026-10-01", amount: 300, childId: child.id, payerId: payer.id },
        { month: "2026-11-01", amount: 300, childId: child.id, payerId: payer.id },
      ]);
    } finally {
      await getSupabaseClient().from("children").delete().eq("id", child.id);
      await getSupabaseClient().from("class_groups").delete().eq("id", classGroupId);
      await getSupabaseClient().from("payers").delete().eq("id", payer.id);
    }
  });

  test("leaves childId/payerId unset when the payer name doesn't match anything", async () => {
    const payload: MorningDocumentPayload = {
      type: RECEIPT_DOCUMENT_TYPE,
      recipient: { name: "מישהי שלא קיימת (ילד כלשהו)" },
      items: [{ description: "אוקטובר", sku: "חוג אומנות", price: 300, quantity: 1 }],
      date: "2026-10-15",
      total: 300,
    };

    const { lines } = await resolveDocumentCreatedLines(payload);
    expect(lines).toEqual([{ month: "2026-10-01", amount: 300, childId: undefined, payerId: undefined }]);
  });

  test("resolves the payer but leaves childId unset when the child name doesn't match", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const payer = await createPayer({ displayName: `דני כהן ${suffix}`, role: "dad" });

    try {
      const payload: MorningDocumentPayload = {
        type: RECEIPT_DOCUMENT_TYPE,
        recipient: { name: `${payer.displayName} (ילד שלא קיים)` },
        items: [{ description: "אוקטובר", sku: "חוג אומנות", price: 300, quantity: 1 }],
        date: "2026-10-15",
        total: 300,
      };

      const { lines } = await resolveDocumentCreatedLines(payload);
      expect(lines).toEqual([{ month: "2026-10-01", amount: 300, childId: undefined, payerId: payer.id }]);
    } finally {
      await getSupabaseClient().from("payers").delete().eq("id", payer.id);
    }
  });

  test("leaves childId unset (ambiguous) when the payer has two children sharing the same first name", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const payer = await createPayer({ displayName: `רונית לוי ${suffix}`, role: "mom" });
    const { data: groupData, error: groupError } = await getSupabaseClient()
      .from("class_groups")
      .insert({ day: `day-${suffix}`, time: "09:00", color: "#112233" })
      .select()
      .single();
    if (groupError) throw groupError;
    const classGroupId = groupData!.id as string;

    const sharedFirstName = `עמליה ${suffix}`;
    const child1 = await createChild({
      firstName: sharedFirstName,
      familyName: "לוי",
      classGroupId,
      gender: "girl",
      payerId: payer.id,
      enrollmentStart: "2026-01-01",
    });
    const child2 = await createChild({
      firstName: sharedFirstName,
      familyName: "לוי",
      classGroupId,
      gender: "girl",
      payerId: payer.id,
      enrollmentStart: "2026-01-01",
    });

    try {
      const payload: MorningDocumentPayload = {
        type: RECEIPT_DOCUMENT_TYPE,
        recipient: { name: `${payer.displayName} (${sharedFirstName})` },
        items: [{ description: "אוקטובר", sku: "חוג אומנות", price: 300, quantity: 1 }],
        date: "2026-10-15",
        total: 300,
      };

      const { lines } = await resolveDocumentCreatedLines(payload);
      // Payer resolves unambiguously, but the child name matches two
      // children of the same payer, so childId must be left unset — never
      // silently pick the first match — so computeStatus falls back to
      // needs_review per the task brief's amendment.
      expect(lines).toEqual([{ month: "2026-10-01", amount: 300, childId: undefined, payerId: payer.id }]);
    } finally {
      await getSupabaseClient().from("children").delete().eq("id", child1.id);
      await getSupabaseClient().from("children").delete().eq("id", child2.id);
      await getSupabaseClient().from("class_groups").delete().eq("id", classGroupId);
      await getSupabaseClient().from("payers").delete().eq("id", payer.id);
    }
  });
});

describe("computeContactUpdate", () => {
  test("prefers mobile over phone", () => {
    const update = computeContactUpdate(
      { name: "x", phone: "050-1", mobile: "052-2", emails: [] },
      { phone: null, email: null },
    );
    expect(update).toEqual({ phone: "052-2" });
  });

  test("uses phone when mobile is absent", () => {
    const update = computeContactUpdate(
      { name: "x", phone: "050-1", emails: [] },
      { phone: null, email: null },
    );
    expect(update).toEqual({ phone: "050-1" });
  });

  test("takes the first email", () => {
    const update = computeContactUpdate(
      { name: "x", emails: ["a@x.com", "b@x.com"] },
      { phone: null, email: null },
    );
    expect(update).toEqual({ email: "a@x.com" });
  });

  test("never overwrites an already-set phone or email", () => {
    const update = computeContactUpdate(
      { name: "x", mobile: "052-2", emails: ["a@x.com"] },
      { phone: "050-existing", email: "existing@x.com" },
    );
    expect(update).toBeNull();
  });

  test("returns null when there is nothing new to add", () => {
    const update = computeContactUpdate({ name: "x" }, { phone: null, email: null });
    expect(update).toBeNull();
  });
});

describe("processClientCreated", () => {
  test("updates phone/email for a payer matched by exact name", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const displayName = `מיכל לוי ${suffix}`;
    const payer = await createPayer({ displayName, role: "mom" });

    try {
      await processClientCreated({
        name: displayName,
        mobile: "052-9999999",
        emails: ["michal@example.com"],
      });

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

  test("never overwrites an existing phone/email, and no-ops on no match", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const displayName = `אורית שגב ${suffix}`;
    const payer = await createPayer({
      displayName,
      role: "mom",
      phone: "050-0000000",
      email: "orit@example.com",
    });

    try {
      await processClientCreated({
        name: displayName,
        mobile: "052-1111111",
        emails: ["new@example.com"],
      });

      const { data, error } = await getSupabaseClient()
        .from("payers")
        .select("phone, email")
        .eq("id", payer.id)
        .single();
      if (error) throw error;
      expect(data!.phone).toBe("050-0000000");
      expect(data!.email).toBe("orit@example.com");

      // No match at all should be a quiet no-op, not throw.
      await expect(
        processClientCreated({ name: `no such payer ${suffix}`, mobile: "052-0" }),
      ).resolves.toBeUndefined();
    } finally {
      await getSupabaseClient().from("payers").delete().eq("id", payer.id);
    }
  });
});
