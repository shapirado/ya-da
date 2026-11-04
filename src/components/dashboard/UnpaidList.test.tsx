import { describe, expect, test } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import UnpaidList from "./UnpaidList";

describe("UnpaidList", () => {
  test("cards are collapsed by default; expanding reveals one month-row per missing/partial month", () => {
    const statuses = [
      {
        childId: "c1",
        childName: "הלל",
        months: [
          { month: "2026-10-01", due: 330, paid: 0, status: "missing" as const },
          { month: "2026-11-01", due: 330, paid: 0, status: "missing" as const },
        ],
      },
    ];
    render(<UnpaidList children={statuses} />);
    expect(screen.queryByText(/סמני כשולם/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "הרחיבי" }));

    expect(screen.getAllByText(/סמני כשולם/)).toHaveLength(2);
    expect(screen.getByText("אוקטובר")).toBeInTheDocument();
    expect(screen.getByText("נובמבר")).toBeInTheDocument();
  });

  test("a fully-paid month does not get its own mark-as-paid row", () => {
    const statuses = [
      {
        childId: "c1",
        childName: "הלל",
        months: [
          { month: "2026-10-01", due: 330, paid: 330, status: "paid" as const },
          { month: "2026-11-01", due: 330, paid: 0, status: "missing" as const },
        ],
      },
    ];
    render(<UnpaidList children={statuses} />);
    fireEvent.click(screen.getByRole("button", { name: "הרחיבי" }));
    expect(screen.getAllByText(/סמני כשולם/)).toHaveLength(1);
  });
});
