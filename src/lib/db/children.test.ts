import { describe, expect, test } from "vitest";
import { getSupabaseClient } from "./client";
import { createPayer } from "./payers";
import {
  createChild,
  listChildPrices,
  listChildrenWithPayer,
  setChildPrice,
  updateChild,
} from "./children";

async function makePayer(label: string) {
  return createPayer({ displayName: `${label}-${Date.now()}-${Math.random().toString(36).slice(2)}`, role: "mom" });
}

async function makeClassGroup(label: string) {
  const { data, error } = await getSupabaseClient()
    .from("class_groups")
    .insert({ day: `${label}-${Date.now()}-${Math.random().toString(36).slice(2)}`, time: "09:00", color: "#123456" })
    .select()
    .single();
  if (error) throw error;
  return data!.id as string;
}

describe("children", () => {
  test("createChild then listChildrenWithPayer round-trips, updateChild works", async () => {
    let payer: Awaited<ReturnType<typeof makePayer>> | undefined;
    let classGroupId: string | undefined;
    let created: Awaited<ReturnType<typeof createChild>> | undefined;

    try {
      payer = await makePayer("payer");
      classGroupId = await makeClassGroup("group");

      const firstName = `ילד-${Date.now()}`;
      created = await createChild({
        firstName,
        familyName: "כהן",
        classGroupId,
        gender: "boy",
        payerId: payer.id,
        enrollmentStart: "2026-09-01",
      });

      expect(created.id).toBeTruthy();
      expect(created.firstName).toBe(firstName);
      expect(created.classGroupId).toBe(classGroupId);
      expect(created.payerId).toBe(payer.id);
      expect(created.enrollmentStart).toBe("2026-09-01");

      const all = await listChildrenWithPayer();
      const found = all.find((c) => c.id === created!.id);
      expect(found).toBeTruthy();
      expect(found?.firstName).toBe(firstName);
      expect(found?.payer?.id).toBe(payer.id);
      expect(found?.payer?.displayName).toBe(payer.displayName);

      const updated = await updateChild(created.id, { familyName: "לוי" });
      expect(updated.familyName).toBe("לוי");
    } finally {
      if (created) {
        await getSupabaseClient().from("children").delete().eq("id", created.id);
      }
      if (classGroupId) {
        await getSupabaseClient().from("class_groups").delete().eq("id", classGroupId);
      }
      if (payer) {
        await getSupabaseClient().from("payers").delete().eq("id", payer.id);
      }
    }
  });

  test("setChildPrice twice inserts two rows, not an overwrite", async () => {
    let payer: Awaited<ReturnType<typeof makePayer>> | undefined;
    let classGroupId: string | undefined;
    let created: Awaited<ReturnType<typeof createChild>> | undefined;

    try {
      payer = await makePayer("payer2");
      classGroupId = await makeClassGroup("group2");
      created = await createChild({
        firstName: `ילד2-${Date.now()}`,
        familyName: "כהן",
        classGroupId,
        gender: "girl",
        payerId: payer.id,
        enrollmentStart: "2026-09-01",
      });

      const first = await setChildPrice(created.id, { amount: 500, effectiveFrom: "2026-09-01" });
      const second = await setChildPrice(created.id, { amount: 600, effectiveFrom: "2026-10-01" });

      expect(first.amount).toBe(500);
      expect(second.amount).toBe(600);
      expect(first.id).not.toBe(second.id);

      const prices = await listChildPrices(created.id);
      expect(prices.length).toBe(2);
      expect(prices.map((p) => p.amount).sort()).toEqual([500, 600]);
      for (const p of prices) {
        expect(typeof p.amount).toBe("number");
        expect(typeof p.effectiveFrom).toBe("string");
      }
    } finally {
      if (created) {
        await getSupabaseClient().from("child_prices").delete().eq("child_id", created.id);
        await getSupabaseClient().from("children").delete().eq("id", created.id);
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
