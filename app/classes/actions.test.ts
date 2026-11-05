import { describe, expect, test, vi } from "vitest";

// Server actions call revalidatePath, which requires a live Next.js request
// scope that vitest doesn't provide. Stub it out so the underlying
// persistence logic can be exercised directly.
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import { getSupabaseClient } from "@/src/lib/db/client";
import { listClassGroups, updateClassGroup } from "@/src/lib/db/classGroups";
import { createChild } from "@/src/lib/db/children";
import { createPayer } from "@/src/lib/db/payers";
import {
  saveClassGroup,
  listClassGroupsWithEnrollment,
  getDefaultPrices,
  saveDefaultPrices,
} from "./actions";

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

describe("classes actions", () => {
  test("updating a group day/time persists and is visible to children referencing it", async () => {
    const group = (await listClassGroups())[0];
    await updateClassGroup(group.id, { day: "שלישי", time: "17:00" });
    const reread = (await listClassGroups()).find((g) => g.id === group.id);
    expect(reread).toMatchObject({ day: "שלישי", time: "17:00" });
  });

  test("saveClassGroup persists a group's day/time, still visible from a child referencing it", async () => {
    const suffix = uniqueSuffix();
    const payer = await createPayer({ displayName: `הורה-${suffix}`, role: "mom" });
    const { data: groupData, error: groupError } = await getSupabaseClient()
      .from("class_groups")
      .insert({ day: `יום-${suffix}`, time: "09:00", color: "#abcdef" })
      .select()
      .single();
    if (groupError) throw groupError;
    const groupId = groupData!.id as string;
    let childId: string | undefined;

    try {
      const child = await createChild({
        firstName: `ילד-${suffix}`,
        familyName: "כהן",
        classGroupId: groupId,
        gender: "boy",
        payerId: payer.id,
        enrollmentStart: "2026-09-01",
      });
      childId = child.id;

      await saveClassGroup(groupId, { day: "רביעי", time: "16:30" });

      const groups = await listClassGroups();
      const updated = groups.find((g) => g.id === groupId);
      expect(updated).toMatchObject({ day: "רביעי", time: "16:30" });

      // The child still references the same group id, which now carries the
      // updated day/time — nothing about the child row needed to change.
      const { data: childRow, error: childError } = await getSupabaseClient()
        .from("children")
        .select("class_group_id")
        .eq("id", child.id)
        .single();
      if (childError) throw childError;
      expect(childRow!.class_group_id).toBe(groupId);
    } finally {
      if (childId) {
        await getSupabaseClient().from("children").delete().eq("id", childId);
      }
      await getSupabaseClient().from("class_groups").delete().eq("id", groupId);
      await getSupabaseClient().from("payers").delete().eq("id", payer.id);
    }
  });

  test("listClassGroupsWithEnrollment reports only active children referencing a group", async () => {
    const suffix = uniqueSuffix();
    const payer = await createPayer({ displayName: `הורה2-${suffix}`, role: "dad" });
    const { data: groupData, error: groupError } = await getSupabaseClient()
      .from("class_groups")
      .insert({ day: `יום2-${suffix}`, time: "10:00", color: "#112233" })
      .select()
      .single();
    if (groupError) throw groupError;
    const groupId = groupData!.id as string;

    const childIds: string[] = [];
    try {
      const activeChild1 = await createChild({
        firstName: `פעיל1-${suffix}`,
        familyName: "לוי",
        classGroupId: groupId,
        gender: "girl",
        payerId: payer.id,
        enrollmentStart: "2026-09-01",
      });
      childIds.push(activeChild1.id);

      const activeChild2 = await createChild({
        firstName: `פעיל2-${suffix}`,
        familyName: "לוי",
        classGroupId: groupId,
        gender: "boy",
        payerId: payer.id,
        enrollmentStart: "2026-09-01",
      });
      childIds.push(activeChild2.id);

      const inactiveChild = await createChild({
        firstName: `לא-פעיל-${suffix}`,
        familyName: "לוי",
        classGroupId: groupId,
        gender: "girl",
        payerId: payer.id,
        enrollmentStart: "2026-09-01",
      });
      childIds.push(inactiveChild.id);
      await getSupabaseClient()
        .from("children")
        .update({ active: false })
        .eq("id", inactiveChild.id);

      const groups = await listClassGroupsWithEnrollment();
      const found = groups.find((g) => g.id === groupId);
      expect(found?.enrollmentCount).toBe(2);
    } finally {
      for (const id of childIds) {
        await getSupabaseClient().from("children").delete().eq("id", id);
      }
      await getSupabaseClient().from("class_groups").delete().eq("id", groupId);
      await getSupabaseClient().from("payers").delete().eq("id", payer.id);
    }
  });

  test("saveDefaultPrices then getDefaultPrices round-trips the full/discount amounts", async () => {
    const original = await getDefaultPrices();
    try {
      await saveDefaultPrices({ fullPrice: 320, discountPrice: 280 });
      const updated = await getDefaultPrices();
      expect(updated).toMatchObject({ fullPrice: 320, discountPrice: 280 });
    } finally {
      await saveDefaultPrices(original);
    }
  });
});
