import { describe, expect, test, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import RecordPaymentModal from "./RecordPaymentModal";

const childA = { id: "child-a", name: "הלל כהן" };
const childB = { id: "child-b", name: "נועה כהן" };

describe("RecordPaymentModal", () => {
  test("selecting two child/month cells and submitting builds one line per cell", () => {
    const onSubmit = vi.fn();
    render(<RecordPaymentModal payerChildren={[childA, childB]} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByTestId(`cell-${childA.id}-2026-10-01`));
    fireEvent.click(screen.getByTestId(`cell-${childB.id}-2026-11-01`));
    fireEvent.change(screen.getByLabelText(/סכום/), { target: { value: "630" } });
    fireEvent.click(screen.getByText("שמירה"));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        lines: [
          { childId: childA.id, month: "2026-10-01", amount: null },
          { childId: childB.id, month: "2026-11-01", amount: null },
        ],
        amount: 630,
      }),
    );
  });

  test("submitting without selecting any cell shows an error and does not call onSubmit", () => {
    const onSubmit = vi.fn();
    render(<RecordPaymentModal payerChildren={[childA]} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/סכום/), { target: { value: "100" } });
    fireEvent.click(screen.getByText("שמירה"));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  test("toggling a selected cell off removes it from the lines built on submit", () => {
    const onSubmit = vi.fn();
    render(<RecordPaymentModal payerChildren={[childA, childB]} onSubmit={onSubmit} />);

    const cell = screen.getByTestId(`cell-${childA.id}-2026-10-01`);
    fireEvent.click(cell);
    fireEvent.click(cell);
    fireEvent.click(screen.getByTestId(`cell-${childB.id}-2026-10-01`));
    fireEvent.change(screen.getByLabelText(/סכום/), { target: { value: "300" } });
    fireEvent.click(screen.getByText("שמירה"));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        lines: [{ childId: childB.id, month: "2026-10-01", amount: null }],
      }),
    );
  });

  test("picking a payment method chip is reflected in the submitted input", () => {
    const onSubmit = vi.fn();
    render(<RecordPaymentModal payerChildren={[childA]} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByTestId(`cell-${childA.id}-2026-10-01`));
    fireEvent.change(screen.getByLabelText(/סכום/), { target: { value: "300" } });
    fireEvent.click(screen.getByText("מזומן"));
    fireEvent.click(screen.getByText("שמירה"));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ method: "מזומן" }));
  });
});
