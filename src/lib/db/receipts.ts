import { getSupabaseClient } from "./client";

export type ReceiptStatus = "matched" | "needs_review";
export type ReceiptSource = "manual" | "morning_webhook";

export type Receipt = {
  id: string;
  externalDocNumber: string | null;
  receivedAt: string | null;
  // DB-assigned (default now()), always set — the reliable "when did this
  // row land in our system" timestamp, unlike receivedAt which app code
  // must set itself and can be null on older rows.
  createdAt: string | null;
  // The actual payment date ('YYYY-MM-DD'), as Morning's webhook reports it
  // (transactions[0].date) — can differ from the document's own issue date.
  transactionDate: string | null;
  source: ReceiptSource;
  rawPayload: unknown;
  status: ReceiptStatus;
  method: string | null;
  // One payer per receipt — every line on a receipt always belongs to the
  // same payer, so it lives here rather than duplicated per line.
  payerId: string | null;
};

export type ReceiptLine = {
  id: string;
  receiptId: string;
  childId: string | null;
  month: string | null;
  // null until a multi-cell payment's amount has been split per line.
  amount: number | null;
};

export type ReceiptWithLines = Receipt & {
  lines: ReceiptLine[];
};

export type ReceiptLineRow = {
  id: string;
  receiptId: string;
  childId: string | null;
  // Either may still be null on a not-yet-resolved line: an unmatched
  // webhook item has no month; a multi-cell manual payment's lines have no
  // per-line amount until it is split in the review queue.
  month: string | null;
  amount: number | null;
  // Joined from the parent receipt, for display (e.g. the dashboard's
  // payments tab / payment-history list) without a second query per line.
  externalDocNumber: string | null;
  receivedAt: string | null;
  transactionDate: string | null;
};

type ReceiptRow = {
  id: string;
  external_doc_number: string | null;
  received_at: string | null;
  created_at: string | null;
  transaction_date: string | null;
  source: ReceiptSource;
  raw_payload: unknown;
  status: ReceiptStatus;
  method: string | null;
  payer_id: string | null;
};

type ReceiptLineDbRow = {
  id: string;
  receipt_id: string;
  child_id: string | null;
  month: string | null;
  amount: number | null;
};

function mapReceipt(row: ReceiptRow): Receipt {
  return {
    id: row.id,
    externalDocNumber: row.external_doc_number,
    receivedAt: row.received_at,
    createdAt: row.created_at,
    transactionDate: row.transaction_date,
    source: row.source,
    rawPayload: row.raw_payload,
    status: row.status,
    method: row.method,
    payerId: row.payer_id,
  };
}

function mapReceiptLine(row: ReceiptLineDbRow): ReceiptLine {
  return {
    id: row.id,
    receiptId: row.receipt_id,
    childId: row.child_id,
    month: row.month,
    amount: row.amount,
  };
}

// A line is resolved only once it has a child, a month AND an amount. A
// multi-cell manual payment's lines have child/month but a null amount
// (the whole-receipt total isn't auto-split) — those still need review.
export function isLineUnresolved(line: {
  childId?: string | null;
  month?: string | null;
  amount?: number | null;
}): boolean {
  return !line.childId || !line.month || line.amount === null || line.amount === undefined;
}

function computeStatus(
  lines: Array<{ childId?: string | null; month?: string | null; amount?: number | null }>,
): ReceiptStatus {
  // A receipt with no resolved lines at all (e.g. a payload we couldn't
  // parse, or a webhook delivery we rejected/skipped processing for) stays
  // needs_review rather than vacuously "matched".
  if (lines.length === 0) return "needs_review";
  return lines.some(isLineUnresolved) ? "needs_review" : "matched";
}

