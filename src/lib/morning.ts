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
// rejecting every delivery.
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

function documentYear(payload: MorningDocumentPayload): string {
  const dateStr = payload.date ?? payload.createdAt ?? "";
  const match = dateStr.match(/^(\d{4})-/);
  // Each item only carries a Hebrew month name, never its own date, so every
  // item is assumed to fall within the document's own year. (Simplifying
  // assumption per the task brief: a December document covering an
  // "upcoming January" line would need special-casing this doesn't attempt.)
  return match ? match[1] : String(new Date().getFullYear());
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
  const year = documentYear(payload);

  let payerId: string | undefined;
  let childId: string | undefined;

  if (parsedRecipient) {
    const payer = await findPayerByNameOrAlias(parsedRecipient.payerName);
    if (payer) {
      payerId = payer.id;
      const children = await listChildrenWithPayer();
      const match = children.find(
        (child) => child.payerId === payer.id && child.firstName.trim() === parsedRecipient.childName,
      );
      if (match) childId = match.id;
    }
  }

  const lines: ResolvedReceiptLine[] = (payload.items ?? []).map((item) => {
    const monthNumber = hebrewMonthNameToNumber(item.description);
    return {
      month: monthNumber ? `${year}-${monthNumber}-01` : undefined,
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
