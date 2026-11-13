import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

/** Server-side Supabase client (service role). Never import this from a client component. */
export function db(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('חסרים SUPABASE_URL או SUPABASE_SERVICE_ROLE_KEY במשתני הסביבה');
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

/** Reads every row of a query, 1000 at a time (PostgREST caps a single response). */
export async function fetchAll<T>(table: string, select = '*', apply?: (q: any) => any): Promise<T[]> {
  const out: T[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    let q = db().from(table).select(select).range(from, from + page - 1);
    if (apply) q = apply(q);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...((data || []) as T[]));
    if (!data || data.length < page) break;
  }
  return out;
}
