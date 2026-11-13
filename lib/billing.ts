// Pure billing logic: prices, open charges, family debt and payment allocation.
// Everything here works on a plain snapshot of the tables, so it's easy to test.

import type { Activity, Child, ChildActivity, ClassGroup, Payer, Settings } from './types.ts';
import { monthLabel } from './dates.ts';

export type Model = {
  today: string; // YYYY-MM-DD (Israel)
  groups: ClassGroup[];
  activities: Activity[];
  children: Child[];
  links: ChildActivity[];
  payers: Payer[];
  settings: Settings;
};

export type Charge = {
  linkId: number;
  childId: string;
  childFirst: string;
  childName: string;
  activityId: number;
  isClass: boolean;
  label: string; // "חוג ראשון 16:00, נובמבר 2026" / "קייטנת חנוכה"
  shortLabel: string; // "ראשון 16:00" / "קייטנת חנוכה"
  month: string | null; // activity start_date
  color: string;
  price: number;
  paid: number;
  due: number;
  status: 'paid' | 'partial' | 'unpaid';
  started: boolean;
  morningItemId: string | null;
  payerId: string | null;
};

export const CLASS_TYPE = 'חוג';
export const CAMP_TYPE = 'קייטנה';

export function isClass(a: Activity): boolean {
  if (a.activity_type) return a.activity_type.trim() === CLASS_TYPE;
  return !!a.class_group_id;
}

export function groupLabel(g: ClassGroup | undefined): string {
  if (!g) return 'חוג';
  return [g.day, g.time].filter(Boolean).join(' ');
}

export function activityColor(a: Activity, groups: Map<string, ClassGroup>): string {
  const g = a.class_group_id ? groups.get(a.class_group_id) : undefined;
  return g?.color || a.color || '#5C5A66';
}

export function shortLabel(a: Activity, groups: Map<string, ClassGroup>): string {
  if (isClass(a)) return groupLabel(a.class_group_id ? groups.get(a.class_group_id) : undefined);
  return a.name || 'קייטנה';
}

export function activityLabel(a: Activity, groups: Map<string, ClassGroup>): string {
  if (isClass(a)) return `חוג ${shortLabel(a, groups)}, ${monthLabel(a.start_date)}`;
  return a.name || 'קייטנה';
}

/** child_activity.price → activities.default_price → settings.default_full_price */
export function effectivePrice(link: Pick<ChildActivity, 'price'>, a: Pick<Activity, 'default_price'>, s: Settings): number {
  if (link.price != null) return Number(link.price);
  if (a.default_price != null) return Number(a.default_price);
  return Number(s.default_full_price ?? 0);
}

export function statusFor(price: number, paid: number): 'paid' | 'partial' | 'unpaid' {
  if (paid >= price - 0.005) return 'paid';
  if (paid > 0) return 'partial';
  return 'unpaid';
}

export function paidOf(link: ChildActivity, price: number): number {
  if (link.paid_amount != null) return Number(link.paid_amount);
  return link.payment_status === 'paid' ? price : 0;
}

export function isStarted(a: Activity, today: string): boolean {
  return !a.start_date || a.start_date <= today;
}

export function childName(c: Child): string {
  return [c.first_name, c.family_name].filter(Boolean).join(' ') || 'ללא שם';
}

export function maps(m: Model) {
  return {
    groups: new Map(m.groups.map((g) => [g.id, g])),
    activities: new Map(m.activities.map((a) => [a.id, a])),
    children: new Map(m.children.map((c) => [c.id, c])),
    payers: new Map(m.payers.map((p) => [p.morning_customer_id, p])),
  };
}

