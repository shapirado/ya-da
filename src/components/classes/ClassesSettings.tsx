"use client";

import { useState } from "react";
import type { ClassGroupInput } from "@/src/lib/db/classGroups";
import type { ClassGroupWithEnrollment, DefaultPrices } from "@/app/classes/actions";

export type ClassesSettingsProps = {
  groups: ClassGroupWithEnrollment[];
  defaultPrices: DefaultPrices;
  onSaveGroup: (id: string, input: Partial<ClassGroupInput>) => void | Promise<void>;
  onSaveDefaultPrices: (input: Partial<DefaultPrices>) => void | Promise<void>;
};

const DAY_OPTIONS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

const COLOR_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "#b85a36", label: "טרקוטה" },
  { value: "#e0a93a", label: "חרדל" },
  { value: "#8fa581", label: "מרווה" },
  { value: "#4f8a8b", label: "טורקיז" },
  { value: "#b98b6e", label: "חימר" },
];

export default function ClassesSettings({
  groups,
  defaultPrices,
  onSaveGroup,
  onSaveDefaultPrices,
}: ClassesSettingsProps) {
  return (
    <div className="yd-stack">
      <div className="yd-section">
        <div className="yd-section-head">
          <h2 className="yd-heading">חוג אומנות — קבוצות שבועיות</h2>
        </div>
        <div className="yd-stack">
          {groups.map((group) => (
            <ClassGroupCard key={group.id} group={group} onSave={onSaveGroup} />
          ))}
        </div>
      </div>

      <DefaultPricesCard defaultPrices={defaultPrices} onSave={onSaveDefaultPrices} />
    </div>
  );
}

function ClassGroupCard({
  group,
  onSave,
}: {
  group: ClassGroupWithEnrollment;
  onSave: (id: string, input: Partial<ClassGroupInput>) => void | Promise<void>;
}) {
  const [day, setDay] = useState(group.day ?? DAY_OPTIONS[0]);
  const [time, setTime] = useState(group.time ?? "");
  const [color, setColor] = useState(group.color ?? COLOR_OPTIONS[0].value);

  function handleSave() {
    const update: Partial<ClassGroupInput> = {};
    if (day !== (group.day ?? DAY_OPTIONS[0])) update.day = day;
    if (time !== (group.time ?? "")) update.time = time;
    if (color !== (group.color ?? COLOR_OPTIONS[0].value)) update.color = color;
    if (Object.keys(update).length > 0) {
      onSave(group.id, update);
    }
  }

  return (
    <div className="yd-card yd-pad yd-stack">
      <div className="yd-row" style={{ justifyContent: "space-between" }}>
        <div className="yd-row" style={{ gap: 8 }}>
          <span className="yd-dab" style={{ background: color }} aria-hidden="true" />
          <span className="small muted">נרשמו/ות</span>
          <span className="yd-count">{group.enrollmentCount}</span>
        </div>
      </div>

      <div className="yd-row">
        <div className="yd-field" style={{ flex: 1 }}>
          <label htmlFor={`group-day-${group.id}`}>יום</label>
          <select
            id={`group-day-${group.id}`}
            className="yd-input"
            value={day}
            onChange={(event) => setDay(event.target.value)}
          >
            {DAY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="yd-field" style={{ flex: 1 }}>
          <label htmlFor={`group-time-${group.id}`}>שעה</label>
          <input
            id={`group-time-${group.id}`}
            className="yd-input"
            type="time"
            value={time}
            onChange={(event) => setTime(event.target.value)}
          />
        </div>
      </div>

      <div className="yd-field">
        <label id={`group-color-label-${group.id}`}>צבע</label>
        <div className="yd-row" role="group" aria-labelledby={`group-color-label-${group.id}`}>
          {COLOR_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`yd-choice${color === option.value ? " on" : ""}`}
              aria-pressed={color === option.value}
              aria-label={option.label}
              onClick={() => setColor(option.value)}
            >
              <span className="yd-dab" style={{ background: option.value }} aria-hidden="true" />
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="yd-row" style={{ justifyContent: "flex-end" }}>
        <button type="button" className="yd-btn primary sm" onClick={handleSave}>
          שמירה
        </button>
      </div>
    </div>
  );
}

function DefaultPricesCard({
  defaultPrices,
  onSave,
}: {
  defaultPrices: DefaultPrices;
  onSave: (input: Partial<DefaultPrices>) => void | Promise<void>;
}) {
  const [fullPrice, setFullPrice] = useState(
    defaultPrices.fullPrice !== null ? String(defaultPrices.fullPrice) : "",
  );
  const [discountPrice, setDiscountPrice] = useState(
    defaultPrices.discountPrice !== null ? String(defaultPrices.discountPrice) : "",
  );

  function handleSave() {
    const update: Partial<DefaultPrices> = {};
    const trimmedFull = fullPrice.trim();
    const trimmedDiscount = discountPrice.trim();
    const newFull = trimmedFull === "" ? null : Number(trimmedFull);
    const newDiscount = trimmedDiscount === "" ? null : Number(trimmedDiscount);
    if (newFull !== defaultPrices.fullPrice) update.fullPrice = newFull;
    if (newDiscount !== defaultPrices.discountPrice) update.discountPrice = newDiscount;
    if (Object.keys(update).length > 0) {
      onSave(update);
    }
  }

  return (
    <div className="yd-section">
      <div className="yd-section-head">
        <h2 className="yd-heading">תעריפי ברירת מחדל</h2>
      </div>
      <p className="small muted">
        הסכומים האלה מוצעים כברירת מחדל כשמוסיפים ילד/ה חדש/ה במשפחות, ואפשר לשנות אותם לכל ילד/ה בנפרד.
      </p>
      <div className="yd-card yd-pad yd-stack">
        <div className="yd-row">
          <div className="yd-field" style={{ flex: 1 }}>
            <label htmlFor="default-full-price">תעריף מלא</label>
            <input
              id="default-full-price"
              className="yd-input"
              type="number"
              value={fullPrice}
              onChange={(event) => setFullPrice(event.target.value)}
            />
          </div>

          <div className="yd-field" style={{ flex: 1 }}>
            <label htmlFor="default-discount-price">תעריף מוזל</label>
            <input
              id="default-discount-price"
              className="yd-input"
              type="number"
              value={discountPrice}
              onChange={(event) => setDiscountPrice(event.target.value)}
            />
          </div>
        </div>

        <div className="yd-row" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="yd-btn primary sm" onClick={handleSave}>
            שמירה
          </button>
        </div>
      </div>
    </div>
  );
}
