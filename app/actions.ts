'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/lib/supabase';
import { requireAccess } from '@/lib/auth';
import { loadAliases, loadModel, loadSettings, P_EMAILS, P_PHONE } from '@/lib/data';
import { allocate, childName, familyDebts, openCharges, round2, statusFor, type Charge } from '@/lib/billing';
import { rankPayers, normName } from '@/lib/matching';
import { createMorningClient, createReceipt } from '@/lib/morning';
import { extractPayments, type ExtractedPayment } from '@/lib/gemini';
import { monthEnd, monthStart, monthsBetween, todayISO } from '@/lib/dates';
import type { PaymentMethod } from '@/lib/types';

// ---------- helpers ----------

function s(fd: FormData, k: string): string {
  return String(fd.get(k) ?? '').trim();
}
function num(fd: FormData, k: string): number | null {
  const v = s(fd, k);
  if (v === '') return null;
  const n = Number(v.replace(/[₪,\s]/g, ''));
  return Number.isFinite(n) ? n : null;
}
function done(path: string, params: Record<string, string> = {}): never {
  revalidatePath('/', 'layout');
  const q = new URLSearchParams(params).toString();
  redirect(q ? `${path}${path.includes('?') ? '&' : '?'}${q}` : path);
}
function fail(path: string, msg: string): never {
  const q = new URLSearchParams({ err: msg }).toString();
  redirect(`${path}${path.includes('?') ? '&' : '?'}${q}`);
}
async function must<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>, back: string): Promise<T> {
  const { data, error } = await p;
  if (error) fail(back, error.message);
  return data;
}

// ---------- settings ----------

export async function saveSettings(fd: FormData) {
  await requireAccess();
  await must(db().from('settings').upsert({
    id: 'default',
    default_full_price: num(fd, 'full'),
    default_discount_price: num(fd, 'discount'),
  }), '/activities');
  done('/activities', { ok: 'שמרתי את המחירים הכלליים' });
}

// ---------- class groups & monthly activities ----------

async function insertMonths(groupId: string, from: string, to: string, price: number | null, back: string) {
  const g = await must(db().from('class_groups').select('*').eq('id', groupId).single(), back) as any;
  const existing = await must(db().from('activities').select('start_date').eq('class_group_id', groupId), back) as any[];
  const have = new Set(existing.map((r) => r.start_date));
  const rows = monthsBetween(from, to)
    .filter((m) => !have.has(m))
    .map((m) => ({
      name: `חוג ${[g.day, g.time].filter(Boolean).join(' ')}`,
      start_date: m,
      end_date: monthEnd(m),
      color: g.color,
      default_price: price,
      activity_type: 'חוג',
      class_group_id: groupId,
    }));
  if (rows.length) await must(db().from('activities').insert(rows), back);
  return rows.length;
}

export async function createClassGroup(fd: FormData) {
  await requireAccess();
  const back = '/activities';
  const day = s(fd, 'day');
  const time = s(fd, 'time');
  if (!day || !time) fail(back, 'צריך יום ושעה');
  const g = await must(db().from('class_groups').insert({ day, time, color: s(fd, 'color') || '#3446C4' }).select('id').single(), back) as any;
  const settings = await loadSettings();
  const n = await insertMonths(g.id, s(fd, 'from'), s(fd, 'to'), num(fd, 'price') ?? settings.default_full_price, back);
  done(`/activities?g=${g.id}`, { ok: `פתחתי את הקבוצה ויצרתי ${n} חודשים` });
}

export async function updateClassGroup(fd: FormData) {
  await requireAccess();
  const id = s(fd, 'id');
  const back = `/activities?g=${id}`;
  const color = s(fd, 'color');
  await must(db().from('class_groups').update({ day: s(fd, 'day'), time: s(fd, 'time'), color }).eq('id', id), back);
  await must(db().from('activities').update({ color }).eq('class_group_id', id), back);
  done(back, { ok: 'שמרתי את פרטי הקבוצה' });
}

