import { createHmac, timingSafeEqual } from "crypto";
import { listChildrenWithPayer } from "./db/children";
import { findPayerByNameOrAlias, updatePayer } from "./db/payers";

// --- Morning webhook topics / document types -------------------------------

export const DOCUMENT_CREATED_TOPIC = "document/created";
export const CLIENT_CREATED_TOPIC = "client/created";

// Morning document type code for חשבונית מס / קבלה (a tax invoice/receipt).
export const RECEIPT_DOCUMENT_TYPE = 320;

// --- Payload shapes (per Morning's documented webhook schema) --------------

export type MorningDocumentItem = {
  description: string; // Hebrew month name, e.g. "אוקטובר"
  sku?: string;
  price: number;
  quantity?: number;
};

export type MorningDocumentPayload = {
  type: number;
  recipient?: { name?: string };
  items?: MorningDocumentItem[];
  date?: string; // YYYY-MM-DD
  createdAt?: string;
  total?: number;
};

export type MorningClientPayload = {
  name?: string;
  phone?: string;
  mobile?: string;
  emails?: string[];
};

// --- Hebrew month name -> "01".."12" ----------------------------------------

const HEBREW_MONTH_NUMBERS: Record<string, string> = {
  ינואר: "01",
  פברואר: "02",
  מרץ: "03",
  אפריל: "04",
  מאי: "05",
  יוני: "06",
  יולי: "07",
  אוגוסט: "08",
  ספטמבר: "09",
  אוקטובר: "10",
  נובמבר: "11",
  דצמבר: "12",
};

export function hebrewMonthNameToNumber(name: string): string | null {
  return HEBREW_MONTH_NUMBERS[name.trim()] ?? null;
}

// --- recipient.name "<payer> (<child>)" parsing -----------------------------

export function parseRecipientName(
  recipientName: string,
): { payerName: string; childName: string } | null {
  const match = recipientName.trim().match(/^(.+?)\s*\(([^()]+)\)\s*$/);
  if (!match) return null;
  const [, payerName, childName] = match;
  return { payerName: payerName.trim(), childName: childName.trim() };
}

// --- Signature verification -------------------------------------------------

// Verifies the HMAC-SHA256 hex signature over the RAW request body bytes.
// When no secret is configured (MORNING_WEBHOOK_SECRET unset — the webhook
// isn't registered in Morning yet), verification is skipped rather than
// rejecting every delivery; the route then treats the delivery as
// unauthenticated and never auto-matches it (see the webhook route).
export function verifyMorningSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  secret: string | undefined,
): boolean {
  if (!secret) return true;
  if (!signatureHeader) return false;

  const expectedHex = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const expected = Buffer.from(expectedHex, "utf8");
  const actual = Buffer.from(signatureHeader, "utf8");
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

// --- document/created -> receipt lines --------------------------------------

// The document's own year and month, from its date (falling back to
// createdAt, then today).
function documentYearMonth(payload: MorningDocumentPayload): { year: number; month: number } {
  const dateStr = payload.date ?? payload.createdAt ?? "";
  const match = dateStr.match(/^(\d{4})-(\d{2})/);
  if (match) return { year: Number(match[1]), month: Number(match[2]) };
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

// Each item only carries a Hebrew month name, never its own year. Assume
// the item month is the one nearest the document's own month: more than 6
// months after it means the previous year (a January 2027 receipt for
// "דצמבר" is December 2026), more than 6 months before it means the next
// year (a December 2026 receipt for "ינואר" is January 2027).
export function inferItemMonth(
  document: { year: number; month: number },
  itemMonthNumber: string,
): string {
  const itemMonth = Number(itemMonthNumber);
  const diff = itemMonth - document.month;
  const year = diff > 6 ? document.year - 1 : diff < -6 ? document.year + 1 : document.year;
  return `${year}-${itemMonthNumber}-01`;
}

export type ResolvedReceiptLine = {
  month?: string;
  amount: number;
  childId?: string;
  payerId?: string;
};

export async function resolveDocumentCreatedLines(
  payload: MorningDocumentPayload,
): Promise<{ lines: ResolvedReceiptLine[] }> {
  const parsedRecipient = parseRecipientName(payload.recipient?.name ?? "");
  const documentDate = documentYearMonth(payload);

  let payerId: string | undefined;
  let childId: string | undefined;

  if (parsedRecipient) {
    const payer = await findPayerByNameOrAlias(parsedRecipient.payerName);
    if (payer) {
      payerId = payer.id;
      const children = await listChildrenWithPayer();
      const matches = children.filter(
        (child) => child.payerId === payer.id && child.firstName.trim() === parsedRecipient.childName,
      );
      // Exactly one match resolves the child; zero or more-than-one (ambiguous
      // child name) leaves childId unset so computeStatus falls back to
      // needs_review, per the task brief's amendment.
      if (matches.length === 1) childId = matches[0].id;
    }
  }

  const lines: ResolvedReceiptLine[] = (payload.items ?? []).map((item) => {
    const monthNumber = hebrewMonthNameToNumber(item.description);
    return {
      month: monthNumber ? inferItemMonth(documentDate, monthNumber) : undefined,
      amount: item.price * (item.quantity ?? 1),
      childId,
      payerId,
    };
  });

  return { lines };
}

// --- client/created -> payer contact fill-in --------------------------------

// Pure decision: what (if anything) to write to an existing payer's
// phone/email given a client/created payload. Conservative by design: prefer
// mobile over phone, take the first email, and never overwrite a value the
// payer already has (first write wins — a convenience fill, not a sync).
export function computeContactUpdate(
  payload: MorningClientPayload,
  existing: { phone: string | null; email: string | null },
): { phone?: string; email?: string } | null {
  const update: { phone?: string; email?: string } = {};

  const incomingPhone = payload.mobile || payload.phone;
  if (incomingPhone && !existing.phone) {
    update.phone = incomingPhone;
  }

  const incomingEmail = payload.emails?.[0];
  if (incomingEmail && !existing.email) {
    update.email = incomingEmail;
  }

  return Object.keys(update).length > 0 ? update : null;
}

export async function processClientCreated(payload: MorningClientPayload): Promise<void> {
  const name = payload.name;
  if (!name) return;

  const payer = await findPayerByNameOrAlias(name);
  if (!payer) {
    // Not every Morning client is one of Dalia's payers — no match is a
    // quiet no-op, never an auto-create.
    console.log(`[morning webhook] client/created: no payer match for "${name}"`);
    return;
  }

  const update = computeContactUpdate(payload, { phone: payer.phone, email: payer.email });
  if (!update) return;

  await updatePayer(payer.id, update);
}
