import { getSupabaseClient } from "./client";

export type ReceiptStatus = "matched" | "needs_review";
export type ReceiptSource = "manual" | "morning_webhook";

export type Receipt = {
  id: string;
  externalDocNumber: string | null;
  receivedAt: string | null;
  source: ReceiptSource;
  rawPayload: unknown;
  status: ReceiptStatus;
};

export type ReceiptLine = {
  id: string;
  receiptId: string;
  childId: string | null;
  month: string | null;
  amount: number;
  payerId: string | null;
};

export type ReceiptWithLines = Receipt & {
  lines: ReceiptLine[];
};

export type ReceiptLineRow = {
  id: string;
  receiptId: string;
  childId: string | null;
  month: string;
  amount: number;
  payerId: string | null;
};

type ReceiptRow = {
  id: string;
  external_doc_number: string | null;
  received_at: string | null;
  source: ReceiptSource;
  raw_payload: unknown;
  status: ReceiptStatus;
};

type ReceiptLineDbRow = {
  id: string;
  receipt_id: string;
  child_id: string | null;
  month: string | null;
  amount: number;
  payer_id: string | null;
};

function mapReceipt(row: ReceiptRow): Receipt {
  return {
    id: row.id,
    externalDocNumber: row.external_doc_number,
    receivedAt: row.received_at,
    source: row.source,
    rawPayload: row.raw_payload,
    status: row.status,
  };
}

function mapReceiptLine(row: ReceiptLineDbRow): ReceiptLine {
  return {
    id: row.id,
    receiptId: row.receipt_id,
    childId: row.child_id,
    month: row.month,
    amount: row.amount,
    payerId: row.payer_id,
  };
}

function computeStatus(
  lines: Array<{ childId?: string; month?: string }>,
): ReceiptStatus {
  const anyUnresolved = lines.some((line) => !line.childId || !line.month);
  return anyUnresolved ? "needs_review" : "matched";
}

export async function createReceipt(input: {
  source: ReceiptSource;
  rawPayload?: unknown;
  lines: Array<{ childId?: string; month?: string; amount: number; payerId?: string }>;
}): Promise<Receipt> {
  const status = computeStatus(input.lines);
  const client = getSupabaseClient();

  const { data: receiptData, error: receiptError } = await client
    .from("receipts")
    .insert({
      source: input.source,
      raw_payload: input.rawPayload ?? null,
      status,
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
        payer_id: line.payerId ?? null,
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

export async function resolveReceiptLine(
  lineId: string,
  input: { childId: string; month: string },
): Promise<ReceiptLine> {
  const client = getSupabaseClient();

  const { data: updatedLineData, error: updateError } = await client
    .from("receipt_lines")
    .update({ child_id: input.childId, month: input.month })
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
      childId: row.child_id ?? undefined,
      month: row.month ?? undefined,
    })),
  );

  const { error: receiptUpdateError } = await client
    .from("receipts")
    .update({ status })
    .eq("id", updatedLine.receiptId);
  if (receiptUpdateError) throw receiptUpdateError;

  return updatedLine;
}

export async function listReceiptLinesForChild(childId: string): Promise<ReceiptLineRow[]> {
  const { data, error } = await getSupabaseClient()
    .from("receipt_lines")
    .select("*")
    .eq("child_id", childId);
  if (error) throw error;
  return (data as ReceiptLineDbRow[]).map((row) => ({
    id: row.id,
    receiptId: row.receipt_id,
    childId: row.child_id,
    month: row.month as string,
    amount: row.amount,
    payerId: row.payer_id,
  }));
}
