import { describe, expect, test, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import RecordPaymentButton from "./RecordPaymentButton";

const childA = { id: "child-a", name: "הלל כהן" };
const payer = { id: "payer-a", displayName: "כהן" };

function openModalAndFillMinimal() {
  fireEvent.click(screen.getByText("רישום תשלום ידני"));
  fireEvent.click(screen.getByTestId(`cell-${childA.id}-2026-10-01`));
  fireEvent.change(screen.getByLabelText(/סכום/), { target: { value: "300" } });
  fireEvent.click(screen.getByText("שמירה"));
}

describe("RecordPaymentButton", () => {
  test("shows an error and keeps the modal open when onRecordPayment rejects", async () => {
    const onRecordPayment = vi.fn().mockRejectedValue(new Error("boom"));
    render(
      <RecordPaymentButton
        families={[payer]}
        childrenByPayer={{ [payer.id]: [childA] }}
        onRecordPayment={onRecordPayment}
      />,
    );

    openModalAndFillMinimal();

    expect(await screen.findByText(/לא הצלחנו לשמור את התשלום/)).toBeInTheDocument();
    // modal stays open for retry
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  test("closes the modal when onRecordPayment succeeds", async () => {
    const onRecordPayment = vi.fn().mockResolvedValue(undefined);
    render(
      <RecordPaymentButton
        families={[payer]}
        childrenByPayer={{ [payer.id]: [childA] }}
        onRecordPayment={onRecordPayment}
      />,
    );

    openModalAndFillMinimal();

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