export async function createReceipt(input: {
  source: ReceiptSource;
  rawPayload?: unknown;
  method?: string;
  payerId?: string;
  externalDocNumber?: string;
  // The actual payment date ('YYYY-MM-DD'), when known (e.g. Morning's
  // transactions[0].date) — distinct from when we received/processed it.
  transactionDate?: string;
  // amount may be null for a line whose receipt covers multiple
  // child/month cells: the whole-receipt amount is not auto-split across
  // them, so each line's amount stays unset until a human resolves it.
  lines: Array<{ childId?: string; month?: string; amount: number | null }>;
}): Promise<Receipt> {
  const status = computeStatus(input.lines);
  const client = getSupabaseClient();

  const { data: receiptData, error: receiptError } = await client
    .from("receipts")
    .insert({
      source: input.source,
      raw_payload: input.rawPayload ?? null,
      method: input.method ?? null,
      payer_id: input.payerId ?? null,
      external_doc_number: input.externalDocNumber ?? null,
      transaction_date: input.transactionDate ?? null,
      status,
      received_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (receiptError) throw receiptError;
  const receipt = mapReceipt(receiptData as ReceiptRow);

  if (input.lines.length > 0) {
    const { error: linesError } = await client.from("receipt_lines").insert(
      input.lines.map((line) => ({
        receipt_id: receipt.id,
        child_id: line.childId ?? null,
        month: line.month ?? null,
        amount: line.amount,
      })),
    );
    if (linesError) throw linesError;
  }

  return receipt;
}

export async function listNeedsReviewReceipts(): Promise<ReceiptWithLines[]> {
  const { data, error } = await getSupabaseClient()
    .from("receipts")
    .select("*, receipt_lines(*)")
    .eq("status", "needs_review");
  if (error) throw error;

  return (data as unknown as Array<ReceiptRow & { receipt_lines: ReceiptLineDbRow[] }>).map(
    (row) => ({
      ...mapReceipt(row),
      lines: row.receipt_lines.map(mapReceiptLine),
    }),
  );
}

// Every receipt regardless of status, newest-created first. created_at is
// DB-assigned (default now()) and always set, unlike received_at which app
// code must set itself.
export async function listAllReceipts(): Promise<ReceiptWithLines[]> {
  const { data, error } = await getSupabaseClient()
    .from("receipts")
    .select("*, receipt_lines(*)")
    .order("created_at", { ascending: false, nullsFirst: false });
  if (error) throw error;

  return (data as unknown as Array<ReceiptRow & { receipt_lines: ReceiptLineDbRow[] }>).map(
    (row) => ({
      ...mapReceipt(row),
      lines: row.receipt_lines.map(mapReceiptLine),
    }),
  );
}

// Assigns a line its child/month and, optionally, its amount. `amount` is
// what the reviewer entered/confirmed for this line (e.g. their split of a
// multi-cell payment's total); when omitted the line keeps whatever amount
// it already has. `payerId`, when given, is written onto the receipt itself
// (the whole receipt's payer, not a per-line field).
export async function resolveReceiptLine(
  lineId: string,
  input: { childId: string; month: string; amount?: number; payerId?: string },
): Promise<ReceiptLine> {
  const client = getSupabaseClient();

  const update: { child_id: string; month: string; amount?: number } = {
    child_id: input.childId,
    month: input.month,
  };
  if (input.amount !== undefined) update.amount = input.amount;

  const { data: updatedLineData, error: updateError } = await client
    .from("receipt_lines")
    .update(update)
    .eq("id", lineId)
    .select()
    .single();
  if (updateError) throw updateError;
  const updatedLine = mapReceiptLine(updatedLineData as ReceiptLineDbRow);

  const { data: siblingLines, error: siblingsError } = await client
    .from("receipt_lines")
    .select("*")
    .eq("receipt_id", updatedLine.receiptId);
  if (siblingsError) throw siblingsError;

  const status = computeStatus(
    (siblingLines as ReceiptLineDbRow[]).map((row) => ({
      childId: row.child_id,
      month: row.month,
      amount: row.amount,
    })),
  );

  const receiptUpdate: { status: ReceiptStatus; payer_id?: string } = { status };
  if (input.payerId !== undefined) receiptUpdate.payer_id = input.payerId;

  const { error: receiptUpdateError } = await client
    .from("receipts")
    .update(receiptUpdate)
    .eq("id", updatedLine.receiptId);
  if (receiptUpdateError) throw receiptUpdateError;

  return updatedLine;
}

// Clears a needs_review receipt that has no lines at all (a delivery whose
// signature failed, that couldn't be parsed, wasn't a type-320 document, or
// errored mid-processing) — there is nothing on it to resolve, so the only
// possible action is "handled". It is marked matched: with zero lines it
// contributes nothing to any child's paid months, and matched receipts are
// already excluded from the review queue. The raw payload is kept.
export async function dismissEmptyReceipt(receiptId: string): Promise<void> {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from("receipts")
    .select("id, status, receipt_lines(id)")
    .eq("id", receiptId)
    .single();
  if (error) throw error;
  const row = data as unknown as { status: ReceiptStatus; receipt_lines: Array<{ id: string }> };
  if (row.status !== "needs_review") {
    throw new Error(`Receipt ${receiptId} is not awaiting review`);
  }
  if (row.receipt_lines.length > 0) {
    throw new Error(`Receipt ${receiptId} has lines; resolve them instead of dismissing`);
  }

  const { error: updateError } = await client
    .from("receipts")
    .update({ status: "matched" })
    .eq("id", receiptId)
    .eq("status", "needs_review");
  if (updateError) throw updateError;
}

export async function listReceiptLinesForChild(childId: string): Promise<ReceiptLineRow[]> {
  const { data, error } = await getSupabaseClient()
    .from("receipt_lines")
    .select("*, receipts(external_doc_number, received_at, transaction_date)")
    .eq("child_id", childId);
  if (error) throw error;
  return (
    data as unknown as Array<
      ReceiptLineDbRow & {
        receipts: {
          external_doc_number: string | null;
          received_at: string | null;
          transaction_date: string | null;
        } | null;
      }
    >
  ).map((row) => ({
    id: row.id,
    receiptId: row.receipt_id,
    childId: row.child_id,
    month: row.month,
    amount: row.amount,
    externalDocNumber: row.receipts?.external_doc_number ?? null,
    receivedAt: row.receipts?.received_at ?? null,
    transactionDate: row.receipts?.transaction_date ?? null,
  }));
}
