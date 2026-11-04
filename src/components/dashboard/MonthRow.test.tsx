import { describe, expect, test, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import MonthRow from "./MonthRow";

describe("MonthRow", () => {
  test("mark-as-paid submits the amount for its own month, not the child total", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
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
    await waitFor(() => expect(screen.getByText(/סמני כשולם/)).toBeInTheDocument());
  });

  test("blocks submit with no receipt number entered", () => {
    const onSubmit = vi.fn();
    render(<MonthRow month="2026-10-01" due={330} onMarkPaid={onSubmit} />);
    fireEvent.click(screen.getByText(/סמני כשולם/));
    fireEvent.click(screen.getByText("אישור"));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/יש להזין מספר קבלה/)).toBeInTheDocument();
  });

  test("shows an error and keeps the form open when onMarkPaid rejects", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("boom"));
    render(<MonthRow month="2026-10-01" due={330} onMarkPaid={onSubmit} />);
    fireEvent.click(screen.getByText(/סמני כשולם/));
    fireEvent.change(screen.getByPlaceholderText(/מספר קבלה/), {
      target: { value: "1570" },
    });
    fireEvent.click(screen.getByText("אישור"));

    expect(await screen.findByText(/לא הצלחנו לשמור את התשלום/)).toBeInTheDocument();
    // form stays open with the entered value, not reset
    expect(screen.getByPlaceholderText(/מספר קבלה/)).toHaveValue("1570");
  });
});
