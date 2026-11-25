// Morning (Green Invoice) API: customers and receipts.
// Docs: https://www.greeninvoice.co.il/api-docs

import type { PaymentMethod } from './types.ts';
import { MORNING_LABELS } from './flags.ts';

// One connection, always the production account. Keys: MORNING_API_KEY_ID / MORNING_API_SECRET.
const BASE = 'https://api.greeninvoice.co.il/api/v1';
// The OAuth2 token server lives on a different host than the data API.
const TOKEN_URL = 'https://api.morning.co/idp/v1/oauth/token';

let cached: { token: string; exp: number } | undefined;

function creds(): { id: string; secret: string } {
  const id = process.env.MORNING_API_KEY_ID;
  const secret = process.env.MORNING_API_SECRET;
  if (id && secret) return { id, secret };
  throw new Error('חסרים מפתחות Morning (MORNING_API_KEY_ID + MORNING_API_SECRET)');
}

async function token(): Promise<string> {
  if (cached && cached.exp > Date.now()) return cached.token;
  const { id, secret } = creds();
  const url = TOKEN_URL;
  console.log(`[morning debug] token: POST ${url} · client id ${id.slice(0, 8)}…${id.slice(-4)} (len ${id.length}) · secret len ${secret.length}`);
  // Morning moved authentication to a separate OAuth2 server (the old /account/token now returns 404).
  // Docs: developers.morning.co → Authentication → "Obtain an Access Token"
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'client_credentials', client_id: id, client_secret: secret }),
    cache: 'no-store',
  });
  const text = await res.text();
  let body: any = {};
  try { body = JSON.parse(text); } catch {}
  const tok = body.accessToken;
  // Never log the token itself — only the error body, or the shape of a good answer
  console.log(`[morning debug] token → ${res.status}:`, tok ? `accessToken (len ${tok.length}), expiresAt ${body.expiresAt}` : text.slice(0, 400) || '(גוף ריק)');
  if (!res.ok || !tok) throw new Error(`Morning: התחברות נכשלה (${res.status}) ${[body.error, body.error_description].filter(Boolean).join(' — ') || text.slice(0, 120) || 'ללא גוף תשובה'}`);
  // expiresAt is a unix timestamp in seconds (tokens live 1 hour); refresh 10 minutes early
  const exp = body.expiresAt ? Number(body.expiresAt) * 1000 - 10 * 60 * 1000 : Date.now() + 50 * 60 * 1000;
  cached = { token: tok, exp };
  return tok;
}

async function call<T>(path: string, payload: unknown): Promise<T> {
  console.log(`[morning debug] POST ${BASE}${path}:`, JSON.stringify(payload, null, 2));
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });
  const body = await res.json().catch(() => ({}));
  console.log(`[morning debug] ${path} → ${res.status}:`, JSON.stringify(body).slice(0, 800));
  if (!res.ok) throw new Error(`Morning ${path}: ${body.errorMessage || res.status}`);
  return body as T;
}

/** Morning labels (morning_labels table) — Morning takes their ids, not names. */
export const LABEL_CLASS = 'חוג אומנות';
export const LABEL_CAMP = 'קייטנה';
export const MORNING_LABEL_IDS: Record<string, string> = {
  [LABEL_CLASS]: 'd9333e4e-afc6-43aa-bb9f-a122491c0d0d',
  [LABEL_CAMP]: '628dd072-9cb4-417f-9fe4-e4fe0f6acb22',
};

/** The labels a new customer gets from the child's activities: חוג → "חוג אומנות", קייטנה → "קייטנה". */
export function activityLabels(a: { classes: boolean; camps: boolean }): string[] {
  return [a.classes ? LABEL_CLASS : '', a.camps ? LABEL_CAMP : ''].filter(Boolean);
}

/** Label names (or ids) → Morning label ids, deduped, at most 3. Unknown names are dropped (and logged). */
export function labelIds(labels: string[]): string[] {
  const ids = labels.map((l) => {
    const t = l.trim();
    if (MORNING_LABEL_IDS[t]) return MORNING_LABEL_IDS[t];
    if (/^[0-9a-f-]{36}$/i.test(t)) return t;
    if (t) console.log('[morning debug] unknown label, not sent:', t);
    return '';
  }).filter(Boolean);
  return [...new Set(ids)].slice(0, 3);
}

