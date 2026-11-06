import { getSupabaseClient } from "./client";

export type Payer = {
  id: string;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  role: string | null;
  phone: string | null;
  email: string | null;
};

export type PayerInput = {
  displayName: string;
  firstName?: string;
  lastName?: string;
  role: string;
  phone?: string;
  email?: string;
};

type PayerRow = {
  id: string;
  display_name: string;
  first_name: string | null;
  last_name: string | null;
  role: string | null;
  phone: string | null;
  email: string | null;
};

function mapPayer(row: PayerRow): Payer {
  return {
    id: row.id,
    displayName: row.display_name,
    firstName: row.first_name,
    lastName: row.last_name,
    role: row.role,
    phone: row.phone,
    email: row.email,
  };
}

// The fullest name we have for a payer: first+last when both are known,
// falling back to whichever of the two is set, then display_name (which
// can predate or drift from the split fields — see e.g. a payer whose
// display_name is just a first name but last_name was filled in later).
export function payerFullName(payer: Pick<Payer, "displayName" | "firstName" | "lastName">): string {
  const joined = [payer.firstName, payer.lastName].filter(Boolean).join(" ").trim();
  return joined || payer.displayName;
}

export async function listPayers(): Promise<Payer[]> {
  const { data, error } = await getSupabaseClient().from("payers").select("*");
  if (error) throw error;
  return (data as PayerRow[]).map(mapPayer);
}

export async function createPayer(input: {
  displayName: string;
  firstName?: string;
  lastName?: string;
  // null = not specified (e.g. a bulk import that can't know mom/dad).
  role: string | null;
  phone?: string;
  email?: string;
}): Promise<Payer> {
  const { data, error } = await getSupabaseClient()
    .from("payers")
    .insert({
      display_name: input.displayName,
      first_name: input.firstName ?? null,
      last_name: input.lastName ?? null,
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
  if (input.firstName !== undefined) update.first_name = input.firstName;
  if (input.lastName !== undefined) update.last_name = input.lastName;
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
