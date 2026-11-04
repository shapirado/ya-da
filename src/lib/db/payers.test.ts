import { describe, expect, test } from "vitest";
import { getSupabaseClient } from "./client";
import { createPayer, listPayers, updatePayer } from "./payers";

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
});