export async function generateMonths(fd: FormData) {
  await requireAccess();
  const id = s(fd, 'id');
  const back = `/activities?g=${id}`;
  const settings = await loadSettings();
  const n = await insertMonths(id, s(fd, 'from'), s(fd, 'to'), num(fd, 'price') ?? settings.default_full_price, back);
  done(back, { ok: n ? `יצרתי ${n} חודשים חדשים` : 'כל החודשים בטווח כבר קיימים' });
}

/** New price from a given month on. Only the activity rows change, so child-specific prices stay. */
export async function changeGroupPrice(fd: FormData) {
  await requireAccess();
  const id = s(fd, 'id');
  const back = `/activities?g=${id}`;
  const price = num(fd, 'price');
  const from = s(fd, 'from');
  if (price == null || !from) fail(back, 'צריך מחיר וחודש התחלה');
  const rows = await must(db().from('activities').update({ default_price: price }).eq('class_group_id', id).gte('start_date', from).select('id'), back) as any[];
  done(back, { ok: `עדכנתי את המחיר ב-${rows.length} חודשים` });
}

// ---------- camps ----------

export async function saveCamp(fd: FormData) {
  await requireAccess();
  const id = s(fd, 'id');
  const back = '/activities';
  const row = {
    name: s(fd, 'name'),
    start_date: s(fd, 'start') || null,
    end_date: s(fd, 'end') || null,
    default_price: num(fd, 'price'),
    color: s(fd, 'color') || '#8E5BD9',
    morning_item_id: s(fd, 'item') || null,
    activity_type: 'קייטנה',
    class_group_id: null,
  };
  if (!row.name) fail(back, 'צריך שם לקייטנה');
  if (id) await must(db().from('activities').update(row).eq('id', id), back);
  else await must(db().from('activities').insert(row), back);
  done(back, { ok: id ? 'שמרתי את הקייטנה' : 'פתחתי קייטנה חדשה' });
}

// ---------- children ----------

type PriceMode = 'full' | 'discount' | 'custom';

function priceFor(mode: PriceMode, custom: number | null, discount: number | null): number | null {
  if (mode === 'discount') return discount;
  if (mode === 'custom') return custom;
  return null; // full → follow the activity's price
}

/** Creates child_activity rows: every month of the group from `from`, or the single camp row. */
async function enrollRows(childId: string, fd: FormData, back: string) {
  const settings = await loadSettings();
  const from = monthStart(s(fd, 'from') || todayISO());
  const rows: { child_id: string; activity_id: number; price: number | null; payment_status: string; paid_amount: number }[] = [];
  for (const groupId of fd.getAll('group').map(String)) {
    const mode = (s(fd, `mode_${groupId}`) || 'full') as PriceMode;
    const price = priceFor(mode, num(fd, `custom_${groupId}`), settings.default_discount_price);
    const months = await must(db().from('activities').select('id').eq('class_group_id', groupId).gte('start_date', from), back) as any[];
    if (!months.length) fail(back, 'לקבוצה הזו אין חודשים פתוחים — צרי אותם במסך החוגים');
    for (const m of months) rows.push({ child_id: childId, activity_id: m.id, price, payment_status: 'unpaid', paid_amount: 0 });
  }
  for (const campId of fd.getAll('camp').map(String)) {
    const mode = (s(fd, `mode_camp_${campId}`) || 'full') as PriceMode;
    rows.push({ child_id: childId, activity_id: Number(campId), price: priceFor(mode, num(fd, `custom_camp_${campId}`), null), payment_status: 'unpaid', paid_amount: 0 });
  }
  // skip rows the child already has
  const existing = await must(db().from('child_activity').select('activity_id').eq('child_id', childId), back) as any[];
  const have = new Set(existing.map((r) => r.activity_id));
  const fresh = rows.filter((r) => !have.has(r.activity_id));
  if (fresh.length) await must(db().from('child_activity').insert(fresh), back);
  return fresh.length;
}

