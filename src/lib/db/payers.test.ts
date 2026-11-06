import { describe, expect, test } from "vitest";
import { getSupabaseClient } from "./client";
import {
  createPayer,
  findPayerByNameOrAlias,
  listPayers,
  payerFullName,
  recordPayerNameAlias,
  updatePayer,
} from "./payers";

describe("payers", () => {
  test("createPayer then listPayers round-trips", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const displayName = `רחל פוגל ${suffix}`;
    const created = await createPayer({ displayName, role: "mom" });

    try {
      expect(created.id).toBeTruthy();
      expect(created.displayName).toBe(displayName);
      expect(created.role).toBe("mom");

      const all = await listPayers();
      const found = all.find((p) => p.id === created.id);
      expect(found?.displayName).toBe(displayName);
    } finally {
      await getSupabaseClient().from("payers").delete().eq("id", created.id);
    }
  });

  test("createPayer with phone/email, then updatePayer", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const displayName = `דני כהן ${suffix}`;
    const created = await createPayer({
      displayName,
      role: "dad",
      phone: "0501234567",
      email: "dani@example.com",
    });

    try {
      expect(created.phone).toBe("0501234567");
      expect(created.email).toBe("dani@example.com");

      const updated = await updatePayer(created.id, { displayName: `${displayName} updated` });
      expect(updated.id).toBe(created.id);
      expect(updated.displayName).toBe(`${displayName} updated`);

      const all = await listPayers();
      const found = all.find((p) => p.id === created.id);
      expect(found?.displayName).toBe(`${displayName} updated`);
    } finally {
      await getSupabaseClient().from("payers").delete().eq("id", created.id);
    }
  });

  test("createPayer with firstName/lastName round-trips; updatePayer can change them", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const created = await createPayer({
      displayName: `עידית ברבי ${suffix}`,
      firstName: `עידית${suffix}`,
      lastName: "ברבי",
      role: "mom",
    });

    try {
      expect(created.firstName).toBe(`עידית${suffix}`);
      expect(created.lastName).toBe("ברבי");
      expect(payerFullName(created)).toBe(`עידית${suffix} ברבי`);

      const updated = await updatePayer(created.id, { lastName: "כהן" });
      expect(updated.lastName).toBe("כהן");
      expect(updated.firstName).toBe(`עידית${suffix}`); // untouched
    } finally {
      await getSupabaseClient().from("payers").delete().eq("id", created.id);
    }
  });

  test("payerFullName falls back to displayName when first/last are unset", () => {
    expect(
      payerFullName({ displayName: "משפחת לוי", firstName: null, lastName: null }),
    ).toBe("משפחת לוי");
  });

  test("findPayerByNameOrAlias matches an exact (trimmed) display_name", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const displayName = `צפי ברנר ${suffix}`;
    const created = await createPayer({ displayName, role: "mom" });

    try {
      const found = await findPayerByNameOrAlias(`  ${displayName}  `);
      expect(found?.id).toBe(created.id);

      const noMatch = await findPayerByNameOrAlias(`${displayName}-unrelated`);
      expect(noMatch).toBeNull();
    } finally {
      await getSupabaseClient().from("payers").delete().eq("id", created.id);
    }
  });

  test("recordPayerNameAlias lets findPayerByNameOrAlias resolve a raw name, without duplicating on repeat calls", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const displayName = `רונית אשל ${suffix}`;
    const rawName = `רונית א. ${suffix}`;
    const created = await createPayer({ displayName, role: "mom" });

    try {
      expect(await findPayerByNameOrAlias(rawName)).toBeNull();

      await recordPayerNameAlias(created.id, rawName);
      const found = await findPayerByNameOrAlias(rawName);
      expect(found?.id).toBe(created.id);

      // Calling again for the same raw name must not create a duplicate alias row.
      await recordPayerNameAlias(created.id, rawName);
      const { data, error } = await getSupabaseClient()
        .from("payer_name_aliases")
        .select("*")
        .eq("raw_name", rawName);
      if (error) throw error;
      expect(data?.length).toBe(1);
    } finally {
      await getSupabaseClient().from("payer_name_aliases").delete().eq("raw_name", rawName);
      await getSupabaseClient().from("payers").delete().eq("id", created.id);
    }
  });
});
