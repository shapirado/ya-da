import { getSupabaseClient } from "./client";
import type { Payer } from "./payers";

export type Child = {
  id: string;
  firstName: string;
  familyName: string;
  classGroupId: string | null;
  gender: string | null;
  payerId: string | null;
  enrollmentStart: string;
  active: boolean;
};

export type ChildWithPayer = Child & {
  payer: Payer | null;
};

export type ChildInput = {
  firstName: string;
  familyName: string;
  classGroupId: string;
  gender: string;
  payerId: string;
  enrollmentStart: string;
};

export type ChildPriceRow = {
  id: string;
  childId: string;
  amount: number;
  effectiveFrom: string;
};

type ChildRow = {
  id: string;
  first_name: string;
  family_name: string;
  class_group_id: string | null;
  gender: string | null;
  payer_id: string | null;
  enrollment_start: string;
  active: boolean;
};

type ChildWithPayerRow = ChildRow & {
  payers: {
    id: string;
    display_name: string;
    role: string | null;
    phone: string | null;
    email: string | null;
  } | null;
};

type ChildPriceDbRow = {
  id: string;
  child_id: string;
  amount: number;
  effective_from: string;
};

function mapChild(row: ChildRow): Child {
  return {
    id: row.id,
    firstName: row.first_name,
    familyName: row.family_name,
    classGroupId: row.class_group_id,
    gender: row.gender,
    payerId: row.payer_id,
    enrollmentStart: row.enrollment_start,
    active: row.active,
  };
}

function mapChildPrice(row: ChildPriceDbRow): ChildPriceRow {
  return {
    id: row.id,
    childId: row.child_id,
    amount: row.amount,
    effectiveFrom: row.effective_from,
  };
}

export async function listChildrenWithPayer(): Promise<ChildWithPayer[]> {
  const { data, error } = await getSupabaseClient()
    .from("children")
    .select("*, payers(*)");
  if (error) throw error;
  return (data as unknown as ChildWithPayerRow[]).map((row) => ({
    ...mapChild(row),
    payer: row.payers
      ? {
          id: row.payers.id,
          displayName: row.payers.display_name,
          role: row.payers.role,
          phone: row.payers.phone,
          email: row.payers.email,
        }
      : null,
  }));
}

export async function createChild(input: {
  firstName: string;
  familyName: string;
  classGroupId: string;
  gender: string;
  payerId: string;
  enrollmentStart: string;
}): Promise<Child> {
  const { data, error } = await getSupabaseClient()
    .from("children")
    .insert({
      first_name: input.firstName,
      family_name: input.familyName,
      class_group_id: input.classGroupId,
      gender: input.gender,
      payer_id: input.payerId,
      enrollment_start: input.enrollmentStart,
    })
    .select()
    .single();
  if (error) throw error;
  return mapChild(data as ChildRow);
}

export async function updateChild(id: string, input: Partial<ChildInput>): Promise<Child> {
  const update: Record<string, unknown> = {};
  if (input.firstName !== undefined) update.first_name = input.firstName;
  if (input.familyName !== undefined) update.family_name = input.familyName;
  if (input.classGroupId !== undefined) update.class_group_id = input.classGroupId;
  if (input.gender !== undefined) update.gender = input.gender;
  if (input.payerId !== undefined) update.payer_id = input.payerId;
  if (input.enrollmentStart !== undefined) update.enrollment_start = input.enrollmentStart;

  const { data, error } = await getSupabaseClient()
    .from("children")
    .update(update)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return mapChild(data as ChildRow);
}

export async function setChildPrice(
  childId: string,
  input: { amount: number; effectiveFrom: string },
): Promise<ChildPriceRow> {
  const { data, error } = await getSupabaseClient()
    .from("child_prices")
    .insert({
      child_id: childId,
      amount: input.amount,
      effective_from: input.effectiveFrom,
    })
    .select()
    .single();
  if (error) throw error;
  return mapChildPrice(data as ChildPriceDbRow);
}

export async function listChildPrices(childId: string): Promise<ChildPriceRow[]> {
  const { data, error } = await getSupabaseClient()
    .from("child_prices")
    .select("*")
    .eq("child_id", childId);
  if (error) throw error;
  return (data as ChildPriceDbRow[]).map(mapChildPrice);
}
