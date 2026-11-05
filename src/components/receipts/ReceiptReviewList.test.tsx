import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import ReceiptReviewList, { evenSplit, type ReceiptReviewItem } from "./ReceiptReviewList";

const families = [{ id: "payer-1", displayName: "צפי ברנר" }];
const childrenByPayer = { "payer-1": [{ id: "child-1", name: "עמליה ברנר" }] };

function multiCellManualItem(): ReceiptReviewItem {
  return {
    receiptId: "r-1",
    rawPayload: { amount: 600 },
    totalAmount: 600,
    lines: [
      { id: "l-sep", childId: "child-1", month: "2026-09-01", amount: null },
      { id: "l-oct", childId: "child-1", month: "2026-10-01", amount: null },
    ],
  };
}

describe("evenSplit", () => {
  it("splits evenly and pushes leftover agorot onto the first lines", () => {
    expect(evenSplit(600, 2)).toEqual([300, 300]);
    expect(evenSplit(100, 3)).toEqual([33.34, 33.33, 33.33]);
    expect(evenSplit(100, 3).reduce((a, b) => a + b, 0)).toBeCloseTo(100);
    expect(evenSplit(100, 0)).toEqual([]);
  });
});

describe("ReceiptReviewList", () => {
  it("counts a multi-cell manual payment's null-amount lines as needing review", () => {
    render(
      <ReceiptReviewList
        items={[multiCellManualItem()]}
        families={families}
        childrenByPayer={childrenByPayer}
        onResolve={vi.fn()}
      />,
    );
    expect(screen.getByText(/2 שורות לא משויכות/)).toBeInTheDocument();
  });

  it("pre-fills an even, editable split of the total and resolves each line with its confirmed amount", async () => {
    const onResolve = vi.fn().mockResolvedValue(undefined);
    render(
      <ReceiptReviewList
        items={[multiCellManualItem()]}
        families={families}
        childrenByPayer={childrenByPayer}
        onResolve={onResolve}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "חלוקת הסכום" }));

    const sep = screen.getByLabelText(/עמליה ברנר · ספטמבר/) as HTMLInputElement;
    const oct = screen.getByLabelText(/עמליה ברנר · אוקטובר/) as HTMLInputElement;
    expect(sep.value).toBe("300");
    expect(oct.value).toBe("300");

    // The reviewer adjusts the default before confirming.
    fireEvent.change(sep, { target: { value: "350" } });
    fireEvent.change(oct, { target: { value: "250" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "אישור החלוקה" }));
    });

    expect(onResolve).toHaveBeenCalledTimes(2);
    expect(onResolve).toHaveBeenCalledWith(
      "l-sep",
      expect.objectContaining({ childId: "child-1", month: "2026-09-01", amount: 350 }),
    );
    expect(onResolve).toHaveBeenCalledWith(
      "l-oct",
      expect.objectContaining({ childId: "child-1", month: "2026-10-01", amount: 250 }),
    );
  });

  it("refuses to confirm a split with an empty amount", async () => {
    const onResolve = vi.fn().mockResolvedValue(undefined);
    render(
      <ReceiptReviewList
        items={[multiCellManualItem()]}
        families={families}
        childrenByPayer={childrenByPayer}
        onResolve={onResolve}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "חלוקת הסכום" }));
    fireEvent.change(screen.getByLabelText(/ספטמבר/), { target: { value: "" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "אישור החלוקה" }));
    });

    expect(onResolve).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("יש להזין סכום תקין לכל שורה");
  });

  it("a webhook line missing only its child is resolved through the family modal, keeping its amount", async () => {
    const onResolve = vi.fn().mockResolvedValue(undefined);
    render(
      <ReceiptReviewList
        items={[
          {
            receiptId: "r-2",
            rawPayload: {},
            rawPayerName: "צפי",
            lines: [{ id: "l-1", childId: null, month: "2026-10-01", amount: 300 }],
          },
        ]}
        families={families}
        childrenByPayer={childrenByPayer}
        onResolve={onResolve}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "שיוך למשפחה" }));
    fireEvent.click(screen.getByTestId("cell-child-1-2026-10-01"));
    fireEvent.change(screen.getByLabelText("סכום"), { target: { value: "300" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "שמירה" }));
    });

    expect(onResolve).toHaveBeenCalledTimes(1);
    const [lineId, input] = onResolve.mock.calls[0];
    expect(lineId).toBe("l-1");
    expect(input).toMatchObject({ payerId: "payer-1", childId: "child-1", month: "2026-10-01" });
    expect(input.amount).toBeUndefined();
  });
});
