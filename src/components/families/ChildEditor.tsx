"use client";

import { useState } from "react";
import type { Child, ChildInput } from "@/src/lib/db/children";
import type { ClassGroup } from "@/src/lib/db/classGroups";

export type ChildEditorProps = {
  child: Child;
  groups: ClassGroup[];
  onUpdateChild: (id: string, input: Partial<ChildInput>) => void | Promise<void>;
  onSetPrice: (childId: string, input: { amount: number; effectiveFrom: string }) => void | Promise<void>;
};

function groupLabel(group: ClassGroup): string {
  return [group.day, group.time].filter(Boolean).join(" ") || group.id;
}

export default function ChildEditor({ child, groups, onUpdateChild, onSetPrice }: ChildEditorProps) {
  const [firstName, setFirstName] = useState(child.firstName);
  const [classGroupId, setClassGroupId] = useState(child.classGroupId ?? "");
  const [active, setActive] = useState(child.active);
  const [amount, setAmount] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");

  function handleSave() {
    const update: Partial<ChildInput> = {};
    if (firstName !== child.firstName) update.firstName = firstName;
    if (classGroupId !== (child.classGroupId ?? "")) update.classGroupId = classGroupId;

    if (Object.keys(update).length > 0) {
      onUpdateChild(child.id, update);
    }

    const trimmedAmount = amount.trim();
    if (trimmedAmount !== "" && effectiveFrom.trim() !== "") {
      onSetPrice(child.id, {
        amount: Number(trimmedAmount),
        effectiveFrom: effectiveFrom.trim(),
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

        <button type="button" className="yd-btn primary sm" onClick={handleSave}>
          שמירה
        </button>
      </div>
    </div>
  );
}
