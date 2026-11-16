// Loads the whole working set once per request. The studio has tens of children
// and a few hundred monthly rows, so computing in memory is simple and fast.

import { db, fetchAll } from './supabase.ts';
import { todayISO } from './dates.ts';
import { normName } from './matching.ts';
import type { Model } from './billing.ts';
import type { Activity, Alias, Child, ChildActivity, ClassGroup, Payer, PaymentLog, Settings } from './types.ts';

// temp_parents has Hebrew column names (the Morning customer export).
export const P_PHONE = 'phone';
//export const P_PHONE_2 = 'טלפון';
export const P_EMAILS = 'email';
const PAYER_SELECT = `morning_customer_id,name,"${P_PHONE}","${P_EMAILS}"`;

type RawPayer = Record<string, string | null> & { morning_customer_id: string; name: string | null };

export function toPayer(r: RawPayer): Payer {
  const emails = (r[P_EMAILS] || '').split(/[,;\s]+/).filter(Boolean);
  return {
    morning_customer_id: r.morning_customer_id,
    name: r.name,
    phone: r[P_PHONE]  || null,
    email: emails[0] || null,
  };
}

export async function loadSettings(): Promise<Settings> {
  const { data } = await db().from('settings').select('default_full_price,default_discount_price').eq('id', 'default').maybeSingle();
  return (data as Settings) || { default_full_price: null, default_discount_price: null };
}

export async function loadModel(): Promise<Model> {
  const [groups, activities, children, links, rawPayers, settings] = await Promise.all([
    fetchAll<ClassGroup>('class_groups'),
    fetchAll<Activity>('activities', '*', (q) => q.order('start_date', { ascending: true })),
    fetchAll<Child>('children'),
    fetchAll<ChildActivity>('child_activity'),
    fetchAll<RawPayer>('payer_name_aliases', PAYER_SELECT),
    loadSettings(),
  ]);
  return { today: todayISO(), groups, activities, children, links, payers: rawPayers.map(toPayer), settings };
}

type AliasRow = { morning_customer_id: string; raw_name: string[] | string | null };
const aliasNames = (v: AliasRow['raw_name']): string[] => (Array.isArray(v) ? v : v ? [v] : []).filter(Boolean);

export async function loadAliases(): Promise<Alias[]> {
  const rows = await fetchAll<AliasRow>('payer_name_aliases', 'morning_customer_id,raw_name');
  return rows.flatMap((r) => aliasNames(r.raw_name).map((name) => ({ payer_id: r.morning_customer_id, raw_name: name })));
}

/** Adds a name to the payer's alias array (one row per Morning customer). Returns an error message, or null. */
export async function addAlias(payerId: string, name: string): Promise<string | null> {
  const alias = name.trim();
  if (!alias) return null;
  const cur = await db().from('payer_name_aliases').select('raw_name').eq('morning_customer_id', payerId).maybeSingle();
  if (cur.error) return cur.error.message;
  if (!cur.data) {
    return (await db().from('payer_name_aliases').insert({ morning_customer_id: payerId, raw_name: [alias] })).error?.message ?? null;
  }
  const names = aliasNames((cur.data as AliasRow).raw_name);
  if (names.some((n) => normName(n) === normName(alias))) return null;
  return (await db().from('payer_name_aliases').update({ raw_name: [...names, alias] }).eq('morning_customer_id', payerId)).error?.message ?? null;
}

/** Every logged payment — the scanner's duplicate check reads these. Empty when the table isn't there. */
export async function loadPaymentLog(): Promise<PaymentLog[]> {
  try {
    return await fetchAll<PaymentLog>('payment_log');
  } catch {
    return [];
  }
}

export async function loadRecentPayments(limit = 8): Promise<PaymentLog[]> {
  const { data, error } = await db().from('payment_log').select('*').order('created_at', { ascending: false }).limit(limit);
  if (error) return []; // migration not applied yet
  return (data || []) as PaymentLog[];
}

export async function loadReminderLog(sinceISO: string): Promise<Map<string, string>> {
  const { data, error } = await db().from('reminder_log').select('payer_id,sent_at').gte('sent_at', sinceISO).order('sent_at', { ascending: false });
  const out = new Map<string, string>();
  if (error) return out;
  for (const r of data || []) if (!out.has(r.payer_id)) out.set(r.payer_id, r.sent_at);
  return out;
}
