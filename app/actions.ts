'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/lib/supabase';
import { requireAccess } from '@/lib/auth';
import { addAlias, loadAliases, loadModel, loadPaymentLog, loadSettings, P_EMAILS, P_PHONE } from '@/lib/data';
import { allCharges, allocate, childName, familyDebts, groupLabel, isClass, openCharges, round2, statusFor, type Charge, type Model } from '@/lib/billing';
import { rankPayers, normName, sameFirstName, splitSender } from '@/lib/matching';
import { createMorningClient, createReceipt, morningConfigured, searchMorningClients, searchMorningItems, testMorningConnection, type MorningClientHit, type MorningItemHit, type MorningTestResult } from '@/lib/morning';
import { extractPaymentsDebug, extractRegistration, type ExtractedPayment, type ExtractedRegistration } from '@/lib/gemini';
import { addMonths, fmtDate, joinMonthPrice, monthEnd, monthLabel, monthStart, monthsBetween, todayISO } from '@/lib/dates';
import type { PaymentLog, PaymentMethod } from '@/lib/types';

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

// ---------- diagnostics ----------

/** Sidebar "test connection" button: customer search against Morning, raw response back. */
export async function testMorning(): Promise<MorningTestResult> {
  await requireAccess();
  return testMorningConnection();
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

/**
 * Creates child_activity rows: every month of the group from the join date (`from`, a date), or the single
 * camp row. The join month of a group is charged for the lessons left in it only (joinMonthPrice);
 * a join after the month's last lesson starts from the next month.
 */
async function enrollRows(childId: string, fd: FormData, back: string, groupIds: string[] = fd.getAll('group').map(String)) {
  const settings = await loadSettings();
  const join = s(fd, 'from') || todayISO();
  const from = monthStart(join);
  const rows: { child_id: string; activity_id: number; price: number | null; payment_status: string; paid_amount: number }[] = [];
  for (const groupId of groupIds) {
    const mode = (s(fd, `mode_${groupId}`) || 'full') as PriceMode;
    const price = priceFor(mode, num(fd, `custom_${groupId}`), settings.default_discount_price);
    const group = await must(db().from('class_groups').select('day').eq('id', groupId).maybeSingle(), back) as any;
    const months = await must(db().from('activities').select('id,start_date,default_price').eq('class_group_id', groupId).gte('start_date', from).order('start_date', { ascending: true }), back) as any[];
    if (!months.length) fail(back, 'לקבוצה הזו אין חודשים פתוחים — צרי אותם במסך החוגים');
    for (const m of months) {
      let rowPrice = price;
      if (m.start_date === from) {
        const monthly = Number(price ?? m.default_price ?? settings.default_full_price ?? 0);
        const j = joinMonthPrice(monthly, group?.day, join);
        if (j && j.left === 0) continue; // no lessons left this month
        if (j && j.left < j.total) rowPrice = j.price;
      }
      rows.push({ child_id: childId, activity_id: m.id, price: rowPrice, payment_status: 'unpaid', paid_amount: 0 });
    }
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

export type ParsedRegistration = {
  reg: ExtractedRegistration;
  groupIds: string[]; // class groups whose day/time matches the activity hint
  campIds: number[]; // camps whose name matches the activity hint
};

/** Reads pasted registration text (e.g. a WhatsApp message) and matches the activity. Read-only. */
export async function parseRegistration(text: string): Promise<{ ok: true; data: ParsedRegistration } | { ok: false; error: string }> {
  await requireAccess();
  try {
    const [reg, model] = await Promise.all([extractRegistration(text), loadModel()]);
    const hint = normName(reg.activity);
    const overlap = (a: string, b: string) => !!a && !!b && (a.includes(b) || b.includes(a));
    const campIds = hint
      ? model.activities.filter((a) => !isClass(a) && overlap(hint, normName(a.name))).map((a) => a.id)
      : [];
    const groupIds = hint && !campIds.length
      ? model.groups.filter((g) => overlap(hint, normName(groupLabel(g)))).map((g) => g.id)
      : [];
    return { ok: true, data: { reg, groupIds, campIds } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function createChild(fd: FormData) {
  await requireAccess();
  const back = '/children/new';
  const first = s(fd, 'first_name');
  const family = s(fd, 'family_name');
  if (!first) fail(back, 'צריך שם פרטי');

  // A new payer always arrives with a Morning customer id chosen in the form (found by search, or opened
  // with the explicit "add" button). Saving never opens a Morning customer by itself.
  const payerFromForm = async (prefix: 'payer' | 'payer2', who: string): Promise<string> => {
    const id = s(fd, `${prefix}_morning_id`);
    const name = s(fd, `${prefix}_name`);
    if (!id) fail(back, `${who}: צריך לבחור לקוח/ה מ-Morning או להוסיף כלקוח/ה חדש/ה לפני השמירה`);
    if (!name) fail(back, `${who}: צריך שם`);
    // a Morning customer may already be a payer here
    const known = await must(db().from('payer_name_aliases').select('morning_customer_id').eq('morning_customer_id', id).limit(1), back) as any[];
    if (!known.length) {
      await must(db().from('payer_name_aliases').insert({
        morning_customer_id: id, name, [P_PHONE]: s(fd, `${prefix}_phone`) || null, [P_EMAILS]: s(fd, `${prefix}_email`) || null,
      }), back);
    }
    return id;
  };

  const payerId = s(fd, 'existing_payer') || await payerFromForm('payer', 'משלם/ת');
  const payer2: string | null = s(fd, 'payer2_name') ? await payerFromForm('payer2', 'משלם/ת שני/ה') : null;

  const child = await must(db().from('children').insert({
    first_name: first, family_name: family || null, gender: s(fd, 'gender') || null,
    morning_customer_id: payerId, morning_customer_id_2: payer2,
  }).select('id').single(), back) as any;

  const n = await enrollRows(child.id, fd, `/children/${child.id}`);

  // Registration payment (מקדמה / דמי הרשמה): allocate it, issue a Morning receipt, log it.
  let payMsg = '';
  const paidAmount = num(fd, 'paid_amount');
  if (paidAmount && paidAmount > 0) {
    const method = (s(fd, 'paid_method') || 'other') as PaymentMethod;
    const date = s(fd, 'paid_date') || todayISO();
    const model = await loadModel();
    const charges = allCharges(model).filter((c) => c.childId === child.id && c.due > 0);
    const { allocations } = allocate(paidAmount, charges, [child.id]);

    let docRef: string | null = null;
    if (morningConfigured()) {
      try {
        const doc = await createReceipt({
          clientId: payerId,
          date, method, amount: paidAmount,
          lines: allocations.length
            ? allocations.map((a) => {
                const c = charges.find((x) => x.linkId === a.linkId)!;
                return { description: `${c.label} · ${[first, family].filter(Boolean).join(' ')}`, price: a.amount, itemId: c.morningItemId };
              })
            : [{ description: `דמי הרשמה · ${first}`, price: paidAmount }],
        });
        docRef = doc.id; // Morning document id (uuid)
        await db().from('payment_log').insert({
          paid_at: date, payer_id: payerId, raw_name: s(fd, 'payer_name') || null,
          amount: paidAmount, method, note: `דמי הרשמה · ${first}`,
          morning_document_id: doc.id, morning_document_number: doc.number, morning_document_url: doc.url,
          allocations: allocations.map((a) => ({ child_activity_id: a.linkId, amount: a.amount })),
        });
        payMsg = ` והפקתי קבלה ${doc.number || ''}`;
      } catch (e) {
        payMsg = ` (רשמתי את התשלום אבל הקבלה ב-Morning נכשלה: ${(e as Error).message})`;
      }
    }

    for (const a of allocations) {
      const c = charges.find((x) => x.linkId === a.linkId)!;
      const link = model.links.find((l) => l.id === a.linkId)!;
      const paid = round2(Number(link.paid_amount || 0) + a.amount);
      // a partial payment on a camp at registration is a deposit (מקדמה)
      const status = !c.isClass && paid < c.price ? 'deposit' : statusFor(c.price, paid);
      await must(db().from('child_activity').update({
        paid_amount: paid, payment_status: status,
        ...(docRef ? { invoices: [...(link.invoices || []), docRef] } : {}),
      }).eq('id', a.linkId), `/children/${child.id}`);
    }
  }

  done(`/children/${child.id}`, { ok: `שמרתי את ${first} ויצרתי ${n} חיובים${payMsg}` });
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

/**
 * Child page "שיבוץ לפעילויות". The child's current groups (rows this month or later) come ticked.
 * - one current group unticked + one other group ticked = a move: the old group's rows from next month
 *   are switched to the new group's activity for the same month (price, payments and receipts stay);
 *   blocked when the new group lacks any of those months
 * - a group ticked on its own = joined from the join date (first month prorated)
 * - a current group unticked on its own does nothing — stopping is the group's own button
 */
export async function enrollChild(fd: FormData) {
  await requireAccess();
  const id = s(fd, 'id');
  const back = `/children/${id}`;
  const thisMonth = monthStart(todayISO());
  const mine = await must(db().from('child_activity').select('id,activity_id').eq('child_id', id), back) as { id: number; activity_id: number }[];
  const acts = mine.length
    ? await must(db().from('activities').select('id,start_date,class_group_id').in('id', mine.map((r) => r.activity_id)), back) as { id: number; start_date: string | null; class_group_id: string | null }[]
    : [];
  const actOf = new Map(acts.map((a) => [a.id, a]));
  const current = new Set(mine.map((r) => actOf.get(r.activity_id)).filter((a) => a?.class_group_id && (a.start_date || '') >= thisMonth).map((a) => a!.class_group_id!));
  const ticked = fd.getAll('group').map(String);
  const added = ticked.filter((g) => !current.has(g));
  const removed = [...current].filter((g) => !ticked.includes(g));

  const notes: string[] = [];
  let joinGroups = added;
  if (removed.length && added.length) {
    if (removed.length !== 1 || added.length !== 1) fail(back, 'אפשר להעביר מחוג אחד לחוג אחד בכל פעם');
    const [fromGroup, toGroup] = [removed[0], added[0]];
    const next = addMonths(thisMonth, 1);
    const moving = mine.filter((r) => { const a = actOf.get(r.activity_id); return a?.class_group_id === fromGroup && (a.start_date || '') >= next; });
    const target = await must(db().from('activities').select('id,start_date').eq('class_group_id', toGroup).gte('start_date', next), back) as { id: number; start_date: string }[];
    const byMonth = new Map(target.map((a) => [monthStart(a.start_date), a.id]));
    const missing = moving.map((r) => actOf.get(r.activity_id)!.start_date!).filter((d) => !byMonth.has(monthStart(d)));
    if (missing.length) fail(back, `לחוג החדש אין את החודשים: ${missing.map(monthLabel).join(', ')} — צרי אותם במסך החוגים ואז נסי שוב`);
    for (const r of moving) {
      const to = byMonth.get(monthStart(actOf.get(r.activity_id)!.start_date!))!;
      await must(db().from('child_activity').update({ activity_id: to }).eq('id', r.id), back);
    }
    notes.push(moving.length ? `העברתי ${moving.length} חודשים לחוג החדש מ${monthLabel(next)}` : 'לא היו חודשים להעביר מהחודש הבא');
    joinGroups = [];
  } else if (removed.length) {
    notes.push('הסרת סימון מחוג לא מוחקת חודשים — להפסקה יש את הכפתור ״מחיקת החודשים הבאים״');
  }
  const n = await enrollRows(id, fd, back, joinGroups);
  if (n) notes.unshift(`הוספתי ${n} חיובים`);
  done(back, { ok: notes.join(' · ') || 'לא היה מה לשנות' });
}

export async function setChargePrice(fd: FormData) {
  await requireAccess();
  const childId = s(fd, 'child');
  const back = `/children/${childId}`;
  await must(db().from('child_activity').update({ price: num(fd, 'price') }).eq('id', Number(s(fd, 'link'))), back);
  done(back, { ok: 'עדכנתי את המחיר' });
}

/** Child page, current group: the join month's price (typed, or recalculated from a join date). Refused once that month has any payment. */
export async function setJoinMonthPrice(fd: FormData) {
  await requireAccess();
  const childId = s(fd, 'id');
  const back = `/children/${childId}`;
  const link = Number(s(fd, 'join_link'));
  const price = num(fd, 'join_price');
  if (!link || price == null || price < 0) fail(back, 'צריך מחיר לחודש ההצטרפות');
  const row = await must(db().from('child_activity').select('payment_status,paid_amount').eq('id', link).eq('child_id', childId).maybeSingle(), back) as any;
  if (!row) fail(back, 'לא מצאתי את החודש');
  if (row.payment_status === 'paid' || row.payment_status === 'deposit' || Number(row.paid_amount) > 0) fail(back, 'חודש ההצטרפות כבר שולם — אי אפשר לשנות את המחיר');
  const updated = await must(db().from('child_activity').update({ price }).eq('id', link).select('id,price'), back) as any[];
  console.log('[join price]', { childId, link, price, before: row, updated });
  if (!updated?.length) fail(back, `המחיר לא נשמר — אף שורה לא עודכנה (child_activity ${link})`);
  done(back, { ok: `עדכנתי את מחיר חודש ההצטרפות ל-₪${price}` });
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

export type ChargeOption = Pick<Charge, 'linkId' | 'childId' | 'childFirst' | 'label' | 'color' | 'due' | 'month' | 'activityId' | 'isClass' | 'price' | 'paid'>;

// A first קייטנה payment below the price is a מקדמה by default; the user may switch it to a plain partial payment.
export type CampPayKind = 'deposit' | 'partial';
// The Morning catalogue item a deposit is invoiced with, e.g. "קייטנה חנוכה 2026 - מקדמה"
export type DepositItem = { id: string; name: string };

export type PayerOption = {
  payerId: string;
  name: string;
  score: number;
  reason: string;
  debt: number;
  charges: ChargeOption[];
  suggested: { linkId: number; amount: number }[];
  leftover: number;
  kids: { id: string; first: string; name: string }[]; // the payer's children
  focus: Focus; // what the note points at, resolved against this payer
  alerts: DupAlert[]; // reasons this payment looks like a duplicate
};

export type DupAlert = { text: string; url: string | null };

/** The child + activity the note is about, and where that charge stands for this payer. */
export type Focus = {
  childId: string | null; // the payer's child the note points at (null: no child by that name)
  childName: string; // matched child's full name, or the name as written in the note
  activity: string; // "c:<campId>" | "g:<groupId>" | ''
  activityLabel: string;
  isCamp: boolean;
  registered: boolean; // the child has a charge for that activity
  linkId: number | null;
  status: Charge['status'] | null;
  price: number;
  paid: number;
  /** first names to choose from when it isn't clear which child the payment is for (empty when it is) */
  pick: string[];
  payments: { date: string | null; amount: number; number: string | null; url: string | null }[];
};

/** What the scanned payment says — needed again when a payer is picked by hand. */
export type ScanCtx = { amount: number; date: string; reference: string; suggest: ScanSuggest };

// What the note says the payment is for — prefills the new-customer form. activity: "c:<campId>" | "g:<groupId>" | ''
// named: the note names the specific activity (otherwise activity is only a default guess); isClass: the note says "חוג"
export type ScanSuggest = {
  childFirst: string; activity: string; isCamp: boolean; isClass: boolean; named: boolean;
  /** children named in the sender line ("ספיר אמא עימרי ואלה"); with several, the user picks which one paid for */
  senderKids: string[];
};

// alerts: duplicate signs that don't depend on the payer (same reference already logged)
export type ScanItem = { extracted: ExtractedPayment; candidates: PayerOption[]; suggest: ScanSuggest; alerts: DupAlert[] };

/** Reads the child and the activity out of the payment note ("עבור דליה קייטנת אומנות של מעיין 2026"). */
function suggestFromNote(p: ExtractedPayment, enroll: EnrollOptions): ScanSuggest {
  const text = normName([p.activity, p.note].filter(Boolean).join(' '));
  const overlap = (a: string, b: string) => !!a && !!b && (a.includes(b) || b.includes(a));
  const hint = normName(p.activity);
  const isCamp = text.includes('קייטנ');
  let activity = '';
  let named = false;
  const isClassNote = !isCamp && text.includes('חוג');
  if (isCamp) {
    // a camp named in the note wins; otherwise the nearest upcoming camp (the list is ordered by start date)
    const namedCamp = enroll.camps.find((c) => overlap(hint, normName(c.name)));
    const camp = namedCamp || enroll.camps[0];
    if (camp) activity = `c:${camp.id}`;
    named = !!namedCamp;
  } else if (isClassNote) {
    const group = enroll.groups.find((g) => overlap(hint, normName(g.label)) || normName(g.label).split(' ').every((t) => text.includes(t)));
    if (group) activity = `g:${group.id}`;
    named = !!group;
  }
  // children in the sender line: what the reader separated, else what follows "אמא/אבא" in the name itself
  const senderKids = (p.payerChildren.length ? p.payerChildren : splitSender(p.payerName || '').kids.map((t) => (t.length > 3 && t[0] === 'ו' ? t.slice(1) : t)))
    .map((n) => n.trim()).filter(Boolean);
  // the note's child wins; a single child in the sender line is the child; several → the card asks
  const childFirst = (p.childName || '').trim() || (senderKids.length === 1 ? senderKids[0] : '');
  return { childFirst, activity, isCamp, isClass: isClassNote, named, senderKids };
}

export type EnrollOptions = {
  groups: { id: string; label: string; color: string }[];
  camps: { id: number; name: string; color: string; price: number }[];
};

export type ScanResult = { ok: true; items: ScanItem[]; allPayers: { id: string; name: string }[]; enroll: EnrollOptions; labels: string[]; debug: { model: string; raw: string } } | { ok: false; error: string };

/** Label names from the morning_labels table (offered when opening a new Morning client). */
async function loadMorningLabels(): Promise<string[]> {
  const { data, error } = await db().from('morning_labels').select('*');
  if (error) { console.log('[morning debug] morning_labels:', error.message); return []; }
  // Column name isn't fixed in code: take name/label/title, else the first non-id text column
  const names = (data || []).map((row: any) => {
    const v = row.name ?? row.label ?? row.title
      ?? Object.entries(row).find(([k, val]) => typeof val === 'string' && val && k !== 'id' && !k.endsWith('_id') && !k.endsWith('_at'))?.[1];
    return typeof v === 'string' ? v.trim() : '';
  }).filter(Boolean);
  return [...new Set(names)].sort((a, b) => a.localeCompare(b, 'he'));
}

export type MorningSearchResult = { ok: true; clients: MorningClientHit[] } | { ok: false; error: string };

/** Scanner: look for an existing Morning client by (editable) name. */
export async function searchMorning(name: string): Promise<MorningSearchResult> {
  await requireAccess();
  try {
    if (!name.trim()) return { ok: true, clients: [] };
    if (!morningConfigured()) return { ok: false, error: 'מפתחות Morning לא מוגדרים' };
    return { ok: true, clients: await searchMorningClients(name.trim()) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Label names for the new-child form's "add as a Morning customer" step. */
export async function morningLabels(): Promise<string[]> {
  await requireAccess();
  return loadMorningLabels();
}

export type AddMorningCustomerResult = { ok: true; id: string; name: string } | { ok: false; error: string };

/**
 * New-child form: opens a Morning customer on an explicit click, named "<parent> (<child>)".
 * Touches Morning only — the payer row is written when the form is saved.
 */
export async function addMorningCustomer(input: { name: string; phone: string; email: string; labels: string[]; childFirst: string }): Promise<AddMorningCustomerResult> {
  await requireAccess();
  try {
    const parent = input.name.trim();
    const childFirst = input.childFirst.trim();
    if (!parent) return { ok: false, error: 'צריך שם מלא' };
    if (!childFirst) return { ok: false, error: 'צריך שם פרטי לילד/ה' };
    if (!morningConfigured()) return { ok: false, error: 'מפתחות Morning לא מוגדרים' };
    const name = parent.endsWith(`(${childFirst})`) ? parent : `${parent} (${childFirst})`;
    const payload = { name, phone: input.phone.trim(), email: input.email.trim(), labels: input.labels };
    console.log('[morning debug] addMorningCustomer → /clients:', JSON.stringify(payload, null, 2));
    const id = await createMorningClient(payload);
    console.log('[morning debug] /clients → id:', id);
    return { ok: true, id, name };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

function toOption(c: Charge): ChargeOption {
  return { linkId: c.linkId, childId: c.childId, childFirst: c.childFirst, label: c.label, color: c.color, due: c.due, month: c.month, activityId: c.activityId, isClass: c.isClass, price: c.price, paid: c.paid };
}

export type DepositItemsResult = { ok: true; query: string; items: MorningItemHit[] } | { ok: false; error: string };

/**
 * Scanner: the Morning item a קייטנה deposit is invoiced with. Default search is "<activity name> - מקדמה";
 * when that finds nothing, falls back to the activity name so the user has candidates to pick from.
 */
export async function findDepositItems(activityId: number, query?: string): Promise<DepositItemsResult> {
  await requireAccess();
  try {
    if (!morningConfigured()) return { ok: false, error: 'מפתחות Morning לא מוגדרים' };
    const custom = query?.trim();
    if (custom) return { ok: true, query: custom, items: await searchMorningItems(custom) };
    const act = await db().from('activities').select('name').eq('id', activityId).maybeSingle();
    if (act.error) return { ok: false, error: act.error.message };
    const name = (act.data?.name || '').trim().replace(/\s+/g, ' ');
    if (!name) return { ok: false, error: 'לפעילות אין שם — אי אפשר לחפש את פריט המקדמה' };
    const wanted = `${name} - מקדמה`;
    console.log(`[morning debug] findDepositItems: activity ${activityId} name "${name}" → searching "${wanted}"`);
    // Widen step by step so the pick list has candidates even when the activity is named differently in Morning
    for (const q of [wanted, name, 'מקדמה']) {
      const items = await searchMorningItems(q);
      if (items.length) return { ok: true, query: wanted, items };
    }
    return { ok: true, query: wanted, items: [] };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Receipt line + resulting status for one charge, honouring a deposit / partial choice on a camp. */
function campLine(c: { isClass: boolean; price: number; label: string }, paidAfter: number, childLabel: string, regularItemId: string | null, kind?: CampPayKind | null, depositItem?: DepositItem | null) {
  const below = paidAfter < c.price - 0.005;
  if (!c.isClass && below && kind === 'deposit') {
    if (!depositItem?.id) throw new Error('לא נבחר פריט מקדמה ב-Morning');
    return { description: `${depositItem.name} · ${childLabel}`, itemId: depositItem.id, status: 'deposit' };
  }
  return { description: `${c.label} · ${childLabel}`, itemId: regularItemId, status: statusFor(c.price, paidAfter) as string };
}

const ils = (n: number) => '₪' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
const logDate = (l: PaymentLog) => l.paid_at || (l.created_at || '').slice(0, 10) || null;
const receiptOf = (l: PaymentLog) => (l.morning_document_number ? ` · קבלה ${l.morning_document_number}` : '');

/** A reference number that is already in the payment log is the same payment, whoever the payer is. */
function referenceAlerts(logs: PaymentLog[], reference: string): DupAlert[] {
  const ref = (reference || '').trim();
  if (!ref) return [];
  return logs.filter((l) => (l.reference || '').trim() === ref).map((l) => ({
    text: `התשלום הזה כבר נרשם: אסמכתא ${ref}, ${ils(l.amount)} ב-${fmtDate(logDate(l))}${receiptOf(l)}`,
    url: l.morning_document_url,
  }));
}

/**
 * Everything the scan card shows for one payer: the charges that can be paid, what the note points at
 * (child + activity + where that charge stands) and whether this looks like a payment already recorded.
 */
function buildOption(model: Model, logs: PaymentLog[], enroll: EnrollOptions, payerId: string, ctx: ScanCtx, base: { score: number; reason: string; matchedChildIds: string[] }): PayerOption {
  const { suggest, amount } = ctx;
  const kidRows = model.children.filter((c) => c.morning_customer_id === payerId || c.morning_customer_id_2 === payerId);
  const kidIds = new Set(kidRows.map((k) => k.id));
  const mine = allCharges(model).filter((c) => c.payerId === payerId || kidIds.has(c.childId));
  // payable now: started charges, plus camps not started yet (camps are paid ahead)
  const charges = mine.filter((c) => c.due > 0 && (c.started || !c.isClass));

  // --- the child: the name in the note, else the child matched from the note's words, else an only child
  const want = normName(suggest.childFirst);
  const kid = want
    ? kidRows.find((k) => normName(k.first_name) === want) || kidRows.find((k) => sameFirstName(k.first_name, want))
    : kidRows.find((k) => k.id === base.matchedChildIds[0]) || (kidRows.length === 1 ? kidRows[0] : undefined);
  const kidCharges = kid ? mine.filter((c) => c.childId === kid.id) : [];
  // Not clear which child: offer the children from the sender line (registered or not), else all the payer's children
  let pick: string[] = [];
  if (!kid && !want) {
    const fromSender = (suggest.senderKids || []).map((n) => kidRows.find((k) => sameFirstName(k.first_name, n))?.first_name || n);
    const names = fromSender.length > 1 ? fromSender : kidRows.length > 1 ? kidRows.map((k) => k.first_name || '') : [];
    pick = [...new Set(names.filter(Boolean))];
  }
  const groupOf = (c: Charge) => model.activities.find((a) => a.id === c.activityId)?.class_group_id || null;

  // --- the activity: as named in the note; a guess gives way to what this child is actually registered to
  let activity = suggest.activity;
  if (kid && !suggest.named) {
    if (suggest.isCamp) {
      const camps = kidCharges.filter((c) => !c.isClass);
      const own = camps.find((c) => c.due > 0) || camps[camps.length - 1];
      if (own) activity = `c:${own.activityId}`;
    } else if (suggest.isClass) {
      const cls = kidCharges.filter((c) => c.isClass);
      const own = cls.find((c) => c.due > 0) || cls[cls.length - 1];
      const gid = own && groupOf(own);
      if (gid) activity = `g:${gid}`;
    }
  }
  const isCamp = activity.startsWith('c:');
  let activityLabel = '';
  let charge: Charge | undefined;
  if (isCamp) {
    const id = Number(activity.slice(2));
    activityLabel = model.activities.find((a) => a.id === id)?.name || 'קייטנה';
    charge = kidCharges.find((c) => c.activityId === id);
  } else if (activity.startsWith('g:')) {
    const gid = activity.slice(2);
    activityLabel = `חוג ${groupLabel(model.groups.find((g) => g.id === gid))}`;
    const rows = kidCharges.filter((c) => groupOf(c) === gid);
    // the month this payment is for: the earliest one still owed, else the latest month
    charge = rows.find((c) => c.started && c.due > 0) || rows.find((c) => c.due > 0) || rows[rows.length - 1];
  }
  const payments = charge
    ? logs.flatMap((l) => (l.allocations || []).filter((a) => a.child_activity_id === charge!.linkId)
        .map((a) => ({ date: logDate(l), amount: Number(a.amount), number: l.morning_document_number, url: l.morning_document_url })))
    : [];
  const focus: Focus = {
    childId: kid?.id || null,
    childName: kid ? childName(kid) : suggest.childFirst,
    activity, activityLabel, isCamp,
    registered: !!charge,
    pick,
    linkId: charge?.linkId ?? null,
    status: charge?.status ?? null,
    price: charge?.price ?? 0,
    paid: charge?.paid ?? 0,
    payments,
  };

  // --- duplicate signs
  const alerts = referenceAlerts(logs, ctx.reference);
  const flagged = new Set(alerts.map((a) => a.url));
  for (const l of logs) {
    if (l.payer_id !== payerId || !l.paid_at || l.paid_at !== ctx.date || Math.abs(Number(l.amount) - amount) > 0.005) continue;
    if (l.morning_document_url && flagged.has(l.morning_document_url)) continue;
    alerts.push({ text: `כבר נרשם תשלום של ${ils(l.amount)} מהמשלם/ת הזה/ו בתאריך ${fmtDate(l.paid_at)}${receiptOf(l)}`, url: l.morning_document_url });
  }
  if (charge) {
    const what = `${activityLabel} של ${focus.childName}`;
    if (charge.due <= 0) {
      alerts.push({ text: `${what} כבר שולמה במלואה (${ils(charge.paid)})`, url: payments[payments.length - 1]?.url || null });
    } else if (charge.paid > 0 && (Math.abs(charge.paid - amount) < 0.005 || payments.some((p) => Math.abs(p.amount - amount) < 0.005))) {
      const prev = payments.find((p) => Math.abs(p.amount - amount) < 0.005) || payments[payments.length - 1];
      alerts.push({ text: `כבר שולם סכום זהה (${ils(amount)}) עבור ${what}${prev?.date ? ` ב-${fmtDate(prev.date)}` : ''} — ייתכן שזו אותה ${charge.status === 'deposit' ? 'מקדמה' : 'העברה'}`, url: prev?.url || null });
    }
  }

  // --- suggested split: the identified charge first; a fully paid one is not silently moved elsewhere
  let allocations: { linkId: number; amount: number }[] = [];
  let leftover = amount;
  if (charge && charge.due <= 0) {
    allocations = [];
  } else if (charge) {
    const first = round2(Math.min(charge.due, amount));
    const rest = allocate(round2(amount - first), charges.filter((c) => c.linkId !== charge!.linkId), kid ? [kid.id] : base.matchedChildIds);
    allocations = [...(first > 0 ? [{ linkId: charge.linkId, amount: first }] : []), ...rest.allocations];
    leftover = rest.leftover;
  } else {
    // a note that says "קייטנה" pays the camp charges first (when the payer has any open)
    const campCharges = suggest.isCamp ? charges.filter((c) => !c.isClass) : [];
    const pool = campCharges.length ? campCharges : charges;
    // which child isn't known: split the money only when it covers everything open, otherwise leave it to the user
    const coversAll = Math.abs(round2(pool.reduce((t, c) => t + c.due, 0)) - amount) < 0.005;
    if (!pick.length || coversAll) ({ allocations, leftover } = allocate(amount, pool, base.matchedChildIds));
  }

  return {
    payerId,
    name: model.payers.find((x) => x.morning_customer_id === payerId)?.name || '—',
    score: base.score,
    reason: base.reason,
    debt: round2(openCharges(model, payerId).reduce((t, c) => t + c.due, 0)),
    charges: charges.map(toOption),
    suggested: allocations,
    leftover,
    kids: kidRows.map((k) => ({ id: k.id, first: k.first_name || '', name: childName(k) })),
    focus,
    alerts,
  };
}

function enrollOptions(model: Model): EnrollOptions {
  return {
    groups: model.groups.map((g) => ({ id: g.id, label: groupLabel(g), color: g.color || '#5C5A66' })).sort((a, b) => a.label.localeCompare(b.label, 'he')),
    camps: model.activities.filter((a) => !isClass(a) && (!a.end_date || a.end_date >= model.today)).map((a) => ({ id: a.id, name: a.name || 'קייטנה', color: a.color || '#8E5BD9', price: Number(a.default_price ?? model.settings.default_full_price ?? 0) })),
  };
}

export async function scanScreenshot(base64: string, mimeType: string): Promise<ScanResult> {
  await requireAccess();
  try {
    const [read, model, aliases, labels, logs] = await Promise.all([extractPaymentsDebug(base64, mimeType), loadModel(), loadAliases(), loadMorningLabels(), loadPaymentLog()]);
    const extracted = read.payments;
    if (!extracted.length) return { ok: false, error: 'לא מצאתי תשלומים בתמונה' };
    const debts = familyDebts(model);
    const debtByPayer = new Map(debts.map((d) => [d.payerId, d.total]));
    const enroll = enrollOptions(model);
    const items: ScanItem[] = extracted.map((p) => {
      const suggest = suggestFromNote(p, enroll);
      const ranked = rankPayers({
        rawName: p.payerName || '', ownName: p.payerOwnName || '', senderChildren: p.payerChildren, note: p.note || '', amount: p.amount || 0,
        payers: model.payers, aliases, children: model.children, debtByPayer,
      });
      const ctx: ScanCtx = { amount: p.amount || 0, date: p.date || '', reference: p.reference || '', suggest };
      const candidates = ranked.map((r) => buildOption(model, logs, enroll, r.payerId, ctx, { score: Math.round(r.score * 100), reason: r.reason, matchedChildIds: r.matchedChildIds }));
      return { extracted: p, candidates, suggest, alerts: referenceAlerts(logs, p.reference || '') };
    });
    const allPayers = model.payers.map((p) => ({ id: p.morning_customer_id, name: p.name || '—' })).sort((a, b) => a.name.localeCompare(b.name, 'he'));
    return { ok: true, items, allPayers, enroll, labels, debug: { model: read.model, raw: read.raw } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** A payer chosen by hand (or re-read after a registration): the same details as a scanned match. */
export async function payerCharges(payerId: string, ctx: ScanCtx): Promise<PayerOption | null> {
  await requireAccess();
  const [model, logs] = await Promise.all([loadModel(), loadPaymentLog()]);
  if (!model.payers.some((x) => x.morning_customer_id === payerId)) return null;
  return buildOption(model, logs, enrollOptions(model), payerId, ctx, { score: 0, reason: 'manual', matchedChildIds: [] });
}

type ActRow = { id: number; default_price: number | null };

/**
 * The activity rows a registration creates charges for: every remaining month of a group, or the one camp.
 * A group's current month is priced for the lessons left from today (joinMonthPrice); with none left it's skipped.
 * Camps are never prorated.
 */
async function resolveActs(activity: string): Promise<{ acts: ActRow[] } | { error: string }> {
  if (activity.startsWith('g:')) {
    const today = todayISO();
    const [months, group, settings] = await Promise.all([
      db().from('activities').select('id,default_price,start_date').eq('class_group_id', activity.slice(2)).gte('start_date', monthStart(today)).order('start_date', { ascending: true }),
      db().from('class_groups').select('day').eq('id', activity.slice(2)).maybeSingle(),
      loadSettings(),
    ]);
    if (months.error) return { error: `קריאת חודשי הקבוצה נכשלה: ${months.error.message}` };
    if (!months.data?.length) return { error: 'לקבוצה הזו אין חודשים פתוחים — צרי אותם במסך החוגים' };
    const acts: ActRow[] = [];
    for (const m of months.data as (ActRow & { start_date: string | null })[]) {
      if (m.start_date !== monthStart(today)) { acts.push({ id: m.id, default_price: m.default_price }); continue; }
      const monthly = Number(m.default_price ?? settings.default_full_price ?? 0);
      const j = joinMonthPrice(monthly, (group.data as any)?.day, today);
      if (j && j.left === 0) continue;
      acts.push({ id: m.id, default_price: j && j.left < j.total ? j.price : m.default_price });
    }
    if (!acts.length) return { error: 'לקבוצה הזו אין חודשים פתוחים — צרי אותם במסך החוגים' };
    return { acts };
  }
  const camp = await db().from('activities').select('id,default_price').eq('id', Number(activity.slice(2))).maybeSingle();
  if (camp.error) return { error: `קריאת הקייטנה נכשלה: ${camp.error.message}` };
  if (!camp.data) return { error: 'הקייטנה לא נמצאה' };
  return { acts: [camp.data as ActRow] };
}

export type EnrollInput = {
  payerId: string;
  childId: string; // one of the payer's children; '' → a new child under this payer
  childFirst: string;
  childFamily: string;
  gender: string;
  activity: string; // "g:<groupId>" | "c:<campId>"
};

/** Scanner, existing payer: register a child (existing or new) to an activity so the payment has a charge to go to. */
export async function enrollFromScan(input: EnrollInput): Promise<{ ok: true; childId: string } | { ok: false; error: string }> {
  await requireAccess();
  try {
    if (!input.activity) return { ok: false, error: 'צריך לבחור פעילות' };
    const resolved = await resolveActs(input.activity);
    if ('error' in resolved) return { ok: false, error: resolved.error };
    let acts = resolved.acts;

    let childId = input.childId;
    if (childId) {
      const kid = await db().from('children').select('id,morning_customer_id,morning_customer_id_2').eq('id', childId).maybeSingle();
      if (kid.error || !kid.data) return { ok: false, error: `הילד/ה לא נמצא/ה: ${kid.error?.message || ''}` };
      if (kid.data.morning_customer_id !== input.payerId && kid.data.morning_customer_id_2 !== input.payerId) return { ok: false, error: 'הילד/ה לא שייך/ת למשלם/ת הזה/ו' };
      const have = await db().from('child_activity').select('activity_id').eq('child_id', childId).in('activity_id', acts.map((a) => a.id));
      if (have.error) return { ok: false, error: have.error.message };
      const taken = new Set((have.data || []).map((r: any) => r.activity_id));
      acts = acts.filter((a) => !taken.has(a.id));
      if (!acts.length) return { ok: false, error: 'הילד/ה כבר רשום/ה לפעילות הזו' };
    } else {
      if (!input.childFirst.trim()) return { ok: false, error: 'צריך שם פרטי לילד/ה' };
      const child = await db().from('children').insert({
        first_name: input.childFirst.trim(), family_name: input.childFamily.trim() || null,
        gender: input.gender || null, morning_customer_id: input.payerId,
      }).select('id').single();
      if (child.error || !child.data) return { ok: false, error: `שמירת הילד/ה נכשלה: ${child.error?.message || ''}` };
      childId = child.data.id as string;
    }

    const ins = await db().from('child_activity').insert(
      acts.map((a) => ({ child_id: childId, activity_id: a.id, price: a.default_price ?? null, payment_status: 'unpaid', paid_amount: 0 })),
    );
    if (ins.error) return { ok: false, error: `יצירת החיובים נכשלה: ${ins.error.message}` };
    revalidatePath('/', 'layout');
    return { ok: true, childId };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export type NewCustomerInput = {
  morningClientId: string; // existing Morning client chosen in the search; '' → open a new one
  payerName: string;
  payerPhone: string;
  payerEmail: string;
  labels: string[]; // Morning labels for a new client
  alias: string; // כינוי → payer_name_aliases
  rawName: string; // name as it appears on the screenshot — also saved as alias
  childFirst: string;
  childFamily: string;
  gender: string; // "בן" | "בת"
  activity: string; // "g:<groupId>" (class, from this month) | "c:<campId>"
  kind: CampPayKind | null; // camp paid below its price: how the charge is registered
};

export type NewCustomerResult = { ok: true; payerId: string; childId: string; warning?: string } | { ok: false; error: string };

/**
 * Scanner flow for an unmatched payer — stage 1: Morning client (existing or new) + payer row + child
 * + aliases + charges. No receipt here; that's createReceiptForNewCustomer, on a separate click.
 */
export async function createCustomerFromScan(input: NewCustomerInput): Promise<NewCustomerResult> {
  await requireAccess();
  try {
    const payerName = input.payerName.trim();
    if (!payerName) return { ok: false, error: 'צריך שם משלם/ת' };
    if (!input.childFirst.trim()) return { ok: false, error: 'צריך שם פרטי לילד/ה' };
    if (!input.activity) return { ok: false, error: 'צריך לבחור פעילות' };
    if (!morningConfigured()) return { ok: false, error: 'מפתחות Morning לא מוגדרים — אי אפשר לפתוח לקוח' };

    // Resolve the activity rows before touching Morning, so a bad choice doesn't leave a client behind
    const resolved = await resolveActs(input.activity);
    if ('error' in resolved) return { ok: false, error: resolved.error };
    const acts = resolved.acts;

    // A new Morning client is named "<parent> (<child>)"; an existing one keeps the name it has in Morning
    const childFirst = input.childFirst.trim();
    const clientName = input.morningClientId || payerName.endsWith(`(${childFirst})`) ? payerName : `${payerName} (${childFirst})`;
    let payerId = input.morningClientId;
    if (!payerId) {
      const clientPayload = { name: clientName, phone: input.payerPhone.trim(), email: input.payerEmail.trim(), labels: input.labels };
      console.log('[morning debug] createCustomerFromScan → /clients:', JSON.stringify(clientPayload, null, 2));
      payerId = await createMorningClient(clientPayload);
      console.log('[morning debug] /clients → payerId:', payerId);
    } else {
      console.log('[morning debug] createCustomerFromScan → existing Morning client:', payerId);
    }
    const inMorning = input.morningClientId ? 'הלקוח קיים ב-Morning' : 'הלקוח נפתח ב-Morning';

    // An existing Morning client may already be a payer here
    const known = await db().from('payer_name_aliases').select('morning_customer_id').eq('morning_customer_id', payerId).limit(1);
    if (known.error) return { ok: false, error: `${inMorning} אבל בדיקת המשלמים נכשלה: ${known.error.message}` };
    if (!known.data?.length) {
      const fail1 = (await db().from('payer_name_aliases').insert({
        morning_customer_id: payerId, name: clientName,
        [P_PHONE]: input.payerPhone.trim() || null, [P_EMAILS]: input.payerEmail.trim() || null,
      })).error;
      if (fail1) return { ok: false, error: `${inMorning} אבל השמירה נכשלה: ${fail1.message}` };
    }

    const child = await db().from('children').insert({
      first_name: input.childFirst.trim(), family_name: input.childFamily.trim() || null,
      gender: input.gender || null, morning_customer_id: payerId,
    }).select('id').single();
    if (child.error || !child.data) return { ok: false, error: `שמירת הילד/ה נכשלה: ${child.error?.message || ''}` };
    const childId = child.data.id as string;

    // כינוי + the name on the screenshot, skipping whatever equals the payer's own name
    const warnings: string[] = [];
    const seen = new Set([normName(clientName)]);
    for (const raw of [input.alias, input.rawName]) {
      const name = (raw || '').trim();
      if (!name || seen.has(normName(name))) continue;
      seen.add(normName(name));
      const fail = await addAlias(payerId, name);
      if (fail) warnings.push(`הכינוי ״${name}״ לא נשמר: ${fail}`);
    }

    // charges: every remaining month of the group, or the single camp row
    const ins = await db().from('child_activity').insert(
      // a camp paid below its price is registered as מקדמה / partial right away; the amount itself is recorded with the receipt
      // price: the activity's own price, copied onto the row (null only when the activity has none)
      acts.map((a) => ({ child_id: childId, activity_id: a.id, price: a.default_price ?? null, payment_status: input.activity.startsWith('c:') && input.kind ? input.kind : 'unpaid', paid_amount: 0 })),
    );
    if (ins.error) return { ok: false, error: `הילד/ה נשמר/ה אבל יצירת החיובים נכשלה: ${ins.error.message}` };

    revalidatePath('/', 'layout');
    return { ok: true, payerId, childId, ...(warnings.length ? { warning: warnings.join(' · ') } : {}) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export type NewCustomerReceiptInput = {
  payerId: string;
  childId: string;
  childFirst: string;
  amount: number;
  date: string;
  method: PaymentMethod;
  rawName: string;
  note: string;
  reference: string;
  kind: CampPayKind | null;
  depositItem: DepositItem | null;
};

/** Stage 2: allocate the scanned payment to the new child's charges and issue the Morning receipt. */
export async function createReceiptForNewCustomer(input: NewCustomerReceiptInput): Promise<CommitResult> {
  await requireAccess();
  try {
    if (!(input.amount > 0)) return { ok: false, error: 'צריך סכום' };
    const model = await loadModel();
    const charges = allCharges(model).filter((c) => c.childId === input.childId && c.due > 0);
    const { allocations } = allocate(input.amount, charges, [input.childId]);
    const lineFor = new Map(allocations.map((a) => {
      const c = charges.find((x) => x.linkId === a.linkId)!;
      return [a.linkId, campLine(c, round2(c.paid + a.amount), c.childName, c.morningItemId, input.kind, input.depositItem)] as const;
    }));
    const receiptPayload = {
      clientId: input.payerId,
      date: input.date || todayISO(),
      method: input.method,
      amount: input.amount,
      lines: allocations.length
        ? allocations.map((a) => {
            const l = lineFor.get(a.linkId)!;
            return { description: l.description, price: a.amount, itemId: l.itemId };
          })
        : [{ description: `דמי הרשמה · ${input.childFirst.trim()}`, price: input.amount }],
      remarks: input.note || undefined,
    };
    console.log('[morning debug] createReceiptForNewCustomer → receipt:', JSON.stringify(receiptPayload, null, 2));
    const doc = await createReceipt(receiptPayload);
    console.log('[morning debug] receipt → result:', JSON.stringify(doc));
    const docRef = doc.id; // Morning document id (uuid), not its number

    for (const a of allocations) {
      const link = model.links.find((l) => l.id === a.linkId)!;
      const paid = round2(Number(link.paid_amount || 0) + a.amount);
      await db().from('child_activity').update({
        paid_amount: paid, payment_status: lineFor.get(a.linkId)!.status, invoices: [...(link.invoices || []), docRef],
      }).eq('id', a.linkId);
    }

    await db().from('payment_log').insert({
      paid_at: input.date || null, payer_id: input.payerId, raw_name: input.rawName || null,
      amount: input.amount, method: input.method, note: input.note || null, reference: input.reference || null,
      morning_document_id: doc.id, morning_document_number: doc.number, morning_document_url: doc.url,
      allocations: allocations.map((a) => ({ child_activity_id: a.linkId, amount: a.amount })),
    });

    revalidatePath('/', 'layout');
    return { ok: true, number: doc.number, url: doc.url };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export type CommitInput = {
  payerId: string;
  rawName: string;
  amount: number;
  date: string;
  method: PaymentMethod;
  note: string;
  reference: string;
  // kind/depositItem: only for a first camp payment below its price (see CampPayKind)
  allocations: { linkId: number; amount: number; kind?: CampPayKind | null; depositItem?: DepositItem | null }[];
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
      const price = Number(link.price ?? act.default_price ?? model.settings.default_full_price ?? 0);
      const before = Number(link.paid_amount || 0);
      const paid = round2(before + a.amount);
      // the deposit / partial choice only applies to the first payment on a camp
      const line = campLine({ isClass: isClass(act), price, label }, paid, childName(child), act.morning_item_id, before > 0 ? null : a.kind, a.depositItem);
      return { a, link, act, child, paid, description: line.description, itemId: line.itemId, status: line.status };
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
    const docRef = doc.id; // Morning document id (uuid), not its number

    for (const l of lines) {
      await db().from('child_activity').update({
        paid_amount: l.paid,
        payment_status: l.status,
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
      const fail = await addAlias(input.payerId, input.rawName);
      if (fail) console.log('[alias] not saved:', fail);
    }

    revalidatePath('/', 'layout');
    return { ok: true, number: doc.number, url: doc.url };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
