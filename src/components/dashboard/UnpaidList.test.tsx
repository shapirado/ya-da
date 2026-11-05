import { describe, expect, test, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import UnpaidList, { type UnpaidChild } from "./UnpaidList";
import type { Child } from "@/src/lib/db/children";

function makeChild(overrides: Partial<Child> = {}): Child {
  return {
    id: "c1",
    firstName: "הלל",
    familyName: "פוגל",
    classGroupId: "g1",
    gender: "בן",
    payerId: "p1",
    enrollmentStart: "2026-09-01",
    active: true,
    ...overrides,
  };
}

function makeUnpaidChild(overrides: Partial<UnpaidChild> = {}): UnpaidChild {
  return {
    childId: "c1",
    childName: "הלל פוגל",
    months: [{ month: "2026-11-01", due: 330, paid: 0, status: "missing" }],
    fullChild: makeChild(),
    ...overrides,
  };
}

describe("UnpaidList", () => {
  test("clicking a row calls onSelectChild with that child's id", async () => {
    const onSelectChild = vi.fn();
    render(
      <UnpaidList children={[makeUnpaidChild()]} selectedChildId={null} onSelectChild={onSelectChild} />,
    );

    fireEvent.click(screen.getByText("הלל פוגל"));

    expect(onSelectChild).toHaveBeenCalledWith("c1");
  });

  test("a child with nothing owed shows a paid chip instead of an amount", () => {
    render(<UnpaidList children={[makeUnpaidChild({ months: [] })]} />);

    expect(screen.getByText("שולם")).toBeInTheDocument();
    expect(screen.queryByText(/₪/)).not.toBeInTheDocument();
  });

  test("a child who owes money shows the total amount due", () => {
    render(
      <UnpaidList
        children={[
          makeUnpaidChild({
            months: [
              { month: "2026-10-01", due: 330, paid: 0, status: "missing" },
              { month: "2026-11-01", due: 330, paid: 0, status: "missing" },
            ],
          }),
        ]}
      />,
    );

    expect(screen.getByText("660 ₪")).toBeInTheDocument();
  });

  test("renders the gender icon for the child", () => {
    const { rerender } = render(
      <UnpaidList children={[makeUnpaidChild({ fullChild: makeChild({ gender: "בת" }) })]} />,
    );
    expect(screen.getByText("♀")).toBeInTheDocument();

    rerender(<UnpaidList children={[makeUnpaidChild({ fullChild: makeChild({ gender: "בן" }) })]} />);
    expect(screen.getByText("♂")).toBeInTheDocument();
  });

  test("no WhatsApp reminder link when nothing is owed or no phone is on file", () => {
    render(<UnpaidList children={[makeUnpaidChild({ months: [] })]} />);
    expect(screen.queryByLabelText("שליחת תזכורת ב-WhatsApp")).not.toBeInTheDocument();

    render(<UnpaidList children={[makeUnpaidChild({ payerPhone: undefined })]} />);
    expect(screen.queryByLabelText("שליחת תזכורת ב-WhatsApp")).not.toBeInTheDocument();
  });

  test("shows a WhatsApp reminder link when owed and a payer phone is known", () => {
    render(
      <UnpaidList
        children={[makeUnpaidChild({ payerName: "שני פוגל", payerPhone: "0501234567" })]}
      />,
    );
    const link = screen.getByLabelText("שליחת תזכורת ב-WhatsApp");
    expect(link).toHaveAttribute("href", expect.stringContaining("https://wa.me/972501234567"));
  });
});
