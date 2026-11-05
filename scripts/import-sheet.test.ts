import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseBalanceSheet, parseRoster } from "./import-sheet";

function readFixture(name: string): string {
  return readFileSync(path.join(__dirname, "fixtures", name), "utf8");
}

describe("parseRoster", () => {
  test("a blank family-name row is attributed to the payer from the row above", async () => {
    const result = await parseRoster(readFixture("roster.csv"));
    // fixture: row 2 "אוריה,פוגל,...", row 3 "גלי,,..." (blank family name)
    expect(result[1].familyName).toBe("פוגל");
  });

  test("flags the inferred row so it can be surfaced for confirmation", async () => {
    const result = await parseRoster(readFixture("roster.csv"));
    expect(result[0].familyNameInferred).toBe(false);
    expect(result[1].familyNameInferred).toBe(true);
  });

  test("splits the combined day+time column", async () => {
    const result = await parseRoster(readFixture("roster.csv"));
    expect(result[0].classDay).toBe("שלישי");
    expect(result[0].classTime).toBe("16:00");
  });

  test("parses every non-header row", async () => {
    const result = await parseRoster(readFixture("roster.csv"));
    expect(result.length).toBe(5);
    expect(result.map((r) => r.firstName)).toEqual(["אוריה", "גלי", "נועה", "איתי", "יובל"]);
  });
});

describe("parseBalanceSheet", () => {
  test("a balance-tab paid cell with a receipt number creates a matched receipt line", async () => {
    const result = await parseBalanceSheet(readFixture("balance-nov.csv"), "2026-11-01");
    const paidRow = result.find((r) => r.status === "שולם");
    expect(paidRow?.receiptNumber).toBeDefined();
  });

  test("an unpaid cell has no receipt number", async () => {
    const result = await parseBalanceSheet(readFixture("balance-nov.csv"), "2026-11-01");
    const unpaidRow = result.find((r) => r.status === "טרם");
    expect(unpaidRow?.receiptNumber).toBeUndefined();
  });

  test("tags every row with the given month", async () => {
    const result = await parseBalanceSheet(readFixture("balance-nov.csv"), "2026-11-01");
    expect(result.every((r) => r.month === "2026-11-01")).toBe(true);
  });

  test("matches rows by first name and family name", async () => {
    const result = await parseBalanceSheet(readFixture("balance-nov.csv"), "2026-11-01");
    const row = result.find((r) => r.firstName === "אוריה");
    expect(row?.familyName).toBe("פוגל");
    expect(row?.receiptNumber).toBe("1042");
  });
});
