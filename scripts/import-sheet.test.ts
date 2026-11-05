import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  assertSafeToImport,
  findUnmatchedBalanceRows,
  parseBalanceSheet,
  parseRoster,
  getDistinctClassCombos,
  planClassGroupAssignments,
  type RosterRow,
} from "./import-sheet";

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
    expect(result.length).toBe(7);
    expect(result.map((r) => r.firstName)).toEqual([
      "אוריה",
      "גלי",
      "נועה",
      "איתי",
      "יובל",
      "דנה",
      "רון",
    ]);
  });

  test("two consecutive blank family-name rows both inherit the nearest name above", async () => {
    const result = await parseRoster(readFixture("roster.csv"));
    // fixture: row 6 "יובל,מזרחי,...", rows 7-8 "דנה,,..." / "רון,,..." (both blank)
    const dana = result.find((r) => r.firstName === "דנה");
    const ron = result.find((r) => r.firstName === "רון");
    expect(dana?.familyName).toBe("מזרחי");
    expect(dana?.familyNameInferred).toBe(true);
    expect(ron?.familyName).toBe("מזרחי");
    expect(ron?.familyNameInferred).toBe(true);
  });
});

describe("planClassGroupAssignments", () => {
  function makeRoster(combos: Array<[string, string]>): RosterRow[] {
    return combos.map(([classDay, classTime]) => ({
      firstName: "x",
      familyName: "y",
      familyNameInferred: false,
      classDay,
      classTime,
      gender: "",
    }));
  }

  test("pairs each distinct combo with a placeholder group when there are enough", () => {
    const roster = makeRoster([
      ["שלישי", "16:00"],
      ["רביעי", "17:30"],
    ]);
    const combos = getDistinctClassCombos(roster);
    const existingGroups = [{ id: "g1" }, { id: "g2" }, { id: "g3" }, { id: "g4" }];

    const plan = planClassGroupAssignments(combos, existingGroups);

    expect(plan.get("שלישי|16:00")).toEqual({ groupId: "g1", day: "שלישי", time: "16:00" });
    expect(plan.get("רביעי|17:30")).toEqual({ groupId: "g2", day: "רביעי", time: "17:30" });
  });

  test("throws, rather than silently reusing a group, when the roster has more distinct day/time combinations than there are placeholder groups", () => {
    // 5 distinct combinations, only 4 placeholder class_groups rows available.
    const roster = makeRoster([
      ["שני", "15:00"],
      ["שני", "16:00"],
      ["שלישי", "16:00"],
      ["רביעי", "17:30"],
      ["חמישי", "18:00"],
    ]);
    const combos = getDistinctClassCombos(roster);
    const existingGroups = [{ id: "g1" }, { id: "g2" }, { id: "g3" }, { id: "g4" }];

    expect(() => planClassGroupAssignments(combos, existingGroups)).toThrow(
      /5 distinct day\/time combinations.*only 4 placeholder/,
    );
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

describe("assertSafeToImport", () => {
  test("allows an import into an empty database", () => {
    expect(() => assertSafeToImport({ payers: 0, children: 0 })).not.toThrow();
  });

  test("refuses when payers or children already exist (a re-run would duplicate them)", () => {
    expect(() => assertSafeToImport({ payers: 3, children: 0 })).toThrow(/Refusing to import/);
    expect(() => assertSafeToImport({ payers: 0, children: 5 })).toThrow(/Refusing to import/);
  });
});

describe("findUnmatchedBalanceRows", () => {
  test("returns only balance rows that match no roster child", async () => {
    const roster = await parseRoster(readFixture("roster.csv"));
    const balance = await parseBalanceSheet(
      `${readFixture("balance-oct.csv")}שירה,אלון,שולם,1099\n`,
      "2026-10-01",
    );

    const unmatched = findUnmatchedBalanceRows(roster, balance);
    expect(unmatched).toEqual([
      { firstName: "שירה", familyName: "אלון", status: "שולם", receiptNumber: "1099", month: "2026-10-01" },
    ]);
  });

  test("the fixture balance sheets fully match the fixture roster", async () => {
    const roster = await parseRoster(readFixture("roster.csv"));
    const balance = await parseBalanceSheet(readFixture("balance-oct.csv"), "2026-10-01");
    expect(findUnmatchedBalanceRows(roster, balance)).toEqual([]);
  });
});
