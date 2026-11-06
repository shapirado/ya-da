// One-time import of the studio's roster and October/November 2026 payment
// history from a Google Sheet export into the hosted Supabase project.
//
// Decision (see task-13-brief.md): import from local CSV exports of the
// four sheet tabs, not a live Google Sheets API call. Before running this
// for real, export the following tabs to CSV and place them at:
//   scripts/data/roster.csv       <- "רשימת תלמידים"
//   scripts/data/balance-oct.csv  <- "מאזן אוקטובר 2026"
//   scripts/data/balance-nov.csv  <- "מאזן נובמבר 2026"
// ("חשבוניות" is not currently consumed by this script — the balance tabs'
// receipt-number column is sufficient to record a matched manual receipt.)
//
// Run with: npx tsx scripts/import-sheet.ts

import { config } from "dotenv";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { createPayer } from "../src/lib/db/payers";
import { createChild, setChildPrice } from "../src/lib/db/children";
import { listClassGroups, updateClassGroup, type ClassGroup } from "../src/lib/db/classGroups";
import { createReceipt } from "../src/lib/db/receipts";
import { getSupabaseClient } from "../src/lib/db/client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

config({ path: path.join(repoRoot, ".env.local"), quiet: true });

const DEFAULT_PRICE = 300;

// ---------------------------------------------------------------------------
// CSV parsing
// ---------------------------------------------------------------------------

// Minimal RFC4180-ish CSV parser: splits rows on newlines and fields on
// commas, honoring double-quoted fields (so a quoted field may itself
// contain commas or escaped `""` quotes). Good enough for a Google Sheets
// CSV export; this is a one-time script, not a general-purpose CSV library.
function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const text = content.replace(/\r\n/g, "\n");

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  // Trailing field/row (file may or may not end with a newline).
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim().length > 0));
}

// ---------------------------------------------------------------------------
// Roster
// ---------------------------------------------------------------------------

export type RosterRow = {
  firstName: string;
  familyName: string;
  // True when this row's family name was blank in the sheet and was
  // attributed to the payer from the row above (the sheet's convention for
  // siblings listed consecutively). Surfaced in main()'s summary so the
  // user can confirm each inference.
  familyNameInferred: boolean;
  classDay: string;
  classTime: string;
  gender: string;
};

