// Matches the payer name read from a screenshot to a Morning customer (payer).

import type { Alias, Child, Payer } from './types.ts';

/** Lower-cases, strips niqqud/punctuation, normalises final letters and spaces. */
export function normName(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .normalize('NFKD')
    .replace(/[֑-ׇ]/g, '') // niqqud & cantillation
    .replace(/[ךםןףץ]/g, (ch) => ({ ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' })[ch] as string)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(s: string): string[] {
  return normName(s).split(' ').filter((t) => t.length > 1);
}

export type PayerMatch = {
  payerId: string;
  score: number; // 0..1
  reason: 'alias' | 'name' | 'family' | 'children' | 'amount';
  matchedChildIds: string[];
};

/**
 * Ranks payers for a screenshot.
 * - exact alias (payer_name_aliases.raw_name) → 0.98
 * - exact payer name → 0.95
 * - shared tokens (e.g. family name) → up to 0.8
 * - children's first names appearing in the note → +0.1 each (capped)
 * - open debt exactly equal to the amount → +0.15
 */
export function rankPayers(input: {
  rawName: string;
  note: string;
  amount: number;
  payers: Payer[];
  aliases: Alias[];
  children: Child[];
  debtByPayer: Map<string, number>;
}): PayerMatch[] {
  const raw = normName(input.rawName);
  const rawTokens = tokens(input.rawName);
  const noteTokens = tokens(input.note);
  // "ושירה", "לאיתי" — allow one Hebrew prefix letter before a name
  const mentioned = (name: string) => {
    const n = normName(name);
    return !!n && noteTokens.some((t) => t === n || (t.length === n.length + 1 && 'ולבהשמ'.includes(t[0]) && t.slice(1) === n));
  };
  const kidsByPayer = new Map<string, Child[]>();
  for (const c of input.children) {
    for (const pid of [c.morning_customer_id, c.morning_customer_id_2]) {
      if (pid) kidsByPayer.set(pid, [...(kidsByPayer.get(pid) || []), c]);
    }
  }
  const aliasPayers = new Set(input.aliases.filter((a) => raw && normName(a.raw_name) === raw).map((a) => a.payer_id));

  const out: PayerMatch[] = [];
  for (const p of input.payers) {
    let score = 0;
    let reason: PayerMatch['reason'] = 'name';
    if (aliasPayers.has(p.morning_customer_id)) {
      score = 0.98;
      reason = 'alias';
    } else if (raw && normName(p.name) === raw) {
      score = 0.95;
    } else {
      const pt = tokens(p.name || '');
      const shared = rawTokens.filter((t) => pt.includes(t)).length;
      if (shared) {
        score = Math.min(0.8, 0.45 + 0.2 * shared);
        reason = 'family';
      }
    }
    const kids = kidsByPayer.get(p.morning_customer_id) || [];
    const matchedChildIds = kids.filter((k) => k.first_name && mentioned(k.first_name)).map((k) => k.id);
    if (matchedChildIds.length) {
      if (score === 0) reason = 'children';
      score += Math.min(0.2, 0.1 * matchedChildIds.length);
    }
    const debt = input.debtByPayer.get(p.morning_customer_id) || 0;
    if (score > 0 && debt > 0 && Math.abs(debt - input.amount) < 0.005) score += 0.15;
    if (score > 0) out.push({ payerId: p.morning_customer_id, score: Math.min(1, score), reason, matchedChildIds });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 5);
}