/** Creates a customer and returns its id (stored as children.morning_customer_id). Labels are names or ids. */
export async function createMorningClient(input: { name: string; phone?: string; email?: string; labels?: string[] }): Promise<string> {
  const body = await call<{ id: string }>('/clients', {
    name: input.name,
    emails: input.email ? [input.email] : [],
    phone: input.phone || undefined,
    mobile: input.phone || undefined,
    country: 'IL',
    ...(MORNING_LABELS && input.labels?.length && labelIds(input.labels).length ? { labels: labelIds(input.labels) } : {}),
  });
  if (!body.id) throw new Error('Morning לא החזיר מזהה לקוח');
  return body.id;
}

export type MorningClient = { id: string; name: string; phone: string; mobile: string; emails: string[]; contactPerson: string };

async function rest<T>(method: 'GET' | 'PUT', path: string, payload?: unknown): Promise<T> {
  if (payload !== undefined) console.log(`[morning debug] ${method} ${BASE}${path}:`, JSON.stringify(payload));
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` },
    body: payload !== undefined ? JSON.stringify(payload) : undefined,
    cache: 'no-store',
  });
  const body = await res.json().catch(() => ({}));
  if (method !== 'GET') console.log(`[morning debug] ${method} ${path} → ${res.status}:`, JSON.stringify(body).slice(0, 800));
  if (!res.ok) throw new Error(`Morning ${path}: ${body.errorMessage || res.status}`);
  return body as T;
}

/**
 * A customer as the child page shows it. The payer's own phone is `phone`; a second parent kept as the
 * customer's contact has `contactPerson`, `mobile` and `emails[1]`.
 */
export async function getMorningClient(id: string): Promise<MorningClient> {
  const c = await rest<any>('GET', `/clients/${id}`);
  return {
    id: String(c.id || id),
    name: c.name || '',
    phone: c.phone || '',
    mobile: c.mobile || '',
    emails: Array.isArray(c.emails) ? c.emails.filter(Boolean).map(String) : [],
    contactPerson: c.contactPerson || '',
  };
}

/** PUT /clients/{id} — only the fields sent are changed. */
export async function updateMorningClient(id: string, patch: { phone?: string; mobile?: string; emails?: string[]; contactPerson?: string }): Promise<void> {
  await rest('PUT', `/clients/${id}`, patch);
}

export type ReceiptRef = { number: string | null; url: string | null };

/** The receipts (document type MORNING_DOC_TYPE, default 320) issued to one customer, by document id. */
export async function searchClientReceipts(clientId: string): Promise<Map<string, ReceiptRef>> {
  const out = new Map<string, ReceiptRef>();
  const type = Number(process.env.MORNING_DOC_TYPE || 320);
  for (let page = 1; page <= 10; page++) {
    const body = await call<{ items?: any[]; pages?: number }>('/documents/search', { clientId, type: [type], page, pageSize: 100, sort: 'documentDate' });
    for (const d of body.items || []) {
      out.set(String(d.id), { number: d.number != null ? String(d.number) : null, url: d.url?.he || d.url?.origin || null });
    }
    if (!body.pages || page >= body.pages) break;
  }
  return out;
}

export type MorningClientHit = { id: string; name: string; phone: string; email: string; taxId: string; labels: string[] };

/**
 * Searches customers by name.
 */
export async function searchMorningClients(name: string): Promise<MorningClientHit[]> {
  const body = await call<{ items?: any[] }>('/clients/search', { name, active: true, page: 1, pageSize: 25 });
  return (body.items || []).map((c) => ({
    id: String(c.id),
    name: c.name || '',
    phone: c.mobile || c.phone || '',
    email: Array.isArray(c.emails) ? c.emails[0] || '' : '',
    taxId: c.taxId || '',
    labels: Array.isArray(c.labels) ? c.labels.map(String) : [],
  }));
}

export type MorningItemHit = { id: string; name: string; price: number | null };

/** Searches catalogue items by name. */
export async function searchMorningItems(name: string): Promise<MorningItemHit[]> {
  const body = await call<any>('/items/search', { name, page: 1, pageSize: 25 });
  const list: any[] = Array.isArray(body) ? body : body.items || [];
  return list.filter((i) => i?.id).map((i) => ({
    id: String(i.id),
    name: i.name || i.description || '',
    price: i.price != null ? Number(i.price) : null,
  }));
}

// Payment row types in Morning: 1 cash, 3 credit card, 4 bank transfer, 10 payment app, 11 other.
// For type 10 Morning expects an app type. Verify these two codes against the
// API docs for your account before going live (Bit / PayBox).
const APP_TYPE: Record<string, number> = { bit: 1, paybox: 3 };

function paymentRow(method: PaymentMethod, price: number, date: string) {
  const base = { price, currency: 'ILS', date };
  switch (method) {
    case 'bit':
    case 'paybox':
      return { ...base, type: 10, appType: APP_TYPE[method] };
    case 'bank':
      return { ...base, type: 4 };
    case 'cash':
      return { ...base, type: 1 };
    case 'credit':
      return { ...base, type: 3 };
    default:
      return { ...base, type: 11 };
  }
}

export type IncomeLine = { description: string; price: number; itemId?: string | null };

export type MorningDocument = { id: string; number: string | null; url: string | null };

/** Issues a receipt / tax invoice-receipt (MORNING_DOC_TYPE, default 320). */
export async function createReceipt(input: {
  clientId: string;
  date: string; // YYYY-MM-DD
  method: PaymentMethod;
  amount: number;
  lines: IncomeLine[];
  remarks?: string;
}): Promise<MorningDocument> {
  const type = Number(process.env.MORNING_DOC_TYPE || 320);
  const body = await call<any>('/documents', {
    type,
    date: input.date,
    lang: 'he',
    currency: 'ILS',
    vatType: 0,
    rounding: false,
    signed: true,
    client: { id: input.clientId },
    income: input.lines.map((l) => ({
      description: l.description,
      quantity: 1,
      price: l.price,
      currency: 'ILS',
      vatType: 1, // prices parents pay include VAT
      ...(l.itemId ? { itemId: l.itemId } : {}),
    })),
    payment: [paymentRow(input.method, input.amount, input.date)],
    remarks: input.remarks,
  });
  return {
    id: String(body.id),
    number: body.number != null ? String(body.number) : null,
    url: body.url?.he || body.url?.origin || (typeof body.url === 'string' ? body.url : null),
  };
}

export type MorningDocInfo = {
  id: string;
  number: string | null;
  date: string | null; // YYYY-MM-DD
  clientName: string | null;
  amount: number | null;
  url: string | null;
  ok: boolean; // false when Morning didn't return the document
};

/** Fetches one document's details (number, date, client, amount, link). */
export async function fetchDocument(id: string): Promise<MorningDocInfo> {
  const miss: MorningDocInfo = { id, number: null, date: null, clientName: null, amount: null, url: null, ok: false };
  // let auth failures throw so the UI can tell them apart from a missing document
  const auth = await token();
  console.log("fetchDocument.InvoiceString="+id)
  try {
    const res = await fetch(`${BASE}/documents/${id}`, {
      headers: { Authorization: `Bearer ${auth}` },
      cache: 'no-store',
    });
    const b = await res.json().catch(() => ({}));
    if (!res.ok) return miss;
    return {
      id,
      number: b.number != null ? String(b.number) : null,
      date: b.documentDate || b.date || null,
      clientName: b.client?.name || null,
      amount: b.amount ?? b.total ?? null,
      url: b.url?.he || b.url?.origin || (typeof b.url === 'string' ? b.url : null),
      ok: true,
    };
  } catch {
    return miss;
  }
}

export type MorningTestResult = {
  tokenSource: string; // where the bearer token came from
  url: string;
  status: number | null; // null when the request never got an HTTP response
  body: string; // raw response (pretty-printed when JSON), or the error message
};

/**
 * Diagnostic: searches customers and returns the raw response.
 * Uses MORNING_ACCESS_TOKEN when set, otherwise requests a fresh token with the API keys.
 */
export async function testMorningConnection(): Promise<MorningTestResult> {
  const url = `${BASE}/clients/search`;
  let auth = process.env.MORNING_ACCESS_TOKEN;
  let tokenSource = 'MORNING_ACCESS_TOKEN';
  if (!auth) {
    tokenSource = TOKEN_URL;
    cached = undefined; // always exercise the token request in a test
    try {
      auth = await token();
    } catch (e) {
      return { tokenSource, url, status: null, body: `שלב קבלת הטוקן נכשל: ${(e as Error).message}` };
    }
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'ברבי', active: true, page: 1, pageSize: 25 }),
      cache: 'no-store',
    });
    const text = await res.text();
    console.log(`[morning debug] test /clients/search → ${res.status}:`, text.slice(0, 800) || '(גוף ריק)');
    let body = text || '(גוף ריק)';
    try { body = JSON.stringify(JSON.parse(text), null, 2); } catch {}
    return { tokenSource, url, status: res.status, body };
  } catch (e) {
    const err = e as Error & { cause?: { code?: string; message?: string } };
    return { tokenSource, url, status: null, body: `הבקשה לא הגיעה ל-Morning: ${err.message}${err.cause ? ` (${err.cause.code || err.cause.message})` : ''}` };
  }
}

export function morningConfigured(): boolean {
  return !!(process.env.MORNING_API_KEY_ID && process.env.MORNING_API_SECRET);
}
