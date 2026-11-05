import { describe, expect, test, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ClassesSettings from "./ClassesSettings";
import type { ClassGroupWithEnrollment, DefaultPrices } from "@/app/classes/actions";

const sampleGroups: ClassGroupWithEnrollment[] = [
  { id: "group-1", day: "שני", time: "16:00", color: "#b85a36", enrollmentCount: 3 },
  { id: "group-2", day: "רביעי", time: "17:00", color: "#8fa581", enrollmentCount: 0 },
];

const sampleDefaultPrices: DefaultPrices = { fullPrice: 300, discountPrice: 250 };

describe("ClassesSettings", () => {
  test("shows each group's derived enrollment count, not an editable field", () => {
    render(
      <ClassesSettings
        groups={sampleGroups}
        defaultPrices={sampleDefaultPrices}
        onSaveGroup={vi.fn()}
        onSaveDefaultPrices={vi.fn()}
      />,
    );
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
    // There is no input anywhere named for enrollment — it is read-only text.
    expect(screen.queryByLabelText(/נרשמ/)).not.toBeInTheDocument();
  });

  test("changing a group's day/time and saving calls onSaveGroup with the new values", () => {
    const onSaveGroup = vi.fn();
    render(
      <ClassesSettings
        groups={sampleGroups}
        defaultPrices={sampleDefaultPrices}
        onSaveGroup={onSaveGroup}
        onSaveDefaultPrices={vi.fn()}
      />,
    );
    const daySelects = screen.getAllByLabelText("יום");
    fireEvent.change(daySelects[0], { target: { value: "שלישי" } });
    const timeInputs = screen.getAllByLabelText("שעה");
    fireEvent.change(timeInputs[0], { target: { value: "17:30" } });
    const saveButtons = screen.getAllByText("שמירה");
    fireEvent.click(saveButtons[0]);

    expect(onSaveGroup).toHaveBeenCalledWith(
      "group-1",
      expect.objectContaining({ day: "שלישי", time: "17:30" }),
    );
  });

  test("picking a color swatch and saving includes the new color", () => {
    const onSaveGroup = vi.fn();
    render(
      <ClassesSettings
        groups={sampleGroups}
        defaultPrices={sampleDefaultPrices}
        onSaveGroup={onSaveGroup}
        onSaveDefaultPrices={vi.fn()}
      />,
    );
    fireEvent.click(screen.getAllByLabelText("חרדל")[0]);
    fireEvent.click(screen.getAllByText("שמירה")[0]);

    expect(onSaveGroup).toHaveBeenCalledWith(
      "group-1",
      expect.objectContaining({ color: "#e0a93a" }),
    );
  });

  test("editing default prices and saving calls onSaveDefaultPrices with the new amounts", () => {
    const onSaveDefaultPrices = vi.fn();
    render(
      <ClassesSettings
        groups={sampleGroups}
        defaultPrices={sampleDefaultPrices}
        onSaveGroup={vi.fn()}
        onSaveDefaultPrices={onSaveDefaultPrices}
      />,
    );
    fireEvent.change(screen.getByLabelText("תעריף מלא"), { target: { value: "320" } });
    fireEvent.change(screen.getByLabelText("תעריף מוזל"), { target: { value: "280" } });
    fireEvent.click(screen.getAllByText("שמירה").at(-1)!);

    expect(onSaveDefaultPrices).toHaveBeenCalledWith({ fullPrice: 320, discountPrice: 280 });
  });
});
