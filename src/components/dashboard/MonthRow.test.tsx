import { describe, expect, test, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import MonthRow from "./MonthRow";

describe("MonthRow", () => {
  test("mark-as-paid submits the amount for its own month, not the child total", () => {
    const onSubmit = vi.fn();
    render(<MonthRow month="2026-10-01" due={330} onMarkPaid={onSubmit} />);
    fireEvent.click(screen.getByText(/סמני כשולם/));
    fireEvent.change(screen.getByPlaceholderText(/מספר קבלה/), {
      target: { value: "1570" },
    });
    fireEvent.click(screen.getByText("אישור"));
    expect(onSubmit).toHaveBeenCalledWith({
      month: "2026-10-01",
      amount: 330,
      receiptNumber: "1570",
      method: expect.any(String),
    });
  });

  test("blocks submit with no receipt number entered", () => {
    const onSubmit = vi.fn();
    render(<MonthRow month="2026-10-01" due={330} onMarkPaid={onSubmit} />);
    fireEvent.click(screen.getByText(/סמני כשולם/));
    fireEvent.click(screen.getByText("אישור"));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/יש להזין מספר קבלה/)).toBeInTheDocument();
  });
});