/** Every child_activity row as a Charge (future ones included, flagged by `started`). */
export function allCharges(m: Model): Charge[] {
  const mp = maps(m);
  const out: Charge[] = [];
  for (const l of m.links) {
    const a = mp.activities.get(l.activity_id);
    const c = mp.children.get(l.child_id);
    if (!a || !c) continue;
    const price = effectivePrice(l, a, m.settings);
    const paid = paidOf(l, price);
    const status = l.payment_status === 'paid' ? 'paid' : statusFor(price, paid);
    out.push({
      linkId: l.id,
      childId: c.id,
      childFirst: c.first_name || '',
      childName: childName(c),
      activityId: a.id,
      isClass: isClass(a),
      label: activityLabel(a, mp.groups),
      shortLabel: shortLabel(a, mp.groups),
      month: a.start_date,
      color: activityColor(a, mp.groups),
      price,
      paid,
      due: status === 'paid' ? 0 : Math.max(0, price - paid),
      status,
      started: isStarted(a, m.today),
      morningItemId: a.morning_item_id,
      payerId: c.morning_customer_id,
    });
  }
  return out.sort((x, y) => (x.month || '').localeCompare(y.month || '') || x.childName.localeCompare(y.childName, 'he'));
}

/** Charges that are due now: started and not fully paid. Reminders only include these. */
export function openCharges(m: Model, payerId?: string): Charge[] {
  return allCharges(m).filter((c) => c.started && c.due > 0 && (payerId === undefined || c.payerId === payerId));
}

export type FamilyDebt = {
  payerId: string;
  payer: Payer | undefined;
  childFirstNames: string[];
  charges: Charge[];
  total: number;
};

export function familyDebts(m: Model): FamilyDebt[] {
  const mp = maps(m);
  const byPayer = new Map<string, Charge[]>();
  for (const c of openCharges(m)) {
    const key = c.payerId || `child:${c.childId}`;
    byPayer.set(key, [...(byPayer.get(key) || []), c]);
  }
  return [...byPayer.entries()]
    .map(([payerId, charges]) => ({
      payerId,
      payer: mp.payers.get(payerId),
      childFirstNames: [...new Set(charges.map((c) => c.childFirst))],
      charges,
      total: round2(charges.reduce((s, c) => s + c.due, 0)),
    }))
    .sort((a, b) => b.total - a.total);
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export type Allocation = { linkId: number; amount: number };

/**
 * Splits a payment across a family's open charges.
 * 1. If some set of charges adds up exactly to the amount, use it — preferring
 *    charges of children named in the note, then older months.
 * 2. Otherwise pay oldest first (named children first), partial on the last one.
 */
export function allocate(amount: number, charges: Charge[], preferChildIds: string[] = []): { allocations: Allocation[]; leftover: number } {
  const pref = new Set(preferChildIds);
  const sorted = [...charges]
    .filter((c) => c.due > 0)
    .sort((a, b) => Number(pref.has(b.childId)) - Number(pref.has(a.childId)) || (a.month || '').localeCompare(b.month || ''));

  const pool = sorted.slice(0, 14);
  let best: { mask: number; score: number } | null = null;
  const n = pool.length;
  for (let mask = 1; mask < 1 << n; mask++) {
    let sum = 0;
    let score = 0;
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) {
        sum += pool[i].due;
        score += (pref.has(pool[i].childId) ? 100 : 0) - i; // named kids first, older first
      }
    }
    if (Math.abs(sum - amount) < 0.005 && (!best || score > best.score)) best = { mask, score };
  }
  if (best) {
    const allocations = pool.filter((_, i) => best!.mask & (1 << i)).map((c) => ({ linkId: c.linkId, amount: c.due }));
    return { allocations, leftover: 0 };
  }

  let left = amount;
  const allocations: Allocation[] = [];
  for (const c of sorted) {
    if (left <= 0.005) break;
    const take = Math.min(left, c.due);
    allocations.push({ linkId: c.linkId, amount: round2(take) });
    left = round2(left - take);
  }
  return { allocations, leftover: Math.max(0, left) };
}

export function fmtMoney(n: number): string {
  return '₪' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
}