export async function parseRoster(csv: string): Promise<RosterRow[]> {
  const rows = parseCsv(csv);
  const [, ...dataRows] = rows; // drop header

  let lastFamilyName = "";
  const result: RosterRow[] = [];

  for (const cells of dataRows) {
    const [firstNameRaw, familyNameRaw, dayAndTimeRaw, genderRaw] = cells;
    const firstName = (firstNameRaw ?? "").trim();
    const familyNameCell = (familyNameRaw ?? "").trim();
    const dayAndTime = (dayAndTimeRaw ?? "").trim();
    const gender = (genderRaw ?? "").trim();

    const familyNameInferred = familyNameCell === "";
    const familyName = familyNameInferred ? lastFamilyName : familyNameCell;
    lastFamilyName = familyName;

    const [classDay, ...timeParts] = dayAndTime.split(" ");
    const classTime = timeParts.join(" ").trim();

    result.push({
      firstName,
      familyName,
      familyNameInferred,
      classDay: (classDay ?? "").trim(),
      classTime,
      gender,
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Balance sheet
// ---------------------------------------------------------------------------

export type BalanceStatus = "שולם" | "טרם";

export type BalanceRow = {
  firstName: string;
  familyName: string;
  status: BalanceStatus;
  // Present only on paid ("שולם") rows that carried a קבלה reference in
  // the sheet.
  receiptNumber: string | undefined;
  month: string; // 'YYYY-MM-01'
};

export async function parseBalanceSheet(csv: string, month: string): Promise<BalanceRow[]> {
  const rows = parseCsv(csv);
  const [, ...dataRows] = rows; // drop header

  const result: BalanceRow[] = [];

  for (const cells of dataRows) {
    const [firstNameRaw, familyNameRaw, statusRaw, receiptRaw] = cells;
    const firstName = (firstNameRaw ?? "").trim();
    const familyName = (familyNameRaw ?? "").trim();
    const statusCell = (statusRaw ?? "").trim();
    const receiptCell = (receiptRaw ?? "").trim();

    const status: BalanceStatus = statusCell === "שולם" ? "שולם" : "טרם";
    const receiptNumber = status === "שולם" && receiptCell !== "" ? receiptCell : undefined;

    result.push({ firstName, familyName, status, receiptNumber, month });
  }

  return result;
}

// ---------------------------------------------------------------------------
// main() — the real import. NOT invoked by the test suite; only runs when
// this file is executed directly (`npx tsx scripts/import-sheet.ts`).
// ---------------------------------------------------------------------------

type ImportedBalanceCell = { child: RosterRow; row: BalanceRow };

function readDataFile(fileName: string): string {
  const filePath = path.join(repoRoot, "scripts", "data", fileName);
  if (!existsSync(filePath)) {
    throw new Error(
      `Missing ${filePath}. Export the matching Google Sheet tab to CSV and place it there before running this script.`,
    );
  }
  return readFileSync(filePath, "utf8");
}

function sameChild(a: { firstName: string; familyName: string }, b: { firstName: string; familyName: string }) {
  return a.firstName === b.firstName && a.familyName === b.familyName;
}

// Returns the distinct (day, time) combinations found in the roster, in
// first-seen order.
export function getDistinctClassCombos(roster: RosterRow[]): string[] {
  const distinctCombos: string[] = [];
  for (const child of roster) {
    const key = `${child.classDay}|${child.classTime}`;
    if (!distinctCombos.includes(key)) distinctCombos.push(key);
  }
  return distinctCombos;
}

export type ClassGroupAssignment = { groupId: string; day: string; time: string };

// Pure planning step: pairs each distinct (day, time) combination with one
// of the existing placeholder class_groups rows (seeded by an earlier
// task), to be updated in place rather than inserting a duplicate row.
//
// This is a one-time migration script, and resolveClassGroups() is called
// before main() makes any createPayer/createChild/createReceipt call. If
// the roster has more distinct combinations than there are placeholder
// groups to assign them to, we cannot pick a correct group for the
// overflow combinations — silently reusing one would write a wrong
// class_group foreign key for some children. So this throws instead of
// falling back, aborting the whole import before any database writes
// happen, rather than risk a partially-correct import.
export function planClassGroupAssignments(
  distinctCombos: string[],
  existingGroups: Pick<ClassGroup, "id">[],
): Map<string, ClassGroupAssignment> {
  if (distinctCombos.length > existingGroups.length) {
    throw new Error(
      `[import-sheet] Roster has ${distinctCombos.length} distinct day/time combinations ` +
        `but only ${existingGroups.length} placeholder class_groups rows exist to assign them to. ` +
        `Add more placeholder class_groups rows (or fix the roster data) before importing — ` +
        `aborting without writing anything.`,
    );
  }

  const plan = new Map<string, ClassGroupAssignment>();
  distinctCombos.forEach((key, i) => {
    const [day, time] = key.split("|");
    plan.set(key, { groupId: existingGroups[i].id, day, time });
  });
  return plan;
}

// Pre-flight guard: this is a one-shot import into production data. If any
// payers or children already exist, it has most likely run before — a
// second run would duplicate every family — so refuse before writing.
export function assertSafeToImport(counts: { payers: number; children: number }): void {
  if (counts.payers > 0 || counts.children > 0) {
    throw new Error(
      `[import-sheet] Refusing to import: the database already has ${counts.payers} payers and ` +
        `${counts.children} children. This script is a one-time import into an empty database ` +
        `(re-running it would duplicate every family) — aborting without writing anything.`,
    );
  }
}

async function countRows(table: "payers" | "children"): Promise<number> {
  const { count, error } = await getSupabaseClient()
    .from(table)
    .select("id", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

// Balance-sheet rows whose (first name, family name) match no roster child.
// These can't be imported (there's no child to attach them to), so main()
// lists them rather than dropping them silently.
export function findUnmatchedBalanceRows(roster: RosterRow[], balanceRows: BalanceRow[]): BalanceRow[] {
  return balanceRows.filter((row) => !roster.some((child) => sameChild(row, child)));
}

async function resolveClassGroups(
  roster: RosterRow[],
): Promise<Map<string, string>> {
  const existingGroups = await listClassGroups();
  const distinctCombos = getDistinctClassCombos(roster);
  // Throws before any write if the roster can't be mapped onto the
  // existing placeholder groups — see planClassGroupAssignments().
  const plan = planClassGroupAssignments(distinctCombos, existingGroups);

  const comboToGroupId = new Map<string, string>();
  for (const [key, { groupId, day, time }] of plan) {
    const updated = await updateClassGroup(groupId, { day, time });
    comboToGroupId.set(key, updated.id);
  }

  return comboToGroupId;
}

export async function main(): Promise<void> {
  const roster = await parseRoster(readDataFile("roster.csv"));
  const balanceOct = await parseBalanceSheet(readDataFile("balance-oct.csv"), "2026-10-01");
  const balanceNov = await parseBalanceSheet(readDataFile("balance-nov.csv"), "2026-11-01");
  const allBalanceRows = [...balanceOct, ...balanceNov];

  // Before ANY write (resolveClassGroups below already updates rows).
  assertSafeToImport({ payers: await countRows("payers"), children: await countRows("children") });

  const unmatchedBalanceRows = findUnmatchedBalanceRows(roster, allBalanceRows);

  const comboToGroupId = await resolveClassGroups(roster);

  const payerIdByFamilyName = new Map<string, string>();
  let payersCreated = 0;
  let childrenCreated = 0;
  let receiptsCreated = 0;
  const flaggedInferredRows: RosterRow[] = [];

  for (const child of roster) {
    if (child.familyNameInferred) flaggedInferredRows.push(child);

    let payerId = payerIdByFamilyName.get(child.familyName);
    if (!payerId) {
      // The sheet doesn't say whether the payer is mom or dad: leave the
      // role unspecified (null) for the user to set in the families page.
      const payer = await createPayer({ displayName: child.familyName, role: null });
      payerId = payer.id;
      payerIdByFamilyName.set(child.familyName, payerId);
      payersCreated++;
    }

    const cellsForChild: ImportedBalanceCell[] = allBalanceRows
      .filter((row) => sameChild(row, child))
      .map((row) => ({ child, row }));

    const earliestMonth =
      cellsForChild.map((c) => c.row.month).sort()[0] ?? "2026-11-01";

    const groupKey = `${child.classDay}|${child.classTime}`;
    const classGroupId = comboToGroupId.get(groupKey) ?? "";

    const createdChild = await createChild({
      firstName: child.firstName,
      familyName: child.familyName,
      classGroupId,
      gender: child.gender,
      payerId,
      enrollmentStart: earliestMonth,
    });
    childrenCreated++;

    await setChildPrice(createdChild.id, { amount: DEFAULT_PRICE, effectiveFrom: earliestMonth });

    for (const { row } of cellsForChild) {
      if (row.status !== "שולם") continue;
      await createReceipt({
        source: "manual",
        payerId,
        rawPayload: { receiptNumber: row.receiptNumber },
        lines: [{ childId: createdChild.id, month: row.month, amount: DEFAULT_PRICE }],
      });
      receiptsCreated++;
    }
  }

  console.log("Import complete:");
  console.log(`  payers created:   ${payersCreated}`);
  console.log(`  children created: ${childrenCreated}`);
  console.log(`  receipts created: ${receiptsCreated}`);
  console.log(`  all children defaulted to the ${DEFAULT_PRICE} discount price — correct any that should be full price.`);
  if (unmatchedBalanceRows.length > 0) {
    console.log(
      `  ${unmatchedBalanceRows.length} balance-sheet rows matched no roster child and were NOT imported:`,
    );
    for (const row of unmatchedBalanceRows) {
      const receipt = row.receiptNumber ? `, קבלה ${row.receiptNumber}` : "";
      console.log(
        `    - "${row.firstName}" "${row.familyName}" (${row.month.slice(0, 7)}, ${row.status}${receipt})`,
      );
    }
  }
  if (flaggedInferredRows.length > 0) {
    console.log("  family names inferred from the row above (please confirm):");
    for (const row of flaggedInferredRows) {
      console.log(`    - ${row.firstName} -> ${row.familyName}`);
    }
  }
}

if (process.argv[1] === __filename) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
