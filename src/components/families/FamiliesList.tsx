"use client";

import { useMemo, useState } from "react";

export type FamilyStatus = "missing" | "partial" | "paid" | "none";

export type FamilySummary = {
  payerId: string;
  displayName: string;
  role: string | null;
  childrenNames: string[];
  status: FamilyStatus;
};

export type FamiliesListProps = {
  families: FamilySummary[];
};

const ROLE_LABELS: Record<string, string> = {
  mom: "אמא",
  dad: "אבא",
  other: "אחר",
};

const STATUS_LABELS: Record<FamilyStatus, string> = {
  missing: "יש חוב",
  partial: "שולם בחלקו",
  paid: "שולם",
  none: "",
};

export default function FamiliesList({ families }: FamiliesListProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return families;
    return families.filter((family) => {
      const haystack = [family.displayName, ...family.childrenNames].join(" ").toLowerCase();
      return haystack.includes(normalized);
    });
  }, [families, query]);

  return (
    <div className="yd-stack">
      <input
        type="search"
        className="yd-input"
        placeholder="חיפוש משפחה או ילד/ה"
        aria-label="חיפוש"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      <div className="yd-stack">
        {filtered.map((family) => (
          <a key={family.payerId} href={`/families/${family.payerId}`} className="yd-card yd-pad yd-row yd-family-row">
            {family.status !== "none" && (
              <span className={`yd-chip ${family.status}`}>
                <span className="dot" />
                {STATUS_LABELS[family.status]}
              </span>
            )}
            <div style={{ flex: 1 }}>
              <div className="name">{family.displayName}</div>
              <div className="small muted">
                {family.role ? ROLE_LABELS[family.role] ?? family.role : ""}
                {family.childrenNames.length > 0 ? ` · ${family.childrenNames.join(", ")}` : ""}
              </div>
            </div>
          </a>
        ))}
        {filtered.length === 0 && <p className="small muted">לא נמצאו משפחות</p>}
      </div>
    </div>
  );
}
