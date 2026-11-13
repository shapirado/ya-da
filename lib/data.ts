// Loads the whole working set once per request. The studio has tens of children
// and a few hundred monthly rows, so computing in memory is simple and fast.

import { db, fetchAll } from './supabase.ts';
import { todayISO } from './dates.ts';
import type { Model } from './billing.ts';
import type { Activity, Alias, Child, ChildActivity, ClassGroup, Payer, PaymentLog, Settings } from './types.ts';

// temp_parents has Hebrew column names (the Morning customer export).
export const P_PHONE = 'נייד';
export const P_PHONE_2 = 'טלפון';
export const P_EMAILS = 'כתובות מייל';
const PAYER_SELECT = `morning_customer_id,name,"${P_PHONE}","${P_PHONE_2}","${P_EMAILS}"`;

type RawPayer = Record<string, string | null> & { morning_customer_id: string; name: string | null };

export function toPayer(r: RawPayer): Payer {
  const emails = (r[P_EMAILS] || '').split(/[,;\s]+/).filter(Boolean);
  return {
    morning_customer_id: r.morning_customer_id,
    name: r.name,
    phone: r[P_PHONE] || r[P_PHONE_2] || null,
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
    fetchAll<RawPayer>('temp_parents', PAYER_SELECT),
    loadSettings(),
  ]);
  return { today: todayISO(), groups, activities, children, links, payers: rawPayers.map(toPayer), settings };
}

export async function loadAliases(): Promise<Alias[]> {
  return fetchAll<Alias>('payer_name_aliases');
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
