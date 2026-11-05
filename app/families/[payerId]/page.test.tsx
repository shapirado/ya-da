import { beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ChildWithPayer } from "@/src/lib/db/children";
import type { ReceiptLineRow } from "@/src/lib/db/receipts";

const payer = { id: "payer-1", displayName: "צפי ברנר", role: "mom", phone: null, email: null };

const data: {
  children: ChildWithPayer[];
  linesByChild: Record<string, ReceiptLineRow[]>;
} = { children: [], linesByChild: {} };

vi.mock("@/src/lib/db/payers", () => ({ listPayers: async () => [payer] }));
vi.mock("@/src/lib/db/classGroups", () => ({
  listClassGroups: async () => [{ id: "g-1", day: "שלישי", time: "16:00", color: null }],
}));
vi.mock("@/src/lib/db/children", () => ({
  listChildrenWithPayer: async () => data.children,
  listChildPrices: async (childId: string) => [
    { id: `p-${childId}`, childId, amount: 300, effectiveFrom: "2026-01-01" },
  ],
}));
vi.mock("@/src/lib/db/receipts", () => ({
  listReceiptLinesForChild: async (childId: string) => data.linesByChild[childId] ?? [],
}));
vi.mock("../actions", () => ({
  saveChild: vi.fn(),
  savePrice: vi.fn(),
  savePayer: vi.fn(),
}));

function child(id: string, firstName: string, overrides: Partial<ChildWithPayer> = {}): ChildWithPayer {
  return {
    id,
    firstName,
    familyName: "ברנר",
    classGroupId: "g-1",
    gender: "girl",
    payerId: payer.id,
    enrollmentStart: "2026-09-01",
    active: true,
    payer,
    ...overrides,
  };
}

async function renderPage() {
  const { default: FamilyDetailPage } = await import("./page");
  const element = await FamilyDetailPage({ params: Promise.resolve({ payerId: payer.id }) });
  return render(element);
}

describe("family detail page", () => {
  beforeEach(() => {
    data.children = [];
    data.linesByChild = {};
  });

  test("renders without crashing when a payment-history line has a null amount or a null month", async () => {
    data.children = [child("c-1", "עמליה")];
    data.linesByChild = {
      "c-1": [
        // multi-cell manual payment, not split yet
        { id: "l-1", receiptId: "r-1", childId: "c-1", month: "2026-09-01", amount: null, payerId: payer.id },
        // webhook line whose month didn't parse
        { id: "l-2", receiptId: "r-2", childId: "c-1", month: null, amount: 300, payerId: payer.id },
        { id: "l-3", receiptId: "r-3", childId: "c-1", month: "2026-10-01", amount: 300, payerId: payer.id },
      ],
    };

    await renderPage();

    expect(screen.getAllByText("טרם שויך")).toHaveLength(2);
    expect(screen.getByText("ספטמבר")).toBeInTheDocument();
    expect(screen.getByText(/אוקטובר/)).toBeInTheDocument();
  });
});
