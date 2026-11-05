"use client";

import { useState } from "react";
import type { Child, ChildInput } from "@/src/lib/db/children";
import type { ClassGroup } from "@/src/lib/db/classGroups";
import SaveButton from "../SaveButton";

export type ChildEditorProps = {
  child: Child;
  groups: ClassGroup[];
  onUpdateChild: (id: string, input: Partial<ChildInput>) => void | Promise<void>;
  onSetPrice: (childId: string, input: { amount: number; effectiveFrom: string }) => void | Promise<void>;
};

export function groupLabel(group: ClassGroup): string {
  return [group.day, group.time].filter(Boolean).join(" ") || group.id;
}

// priceForMonth compares effective-from dates against 'YYYY-MM-01', so a
// price always takes effect from the 1st of the month picked, whatever day
// was chosen in the date input (e.g. 2027-01-15 -> 2027-01-01).
export function firstOfMonth(date: string): string | null {
  const match = date.trim().match(/^(\d{4})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-01` : null;
}

export const GENDER_OPTIONS: Array<{ value: string; label: string; icon: string }> = [
  { value: "בן", label: "ילד", icon: "♂" },
  { value: "בת", label: "ילדה", icon: "♀" },
];

export default function ChildEditor({ child, groups, onUpdateChild, onSetPrice }: ChildEditorProps) {
  const [firstName, setFirstName] = useState(child.firstName);
  const [classGroupId, setClassGroupId] = useState(child.classGroupId ?? "");
  const [gender, setGender] = useState(child.gender ?? "");
  const [active, setActive] = useState(child.active);
  const [amount, setAmount] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");

  async function handleSave() {
    const update: Partial<ChildInput> = {};
    if (firstName !== child.firstName) update.firstName = firstName;
    if (classGroupId !== (child.classGroupId ?? "")) update.classGroupId = classGroupId;
    if (gender !== (child.gender ?? "")) update.gender = gender;
    if (active !== child.active) update.active = active;

    if (Object.keys(update).length > 0) {
      await onUpdateChild(child.id, update);
    }

    const trimmedAmount = amount.trim();
    const effectiveMonth = firstOfMonth(effectiveFrom);
    if (trimmedAmount !== "" && effectiveMonth !== null) {
      await onSetPrice(child.id, {
        amount: Number(trimmedAmount),
        effectiveFrom: effectiveMonth,
      });
      setAmount("");
      setEffectiveFrom("");
    }
  }

  return (
    <div className="yd-card yd-pad yd-stack yd-child-editor">
      <div className="yd-row">
        <div className="yd-field" style={{ flex: 1 }}>
          <label htmlFor={`child-name-${child.id}`}>שם הילד/ה</label>
          <input
            id={`child-name-${child.id}`}
            className="yd-input"
            type="text"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
          />
        </div>

        <div className="yd-field" style={{ flex: 1 }}>
          <label htmlFor={`child-group-${child.id}`}>חוג</label>
          <select
            id={`child-group-${child.id}`}
            className="yd-input"
            value={classGroupId}
            onChange={(event) => setClassGroupId(event.target.value)}
          >
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {groupLabel(group)}
              </option>
            ))}
          </select>
        </div>

        <div className="yd-field" style={{ flex: "0 0 auto" }}>
          <label>מגדר</label>
          <div className="yd-row" role="group" aria-label="מגדר" style={{ gap: 4 }}>
            {GENDER_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-label={option.label}
                aria-pressed={gender === option.value}
                className={`yd-btn icon ghost${gender === option.value ? " active" : ""}`}
                onClick={() => setGender(option.value)}
              >
                {option.icon}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="yd-row">
        <div className="yd-field" style={{ flex: 1 }}>
          <label htmlFor={`child-amount-${child.id}`}>תעריף חודשי</label>
          <input
            id={`child-amount-${child.id}`}
            className="yd-input"
            type="number"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="סכום חדש"
          />
        </div>

        <div className="yd-field" style={{ flex: 1 }}>
          <label htmlFor={`child-effective-${child.id}`}>החל מ</label>
          <input
            id={`child-effective-${child.id}`}
            className="yd-input"
            type="date"
            value={effectiveFrom}
            onChange={(event) => setEffectiveFrom(event.target.value)}
          />
        </div>
      </div>

      <div className="yd-row" style={{ justifyContent: "space-between" }}>
        <label className="yd-row" style={{ gap: 8 }}>
          <button
            type="button"
            className={`yd-toggle${active ? " on" : ""}`}
            role="switch"
            aria-checked={active}
            aria-label="פעיל/ה"
            onClick={() => setActive((value) => !value)}
          />
          <span className="small muted">פעיל/ה</span>
        </label>

        <SaveButton onSave={handleSave} />
      </div>
    </div>
  );
}