export async function createChild(fd: FormData) {
  await requireAccess();
  const back = '/children/new';
  const first = s(fd, 'first_name');
  const family = s(fd, 'family_name');
  if (!first) fail(back, 'צריך שם פרטי');

  let payerId = s(fd, 'existing_payer');
  if (!payerId) {
    const name = s(fd, 'payer_name');
    const phone = s(fd, 'payer_phone');
    const email = s(fd, 'payer_email');
    if (!name) fail(back, 'צריך שם משלם/ת');
    try {
      payerId = await createMorningClient({ name, phone, email });
    } catch (e) {
      fail(back, `לא הצלחתי ליצור לקוח ב-Morning: ${(e as Error).message}`);
    }
    await must(db().from('temp_parents').insert({ morning_customer_id: payerId, name, [P_PHONE]: phone || null, [P_EMAILS]: email || null }), back);
  }

  let payer2: string | null = null;
  const p2name = s(fd, 'payer2_name');
  if (p2name) {
    try {
      payer2 = await createMorningClient({ name: p2name, phone: s(fd, 'payer2_phone'), email: s(fd, 'payer2_email') });
      await must(db().from('temp_parents').insert({ morning_customer_id: payer2, name: p2name, [P_PHONE]: s(fd, 'payer2_phone') || null, [P_EMAILS]: s(fd, 'payer2_email') || null }), back);
    } catch (e) {
      fail(back, `לא הצלחתי ליצור את המשלם/ת השני/ה ב-Morning: ${(e as Error).message}`);
    }
  }

  const child = await must(db().from('children').insert({
    first_name: first, family_name: family || null, gender: s(fd, 'gender') || null,
    morning_customer_id: payerId, morning_customer_id_2: payer2,
  }).select('id').single(), back) as any;

  const n = await enrollRows(child.id, fd, `/children/${child.id}`);
  done(`/children/${child.id}`, { ok: `שמרתי את ${first} ויצרתי ${n} חיובים` });
}

export async function updateChild(fd: FormData) {
  await requireAccess();
  const id = s(fd, 'id');
  const back = `/children/${id}`;
  await must(db().from('children').update({
    first_name: s(fd, 'first_name'), family_name: s(fd, 'family_name') || null, gender: s(fd, 'gender') || null,
    morning_customer_id: s(fd, 'payer') || null,
  }).eq('id', id), back);
  done(back, { ok: 'שמרתי את הפרטים' });
}

export async function enrollChild(fd: FormData) {
  await requireAccess();
  const id = s(fd, 'id');
  const n = await enrollRows(id, fd, `/children/${id}`);
  done(`/children/${id}`, { ok: n ? `הוספתי ${n} חיובים` : 'לא היה מה להוסיף — הילד/ה כבר רשום/ה' });
}

export async function setChargePrice(fd: FormData) {
  await requireAccess();
  const childId = s(fd, 'child');
  const back = `/children/${childId}`;
  await must(db().from('child_activity').update({ price: num(fd, 'price') }).eq('id', Number(s(fd, 'link'))), back);
  done(back, { ok: 'עדכנתי את המחיר' });
}

/** Stops a child's class from a month on: deletes that group's unpaid rows from then. */
export async function stopParticipation(fd: FormData) {
  await requireAccess();
  const childId = s(fd, 'child');
  const back = `/children/${childId}`;
  const groupId = s(fd, 'group');
  const from = monthStart(s(fd, 'from'));
  const acts = await must(db().from('activities').select('id').eq('class_group_id', groupId).gte('start_date', from), back) as any[];
  if (!acts.length) done(back, { ok: 'אין חודשים למחוק' });
  const rows = await must(db().from('child_activity').delete()
    .eq('child_id', childId).in('activity_id', acts.map((a) => a.id))
    .neq('payment_status', 'paid').or('paid_amount.is.null,paid_amount.eq.0')
    .select('id'), back) as any[];
  done(back, { ok: `מחקתי ${rows.length} חיובים עתידיים` });
}

