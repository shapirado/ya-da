import { getSupabaseClient } from "./client";

export type Payer = {
  id: string;
  displayName: string;
  role: string | null;
  phone: string | null;
  email: string | null;
};

export type PayerInput = {
  displayName: string;
  role: string;
  phone?: string;
  email?: string;
};

type PayerRow = {
  id: string;
  display_name: string;
  role: string | null;
  phone: string | null;
  email: string | null;
};

function mapPayer(row: PayerRow): Payer {
  return {
    id: row.id,
    displayName: row.display_name,
    role: row.role,
    phone: row.phone,
    email: row.email,
  };
}

export async function listPayers(): Promise<Payer[]> {
  const { data, error } = await getSupabaseClient().from("payers").select("*");
  if (error) throw error;
  return (data as PayerRow[]).map(mapPayer);
}

export async function createPayer(input: {
  displayName: string;
  role: string;
  phone?: string;
  email?: string;
}): Promise<Payer> {
  const { data, error } = await getSupabaseClient()
    .from("payers")
    .insert({
      display_name: input.displayName,
      role: input.role,
      phone: input.phone ?? null,
      email: input.email ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return mapPayer(data as PayerRow);
}

export async function updatePayer(id: string, input: Partial<PayerInput>): Promise<Payer> {
  const update: Record<string, unknown> = {};
  if (input.displayName !== undefined) update.display_name = input.displayName;
  if (input.role !== undefined) update.role = input.role;
  if (input.phone !== undefined) update.phone = input.phone;
  if (input.email !== undefined) update.email = input.email;

  const { data, error } = await getSupabaseClient()
    .from("payers")
    .update(update)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return mapPayer(data as PayerRow);
}
