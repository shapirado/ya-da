import { getSupabaseClient } from "./client";

export type ClassGroup = {
  id: string;
  day: string | null;
  time: string | null;
  color: string | null;
};

export type ClassGroupInput = {
  day: string;
  time: string;
  color: string;
};

type ClassGroupRow = {
  id: string;
  day: string | null;
  time: string | null;
  color: string | null;
};

function mapClassGroup(row: ClassGroupRow): ClassGroup {
  return {
    id: row.id,
    day: row.day,
    time: row.time,
    color: row.color,
  };
}

export async function listClassGroups(): Promise<ClassGroup[]> {
  const { data, error } = await getSupabaseClient().from("class_groups").select("*");
  if (error) throw error;
  return (data as ClassGroupRow[]).map(mapClassGroup);
}

export async function updateClassGroup(
  id: string,
  input: Partial<ClassGroupInput>,
): Promise<ClassGroup> {
  const update: Record<string, unknown> = {};
  if (input.day !== undefined) update.day = input.day;
  if (input.time !== undefined) update.time = input.time;
  if (input.color !== undefined) update.color = input.color;

  const { data, error } = await getSupabaseClient()
    .from("class_groups")
    .update(update)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return mapClassGroup(data as ClassGroupRow);
}