export async function removeCharge(fd: FormData) {
  await requireAccess();
  const childId = s(fd, 'child');
  const back = `/children/${childId}`;
  await must(db().from('child_activity').delete().eq('id', Number(s(fd, 'link'))).neq('payment_status', 'paid'), back);
  done(back, { ok: 'מחקתי את החיוב' });
}

export async function markCharge(fd: FormData) {
  await requireAccess();
  const childId = s(fd, 'child');
  const back = `/children/${childId}`;
  const paid = s(fd, 'status') === 'paid';
  const link = await must(db().from('child_activity').select('id,price,activity_id').eq('id', Number(s(fd, 'link'))).single(), back) as any;
  const act = await must(db().from('activities').select('default_price').eq('id', link.activity_id).single(), back) as any;
  const settings = await loadSettings();
  const price = Number(link.price ?? act.default_price ?? settings.default_full_price ?? 0);
  await must(db().from('child_activity').update({ payment_status: paid ? 'paid' : 'unpaid', paid_amount: paid ? price : 0 }).eq('id', link.id), back);
  done(back, { ok: paid ? 'סימנתי כשולם (בלי קבלה)' : 'סימנתי כלא שולם' });
}

// ---------- reminders ----------

export async function logReminder(payerId: string, total: number, message: string) {
  await requireAccess();
  await db().from('reminder_log').insert({ payer_id: payerId, total, message });
  revalidatePath('/reminders');
}

// ---------- payments: scan → match → receipt ----------

export type ChargeOption = Pick<Charge, 'linkId' | 'childId' | 'childFirst' | 'label' | 'color' | 'due' | 'month'>;

export type PayerOption = {
  payerId: string;
  name: string;
  score: number;
  reason: string;
  debt: number;
  charges: ChargeOption[];
  suggested: { linkId: number; amount: number }[];
  leftover: number;
};

export type ScanItem = { extracted: ExtractedPayment; candidates: PayerOption[] };

export type ScanResult = { ok: true; items: ScanItem[]; allPayers: { id: string; name: string }[] } | { ok: false; error: string };

function toOption(c: Charge): ChargeOption {
  return { linkId: c.linkId, childId: c.childId, childFirst: c.childFirst, label: c.label, color: c.color, due: c.due, month: c.month };
}

