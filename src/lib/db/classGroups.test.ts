import { describe, expect, test } from "vitest";
import { getSupabaseClient } from "./client";
import { listClassGroups, updateClassGroup } from "./classGroups";

describe("classGroups", () => {
  test("listClassGroups then updateClassGroup round-trips", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const { data: inserted, error } = await getSupabaseClient()
      .from("class_groups")
      .insert({ day: `Monday-${suffix}`, time: "08:00", color: "#ff0000" })
      .select()
      .single();
    expect(error).toBeNull();
    const id = inserted!.id as string;

    try {
      const all = await listClassGroups();
      const found = all.find((g) => g.id === id);
      expect(found?.day).toBe(`Monday-${suffix}`);
      expect(found?.time).toBe("08:00");
      expect(found?.color).toBe("#ff0000");

      const updated = await updateClassGroup(id, { color: "#00ff00" });
      expect(updated.id).toBe(id);
      expect(updated.color).toBe("#00ff00");

      const allAfter = await listClassGroups();
      const foundAfter = allAfter.find((g) => g.id === id);
      expect(foundAfter?.color).toBe("#00ff00");
    } finally {
      await getSupabaseClient().from("class_groups").delete().eq("id", id);
    }
  });
});
