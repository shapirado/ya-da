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
    expect(screen.getByTestId("cell-2026-11-01").className).toMatch(/missing/);
  });

  test("marks months after the current real-world month as future/dashed", () => {
    render(
      <YearGrid
        families={[{ payerName: "משפחת פוגל", children: [sampleChildStatuses] }]}
        asOfMonth="2026-11-01"
        onRecordPayment={vi.fn()}
      />,
    );

    expect(screen.getByTestId("cell-2026-12-01").className).toMatch(/future/);
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
    expect(screen.getByTestId("cell-2026-10-01").className).toMatch(/partial/);
  });

  test("clicking a past-month cell opens the record-payment modal pre-scoped to that child/month", () => {
    render(
      <YearGrid
        families={[{ payerId: "payer-1", payerName: "משפחת פוגל", children: [sampleChildStatuses] }]}
        asOfMonth="2026-11-01"
        onRecordPayment={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId("cell-2026-11-01"));

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

    fireEvent.click(screen.getByTestId("cell-2026-12-01"));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