export async function scanScreenshot(base64: string, mimeType: string): Promise<ScanResult> {
  await requireAccess();
  try {
    const [extracted, model, aliases] = await Promise.all([extractPayments(base64, mimeType), loadModel(), loadAliases()]);
    if (!extracted.length) return { ok: false, error: 'לא מצאתי תשלומים בתמונה' };
    const debts = familyDebts(model);
    const debtByPayer = new Map(debts.map((d) => [d.payerId, d.total]));
    const items: ScanItem[] = extracted.map((p) => {
      const ranked = rankPayers({
        rawName: p.payerName || '', note: p.note || '', amount: p.amount || 0,
        payers: model.payers, aliases, children: model.children, debtByPayer,
      });
      const candidates = ranked.map((r) => {
        const charges = openCharges(model, r.payerId);
        const { allocations, leftover } = allocate(p.amount || 0, charges, r.matchedChildIds);
        return {
          payerId: r.payerId,
          name: model.payers.find((x) => x.morning_customer_id === r.payerId)?.name || '—',
          score: Math.round(r.score * 100),
          reason: r.reason,
          debt: debtByPayer.get(r.payerId) || 0,
          charges: charges.map(toOption),
          suggested: allocations,
          leftover,
        };
      });
      return { extracted: p, candidates };
    });
    const allPayers = model.payers.map((p) => ({ id: p.morning_customer_id, name: p.name || '—' })).sort((a, b) => a.name.localeCompare(b.name, 'he'));
    return { ok: true, items, allPayers };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Open charges of a payer chosen by hand. */
export async function payerCharges(payerId: string, amount: number): Promise<PayerOption | null> {
  await requireAccess();
  const model = await loadModel();
  const p = model.payers.find((x) => x.morning_customer_id === payerId);
  if (!p) return null;
  const charges = openCharges(model, payerId);
  const { allocations, leftover } = allocate(amount, charges);
  return {
    payerId, name: p.name || '—', score: 0, reason: 'manual',
    debt: round2(charges.reduce((t, c) => t + c.due, 0)),
    charges: charges.map(toOption), suggested: allocations, leftover,
  };
}

export type CommitInput = {
  payerId: string;
  rawName: string;
  amount: number;
  date: string;
  method: PaymentMethod;
  note: string;
  reference: string;
  allocations: { linkId: number; amount: number }[];
};

export type CommitResult = { ok: true; number: string | null; url: string | null } | { ok: false; error: string };

export async function commitPayment(input: CommitInput): Promise<CommitResult> {
  await requireAccess();
  try {
    const allocs = input.allocations.filter((a) => a.amount > 0);
    if (!allocs.length) return { ok: false, error: 'לא בחרת אף חיוב' };
    const sum = round2(allocs.reduce((t, a) => t + a.amount, 0));
    if (sum > input.amount + 0.005) return { ok: false, error: `שייכת ₪${sum} — יותר מסכום התשלום (₪${input.amount})` };

    const model = await loadModel();
    const charges = new Map(openCharges(model, input.payerId).map((c) => [c.linkId, c]));
    // allow charges that aren't open yet (e.g. paying ahead) — look them up across all rows
    const lines = allocs.map((a) => {
      const c = charges.get(a.linkId);
      const link = model.links.find((l) => l.id === a.linkId);
      const act = link && model.activities.find((x) => x.id === link.activity_id);
      const child = link && model.children.find((x) => x.id === link.child_id);
      if (!link || !act || !child) throw new Error('חיוב לא נמצא');
      const label = c?.label || act.name || 'פעילות';
      return { a, link, act, child, description: `${label} · ${childName(child)}`, itemId: act.morning_item_id };
    });

    const extra = round2(input.amount - sum);
    const doc = await createReceipt({
      clientId: input.payerId,
      date: input.date || todayISO(),
      method: input.method,
      amount: input.amount,
      lines: [
        ...lines.map((l) => ({ description: l.description, price: l.a.amount, itemId: l.itemId })),
        ...(extra > 0 ? [{ description: 'זיכוי לחודשים הבאים', price: extra }] : []),
      ],
      remarks: input.note || undefined,
    });
    const docRef = doc.number || doc.id;

    for (const l of lines) {
      const price = Number(l.link.price ?? l.act.default_price ?? model.settings.default_full_price ?? 0);
      const paid = round2(Number(l.link.paid_amount || 0) + l.a.amount);
      await db().from('child_activity').update({
        paid_amount: paid,
        payment_status: statusFor(price, paid),
        invoices: [...(l.link.invoices || []), docRef],
      }).eq('id', l.link.id);
    }

    await db().from('payment_log').insert({
      paid_at: input.date || null, payer_id: input.payerId, raw_name: input.rawName || null,
      amount: input.amount, method: input.method, note: input.note || null, reference: input.reference || null,
      morning_document_id: doc.id, morning_document_number: doc.number, morning_document_url: doc.url,
      allocations: allocs.map((a) => ({ child_activity_id: a.linkId, amount: a.amount })),
    });

    // remember the name on the screenshot for next time
    const payer = model.payers.find((p) => p.morning_customer_id === input.payerId);
    if (input.rawName && normName(input.rawName) !== normName(payer?.name)) {
      await db().from('payer_name_aliases').upsert({ payer_id: input.payerId, raw_name: input.rawName }, { onConflict: 'payer_id,raw_name', ignoreDuplicates: true });
    }

    revalidatePath('/', 'layout');
    return { ok: true, number: doc.number, url: doc.url };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
