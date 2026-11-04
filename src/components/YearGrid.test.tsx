import { describe, expect, test, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import YearGrid, { type YearChildStatuses } from "./YearGrid";

const sampleChildStatuses: YearChildStatuses = {
  childId: "child-1",
  childName: "נועה פוגל",
  statuses: [
    { month: "2026-09-01", due: 500, paid: 500, status: "paid" },
    { month: "2026-10-01", due: 500, paid: 200, status: "partial" },
    { month: "2026-11-01", due: 500, paid: 0, status: "missing" },
  ],
};

describe("YearGrid", () => {
  test("renders one row per family and a status class per month cell", () => {
    render(
      <YearGrid
        families={[{ payerName: "משפחת פוגל", children: [sampleChildStatuses] }]}
        asOfMonth="2026-11-01"
        onRecordPayment={vi.fn()}
      />,
    );

    expect(screen.getByText("משפחת פוגל")).toBeInTheDocument();
    expect(screen.getByTestId("cell-family-0-2026-11-01").className).toMatch(/missing/);
  });

  test("marks months after the current real-world month as future/dashed", () => {
    render(
      <YearGrid
        families={[{ payerName: "משפחת פוגל", children: [sampleChildStatuses] }]}
        asOfMonth="2026-11-01"
        onRecordPayment={vi.fn()}
      />,
    );

    expect(screen.getByTestId("cell-family-0-2026-12-01").className).toMatch(/future/);
  });

  test("current month column is marked for underline styling", () => {
    render(
      <YearGrid
        families={[{ payerName: "משפחת פוגל", children: [sampleChildStatuses] }]}
        asOfMonth="2026-11-01"
        onRecordPayment={vi.fn()}
      />,
    );

    expect(screen.getByTestId("month-head-2026-11-01").className).toMatch(/cur/);
  });

  test("uses the worst status across a family's children for a given month", () => {
    const secondChild: YearChildStatuses = {
      childId: "child-2",
      childName: "איתן פוגל",
      statuses: [{ month: "2026-10-01", due: 500, paid: 500, status: "paid" }],
    };
    render(
      <YearGrid
        families={[{ payerName: "משפחת פוגל", children: [sampleChildStatuses, secondChild] }]}
        asOfMonth="2026-11-01"
        onRecordPayment={vi.fn()}
      />,
    );

    // child-1 is "partial" that month, child-2 is "paid" -> worst wins
    expect(screen.getByTestId("cell-family-0-2026-10-01").className).toMatch(/partial/);
  });

  test("clicking a past-month cell opens the record-payment modal pre-scoped to that child/month", () => {
    render(
      <YearGrid
        families={[{ payerId: "payer-1", payerName: "משפחת פוגל", children: [sampleChildStatuses] }]}
        asOfMonth="2026-11-01"
        onRecordPayment={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId("cell-payer-1-2026-11-01"));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByTestId(`cell-${sampleChildStatuses.childId}-2026-11-01`)).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("clicking a future-month cell does not open the modal", () => {
    render(
      <YearGrid
        families={[{ payerName: "משפחת פוגל", children: [sampleChildStatuses] }]}
        asOfMonth="2026-11-01"
        onRecordPayment={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId("cell-family-0-2026-12-01"));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  test("a month at/before asOfMonth with no due data for any child renders non-interactive, not missing, and does not open the modal", () => {
    render(
      <YearGrid
        families={[{ payerName: "משפחת פוגל", children: [sampleChildStatuses] }]}
        asOfMonth="2026-12-01"
        onRecordPayment={vi.fn()}
      />,
    );

    // sampleChildStatuses has no entry for 2026-12-01 (not yet enrolled that
    // month), and it's not in the future relative to asOfMonth either.
    const cell = screen.getByTestId("cell-family-0-2026-12-01");
    expect(cell.className).toMatch(/future/);
    expect(cell.className).not.toMatch(/missing|partial|paid/);
    expect(cell).toBeDisabled();

    fireEvent.click(cell);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  test("cell testids are scoped per family so two families' cells for the same month don't collide", () => {
    const familyTwoChild: YearChildStatuses = {
      childId: "child-3",
      childName: "דנה כהן",
      statuses: [{ month: "2026-11-01", due: 500, paid: 0, status: "missing" }],
    };
    render(
      <YearGrid
        families={[
          { payerId: "payer-1", payerName: "משפחת פוגל", children: [sampleChildStatuses] },
          { payerId: "payer-2", payerName: "משפחת כהן", children: [familyTwoChild] },
        ]}
        asOfMonth="2026-11-01"
        onRecordPayment={vi.fn()}
      />,
    );

    const cellOne = screen.getByTestId("cell-payer-1-2026-11-01");
    const cellTwo = screen.getByTestId("cell-payer-2-2026-11-01");
    expect(cellOne).not.toBe(cellTwo);
  });
});
