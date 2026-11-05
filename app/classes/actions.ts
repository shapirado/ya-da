"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseClient } from "@/src/lib/db/client";
import {
  listClassGroups,
  updateClassGroup,
  type ClassGroup,
  type ClassGroupInput,
} from "@/src/lib/db/classGroups";

export type ClassGroupWithEnrollment = ClassGroup & { enrollmentCount: number };

export type DefaultPrices = {
  fullPrice: number | null;
  discountPrice: number | null;
};

export async function saveClassGroup(
  id: string,
  input: Partial<ClassGroupInput>,
): Promise<void> {
  if (Object.keys(input).length === 0) return;
  await updateClassGroup(id, input);
  revalidatePath("/classes");
}

// Enrollment count is derived, not stored: it's a live count of active
// children referencing each group, computed fresh every time the groups
// are listed.
export async function listClassGroupsWithEnrollment(): Promise<ClassGroupWithEnrollment[]> {
  const groups = await listClassGroups();

  const counts = await Promise.all(
    groups.map(async (group) => {
      const { count, error } = await getSupabaseClient()
        .from("children")
        .select("id", { count: "exact", head: true })
        .eq("class_group_id", group.id)
        .eq("active", true);
      if (error) throw error;
      return count ?? 0;
    }),
  );

  return groups.map((group, index) => ({
    ...group,
    enrollmentCount: counts[index],
  }));
}

type SettingsRow = {
  id: string;
  default_full_price: number | null;
  default_discount_price: number | null;
};

// A single, fixed settings row holding just the two default pricing
// figures used as a starting point for a new child elsewhere (e.g. the
// families page). Deliberately not a generic key-value settings table.
const SETTINGS_ROW_ID = "default";

export async function getDefaultPrices(): Promise<DefaultPrices> {
  const { data, error } = await getSupabaseClient()
    .from("settings")
    .select("default_full_price, default_discount_price")
    .eq("id", SETTINGS_ROW_ID)
    .single();
  if (error) throw error;
  const row = data as SettingsRow;
  return {
    fullPrice: row.default_full_price,
    discountPrice: row.default_discount_price,
  };
}

export async function saveDefaultPrices(input: Partial<DefaultPrices>): Promise<void> {
  const update: Record<string, unknown> = {};
  if (input.fullPrice !== undefined) update.default_full_price = input.fullPrice;
  if (input.discountPrice !== undefined) update.default_discount_price = input.discountPrice;
  if (Object.keys(update).length === 0) return;

  const { error } = await getSupabaseClient()
    .from("settings")
    .update(update)
    .eq("id", SETTINGS_ROW_ID);
  if (error) throw error;
  revalidatePath("/classes");
}
