import { NextResponse } from "next/server";
import { createReceipt } from "@/src/lib/db/receipts";
import {
  CLIENT_CREATED_TOPIC,
  DOCUMENT_CREATED_TOPIC,
  RECEIPT_DOCUMENT_TYPE,
  processClientCreated,
  resolveDocumentCreatedLines,
  verifyMorningSignature,
  type MorningClientPayload,
  type MorningDocumentPayload,
} from "@/src/lib/morning";

const ACK = () => NextResponse.json({ ok: true }, { status: 200 });

async function storeForReview(rawPayload: unknown): Promise<void> {
  await createReceipt({ source: "morning_webhook", rawPayload, lines: [] });
}

// Morning disables a webhook after 15 consecutive non-2xx deliveries, so
// this handler always acknowledges with 200 — even for payloads it can't
// parse, signatures it can't verify, or topics it doesn't handle — and
// never throws past this function.
export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text();
  const signatureHeader = request.headers.get("x-webhook-signature");
  const topic = request.headers.get("x-webhook-topic");
  const secret = process.env.MORNING_WEBHOOK_SECRET;

  if (!secret) {
    console.log(
      "[morning webhook] MORNING_WEBHOOK_SECRET not set; delivery is unauthenticated, storing for review without auto-matching",
    );
  }

  try {
    // Signature verification happens over the raw bytes, before any
    // processing (including JSON.parse) — an invalid/missing signature
    // (when a secret is configured) stores the raw, unprocessed body for
    // review rather than trusting and parsing it.
    if (!verifyMorningSignature(rawBody, signatureHeader, secret)) {
      console.warn("[morning webhook] missing or invalid signature; storing raw body for review");
      await storeForReview(rawBody);
      return ACK();
    }

    let parsed: unknown;
    let parseFailed = false;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      parseFailed = true;
    }

    if (parseFailed) {
      await storeForReview(rawBody);
      return ACK();
    }

    try {
      if (topic === DOCUMENT_CREATED_TOPIC) {
        const payload = parsed as MorningDocumentPayload;
        if (!payload || typeof payload !== "object" || payload.type !== RECEIPT_DOCUMENT_TYPE) {
          // Not a receipt (or malformed) — keep it for review rather than
          // guessing.
          await storeForReview(parsed);
          return ACK();
        }

        const { lines } = await resolveDocumentCreatedLines(payload);
        // Without a configured secret nothing proves this delivery came from
        // Morning (the path is guessable), so never auto-match it: drop the
        // resolved payer/child so the receipt lands in needs_review and its
        // lines can't count toward any child's paid months until a human
        // assigns them. Month and amount are kept to speed up that review.
        const storedLines = secret
          ? lines
          : lines.map((line) => ({ month: line.month, amount: line.amount }));
        await createReceipt({ source: "morning_webhook", rawPayload: parsed, lines: storedLines });
        return ACK();
      }

      if (topic === CLIENT_CREATED_TOPIC) {
        // Same reasoning as above: an unauthenticated delivery must not
        // write contact details onto a real payer.
        if (secret) await processClientCreated(parsed as MorningClientPayload);
        return ACK();
      }

      // Unknown/unhandled topic: acknowledge and ignore.
      return ACK();
    } catch (processingError) {
      console.error(
        "[morning webhook] failed to process a parsed payload; storing for review",
        processingError,
      );
      await storeForReview(parsed);
      return ACK();
    }
  } catch (error) {
    console.error("[morning webhook] unexpected error handling delivery", error);
    return ACK();
  }
}
