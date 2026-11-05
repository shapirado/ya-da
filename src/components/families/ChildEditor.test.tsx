import { describe, expect, test, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ChildEditor from "./ChildEditor";
import type { Child } from "@/src/lib/db/children";
import type { ClassGroup } from "@/src/lib/db/classGroups";

const sampleChild: Child = {
  id: "child-1",
  firstName: "הלל",
  familyName: "פרידמן",
  classGroupId: "group-1",
  gender: "בן",
  payerId: "payer-1",
  enrollmentStart: "2026-09-01",
  active: true,
};

const sampleGroups: ClassGroup[] = [
  { id: "group-1", day: "שני", time: "16:00", color: "terracotta" },
  { id: "group-2", day: "רביעי", time: "17:00", color: "sage" },
];

function setDatePickerValue(input: HTMLElement, ddmmyyyy: string) {
  fireEvent.change(input, { target: { value: ddmmyyyy } });
  fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
}

describe("ChildEditor", () => {
  test("shows the currently effective price read-only", () => {
    render(
      <ChildEditor
        child={sampleChild}
        groups={sampleGroups}
        currentPrice={330}
        onUpdateChild={vi.fn()}
        onSetPrice={vi.fn()}
      />,
    );
    expect(screen.getByText(/תעריף נוכחי/)).toHaveTextContent("330");
  });

  test("changing the class group select calls onUpdateChild with the new group id", async () => {
    const onUpdateChild = vi.fn();
    render(
      <ChildEditor
        child={sampleChild}
        groups={sampleGroups}
        currentPrice={null}
        onUpdateChild={onUpdateChild}
        onSetPrice={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText(/חוג/), { target: { value: "group-2" } });
    fireEvent.click(screen.getByText("שמירה"));
    expect(onUpdateChild).toHaveBeenCalledWith(
      sampleChild.id,
      expect.objectContaining({ classGroupId: "group-2" }),
    );
  });

  test("setting a new rate with an effective-from month calls onSetPrice, not an overwrite", async () => {
    const onSetPrice = vi.fn();
    render(
      <ChildEditor
        child={sampleChild}
        groups={sampleGroups}
        currentPrice={null}
        onUpdateChild={vi.fn()}
        onSetPrice={onSetPrice}
      />,
    );
    fireEvent.change(screen.getByLabelText(/תעריף חדש/), { target: { value: "330" } });
    setDatePickerValue(screen.getByLabelText(/החל מ/), "01/01/2027");
    fireEvent.click(screen.getByText("שמירה"));
    expect(onSetPrice).toHaveBeenCalledWith(sampleChild.id, { amount: 330, effectiveFrom: "2027-01-01" });
  });

  test("an effective-from date mid-month is normalized to the 1st of that month", async () => {
    const onSetPrice = vi.fn();
    render(
      <ChildEditor
        child={sampleChild}
        groups={sampleGroups}
        currentPrice={null}
        onUpdateChild={vi.fn()}
        onSetPrice={onSetPrice}
      />,
    );
    fireEvent.change(screen.getByLabelText(/תעריף חדש/), { target: { value: "330" } });
    setDatePickerValue(screen.getByLabelText(/החל מ/), "15/01/2027");
    fireEvent.click(screen.getByText("שמירה"));
    expect(onSetPrice).toHaveBeenCalledWith(sampleChild.id, { amount: 330, effectiveFrom: "2027-01-01" });
  });
});
