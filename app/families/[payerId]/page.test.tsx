import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ChildWithPayer } from "@/src/lib/db/children";
import type { ReceiptLineRow } from "@/src/lib/db/receipts";

const payer: {
  id: string;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  phone: string | null;
  email: string | null;
} = {
  id: "payer-1",
  displayName: "צפי ברנר",
  firstName: "צפי",
  lastName: "ברנר",
  role: "mom",
  phone: null,
  email: null,
};

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
    payer.phone = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("renders without crashing when a payment-history line has a null amount or a null month", async () => {
    data.children = [child("c-1", "עמליה")];
    data.linesByChild = {
      "c-1": [
        // multi-cell manual payment, not split yet
        {
          id: "l-1",
          receiptId: "r-1",
          childId: "c-1",
          month: "2026-09-01",
          amount: null,
          externalDocNumber: null,
          receivedAt: null,
          transactionDate: null,
        },
        // webhook line whose month didn't parse
        {
          id: "l-2",
          receiptId: "r-2",
          childId: "c-1",
          month: null,
          amount: 300,
          externalDocNumber: null,
          receivedAt: null,
          transactionDate: null,
        },
        {
          id: "l-3",
          receiptId: "r-3",
          childId: "c-1",
          month: "2026-10-01",
          amount: 300,
          externalDocNumber: null,
          receivedAt: null,
          transactionDate: null,
        },
      ],
    };

    await renderPage();

    expect(screen.getAllByText("טרם שויך")).toHaveLength(2);
    expect(screen.getByText("ספטמבר")).toBeInTheDocument();
    expect(screen.getByText(/אוקטובר/)).toBeInTheDocument();
  });

  test("the WhatsApp reminder only covers active children; inactive ones still get an editor", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-15T12:00:00"));
    payer.phone = "0521234567";
    data.children = [
      child("c-active", "עמליה"),
      child("c-inactive", "יואב", { active: false }),
    ];
    // Neither child has paid anything since enrollment (2026-09-01): each
    // owes Sep-Nov at 300 = 900.

    const { container } = await renderPage();

    const link = container.querySelector('a[href*="wa.me"]') as HTMLAnchorElement;
    expect(link).toBeTruthy();
    const message = decodeURIComponent(link.href.split("text=")[1] ?? "");
    expect(message).toContain("עמליה");
    expect(message).not.toContain("יואב");
    expect(message).toContain(`${(900).toLocaleString("he-IL")} ₪`);
    expect(message).not.toContain(`${(1800).toLocaleString("he-IL")} ₪`);

    // Both children still appear in the editor section.
    expect(screen.getByDisplayValue("עמליה")).toBeInTheDocument();
    expect(screen.getByDisplayValue("יואב")).toBeInTheDocument();
  });
});
