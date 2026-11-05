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
  // null = not specified (e.g. a bulk import that can't know mom/dad).
  role: string | null;
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

type PayerNameAliasRow = {
  id: string;
  payer_id: string;
  raw_name: string | null;
  payers: PayerRow | null;
};

// Resolves a raw payer name string (e.g. from a Morning webhook recipient
// field) to an existing payer: first an exact (trimmed) match on the
// payer's own display_name, then a fallback lookup in payer_name_aliases
// (rows recorded by recordPayerNameAlias whenever a human resolves an
// ambiguous match). Returns null when neither resolves.
export async function findPayerByNameOrAlias(rawName: string): Promise<Payer | null> {
  const trimmed = rawName.trim();
  const client = getSupabaseClient();

  const { data: exactData, error: exactError } = await client
    .from("payers")
    .select("*")
    .eq("display_name", trimmed)
    .maybeSingle();
  if (exactError) throw exactError;
  if (exactData) return mapPayer(exactData as PayerRow);

  const { data: aliasData, error: aliasError } = await client
    .from("payer_name_aliases")
    .select("*, payers(*)")
    .eq("raw_name", trimmed)
    .maybeSingle();
  if (aliasError) throw aliasError;
  if (!aliasData) return null;

  const row = aliasData as PayerNameAliasRow;
  return row.payers ? mapPayer(row.payers) : null;
}

// Remembers that a raw name resolves to a given payer, so the same raw
// name auto-matches next time (called from the receipts-review flow
// whenever a human resolves an ambiguous match). No-ops if an alias for
// that exact raw name already exists.
export async function recordPayerNameAlias(payerId: string, rawName: string): Promise<void> {
  const trimmed = rawName.trim();
  const client = getSupabaseClient();

  const { data: existing, error: existingError } = await client
    .from("payer_name_aliases")
    .select("id")
    .eq("raw_name", trimmed)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return;

  const { error } = await client
    .from("payer_name_aliases")
    .insert({ payer_id: payerId, raw_name: trimmed });
  if (error) throw error;
}
