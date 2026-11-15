// Matches the payer name read from a screenshot to a Morning customer (payer).

import type { Alias, Child, Payer } from './types.ts';

/** Lower-cases, strips niqqud/punctuation, normalises final letters and spaces. */
export function normName(s: string | number | null | undefined): string {
  if (s == null || s === '') return '';
  return String(s)
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

/** First names that differ only by a silent י/ו inside the word ("עימרי" ↔ "עמרי") count as the same name. */
const looseKey = (s: string | null | undefined): string => {
  const n = normName(s);
  return n.length > 2 ? n[0] + n.slice(1, -1).replace(/[יו]/g, '') + n.slice(-1) : n;
};
export function sameFirstName(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = looseKey(a);
  return !!x && x === looseKey(b);
}

// "ספיר אמא עימרי ואלה": what follows the word is the sender's children, not part of their own name
const PARENT_WORDS = ['אמא', 'אימא', 'אבא'];

/** Splits a sender line into the sender's own name tokens and the children named after "אמא/אבא (של)". */
export function splitSender(rawName: string): { own: string[]; kids: string[] } {
  const all = normName(rawName).split(' ').filter(Boolean);
  const at = all.findIndex((t) => PARENT_WORDS.includes(t));
  if (at < 0) return { own: all.filter((t) => t.length > 1), kids: [] };
  return { own: all.slice(0, at).filter((t) => t.length > 1), kids: all.slice(at + 1).filter((t) => t !== 'של' && t.length > 1) };
}

export type PayerMatch = {
  payerId: string;
  score: number; // 0..1
  reason: 'alias' | 'name' | 'family' | 'children' | 'sender' | 'amount';
  matchedChildIds: string[]; // children named in the note
  senderChildIds: string[]; // children named in the sender line ("… אמא עימרי ואלה")
};

/**
 * Ranks payers for a screenshot.
 * - exact alias (payer_name_aliases.raw_name) → 0.98
 * - exact payer name → 0.95
 * - shared tokens (e.g. family name) → up to 0.8
 * - children's first names appearing in the note → +0.1 each (capped)
 * - children's first names in the sender line ("ספיר אמא עימרי ואלה") → +0.5, +0.2 for each further child
 * - open debt exactly equal to the amount → +0.15
 */
export function rankPayers(input: {
  rawName: string;
  /** the sender's own name without the "אמא של…" part, when the reader separated it */
  ownName?: string;
  /** children's first names the reader found in the sender line */
  senderChildren?: string[];
  note: string;
  amount: number;
  payers: Payer[];
  aliases: Alias[];
  children: Child[];
  debtByPayer: Map<string, number>;
}): PayerMatch[] {
  const raw = normName(input.rawName);
  const split = splitSender(input.rawName);
  const own = normName(input.ownName);
  // the payer's name is compared with the sender's own name only — not with the children listed after it
  const rawTokens = own ? tokens(own) : split.own;
  const senderKids = [...(input.senderChildren || []), ...split.kids];
  // "ואלה" — a child in a list may carry the conjunction ו
  const inSender = (name: string) => senderKids.some((t) => sameFirstName(t, name) || (normName(t)[0] === 'ו' && sameFirstName(normName(t).slice(1), name)));
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
    } else if ((raw && normName(p.name) === raw) || (own && normName(p.name) === own)) {
      score = 0.95;
    } else {
      const pt = tokens(p.name || '');
      // a raw token also matches with a Hebrew prefix letter ("מעידית" ↔ "עידית")
      const hit = (t: string) => pt.includes(t) || (t.length > 2 && 'ולבהשמכ'.includes(t[0]) && pt.includes(t.slice(1)));
      const shared = rawTokens.filter(hit).length;
      if (pt.length >= 2 && shared >= pt.length) {
        score = 0.95; // every token of the payer's name is in the screenshot name
      } else if (shared) {
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
    const senderChildIds = kids.filter((k) => k.first_name && inSender(k.first_name)).map((k) => k.id);
    if (senderChildIds.length) {
      if (score === 0) reason = 'sender';
      // two children of one family in the sender line outweigh a shared first name alone (0.65)
      score += Math.min(0.7, 0.5 + 0.2 * (senderChildIds.length - 1));
    }
    const debt = input.debtByPayer.get(p.morning_customer_id) || 0;
    if (score > 0 && debt > 0 && Math.abs(debt - input.amount) < 0.005) score += 0.15;
    if (score > 0) out.push({ payerId: p.morning_customer_id, score: Math.min(1, score), reason, matchedChildIds, senderChildIds });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 5);
}
