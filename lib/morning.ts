// Morning (Green Invoice) API: customers and receipts.
// Docs: https://www.greeninvoice.co.il/api-docs

import type { PaymentMethod } from './types.ts';

const BASE = process.env.MORNING_BASE_URL || (process.env.MORNING_ENV === 'sandbox'
  ? 'https://sandbox.d.greeninvoice.co.il/api/v1'
  : 'https://api.greeninvoice.co.il/api/v1');

let cached: { token: string; exp: number } | null = null;

async function token(): Promise<string> {
  if (cached && cached.exp > Date.now()) return cached.token;
  const id = process.env.MORNING_API_KEY_ID;
  const secret = process.env.MORNING_API_SECRET;
  if (!id || !secret) throw new Error('חסרים MORNING_API_KEY_ID / MORNING_API_SECRET');
  const res = await fetch(`${BASE}/account/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, secret }),
    cache: 'no-store',
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.token) throw new Error(`Morning: התחברות נכשלה (${res.status}) ${body.errorMessage || ''}`);
  cached = { token: body.token, exp: Date.now() + 50 * 60 * 1000 };
  return body.token;
}

async function call<T>(path: string, payload: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Morning ${path}: ${body.errorMessage || res.status}`);
  return body as T;
}

/** Creates a customer and returns its id (stored as children.morning_customer_id). */
export async function createMorningClient(input: { name: string; phone?: string; email?: string }): Promise<string> {
  const body = await call<{ id: string }>('/clients', {
    name: input.name,
    emails: input.email ? [input.email] : [],
    phone: input.phone || undefined,
    mobile: input.phone || undefined,
    country: 'IL',
  });
  if (!body.id) throw new Error('Morning לא החזיר מזהה לקוח');
  return body.id;
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

export function morningConfigured(): boolean {
  return !!(process.env.MORNING_API_KEY_ID && process.env.MORNING_API_SECRET);
}
