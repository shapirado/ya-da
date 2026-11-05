"use client";

import { useState } from "react";
import { DatePicker } from "antd";
import dayjs from "dayjs";
import { GENDER_OPTIONS, groupLabel } from "../families/ChildEditor";
import type { ClassGroup } from "@/src/lib/db/classGroups";

export type NewStudentFamily = { id: string; displayName: string };

export type CreateStudentInput = {
  firstName: string;
  familyName: string;
  classGroupId: string;
  gender: string;
  enrollmentStart: string;
  payerId?: string;
  newPayer?: { displayName: string; role: string | null; phone?: string };
  startingPrice?: number;
};

export type NewStudentModalProps = {
  families: NewStudentFamily[];
  classGroups: ClassGroup[];
  onSubmit: (input: CreateStudentInput) => void;
  onClose?: () => void;
  error?: string | null;
};

const ROLE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "mom", label: "אמא" },
  { value: "dad", label: "אבא" },
  { value: "other", label: "אחר" },
];

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
}

const ERROR_MISSING_FIELDS = "יש למלא שם פרטי, שם משפחה וחוג";
const ERROR_MISSING_PAYER = "יש לבחור הורה קיים או להזין פרטי הורה חדש";

export default function NewStudentModal({
  families,
  classGroups,
  onSubmit,
  onClose,
  error: submitError,
}: NewStudentModalProps) {
  const [payerMode, setPayerMode] = useState<"existing" | "new">(families.length > 0 ? "existing" : "new");
  const [payerId, setPayerId] = useState(families[0]?.id ?? "");
  const [newPayerName, setNewPayerName] = useState("");
  const [newPayerRole, setNewPayerRole] = useState("mom");
  const [newPayerPhone, setNewPayerPhone] = useState("");

  const [firstName, setFirstName] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [classGroupId, setClassGroupId] = useState(classGroups[0]?.id ?? "");
  const [gender, setGender] = useState(GENDER_OPTIONS[0]?.value ?? "");
  const [enrollmentStart, setEnrollmentStart] = useState(todayIso());
  const [startingPrice, setStartingPrice] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    if (!firstName.trim() || !familyName.trim() || !classGroupId) {
      setError(ERROR_MISSING_FIELDS);
      return;
    }
    if (payerMode === "existing" && !payerId) {
      setError(ERROR_MISSING_PAYER);
      return;
    }
    if (payerMode === "new" && !newPayerName.trim()) {
      setError(ERROR_MISSING_PAYER);
      return;
    }

    setError(null);
    const trimmedPrice = startingPrice.trim();

    onSubmit({
      firstName: firstName.trim(),
      familyName: familyName.trim(),
      classGroupId,
      gender,
      enrollmentStart,
      ...(payerMode === "existing"
        ? { payerId }
        : {
            newPayer: {
              displayName: newPayerName.trim(),
              role: newPayerRole,
              phone: newPayerPhone.trim() || undefined,
            },
          }),
      ...(trimmedPrice !== "" ? { startingPrice: Number(trimmedPrice) } : {}),
    });
  }

  return (
    <div className="yd-scrim" role="dialog" aria-modal="true" aria-label="תלמיד/ה חדש/ה">
      <div className="yd-modal">
        <div className="hd">
          <h2 className="yd-title">תלמיד/ה חדש/ה</h2>
          {onClose && (
            <button type="button" className="yd-btn ghost sm" onClick={onClose}>
              סגירה
            </button>
          )}
        </div>

        <div className="bd yd-stack">
          <div className="yd-field">
            <span>הורה</span>
            <div className="yd-row">
              <button
                type="button"
                aria-pressed={payerMode === "existing"}
                className={`yd-btn sm${payerMode === "existing" ? " primary" : " secondary"}`}
                onClick={() => setPayerMode("existing")}
                disabled={families.length === 0}
              >
                הורה קיים
              </button>
              <button
                type="button"
                aria-pressed={payerMode === "new"}
                className={`yd-btn sm${payerMode === "new" ? " primary" : " secondary"}`}
                onClick={() => setPayerMode("new")}
              >
                הורה חדש
              </button>
            </div>
          </div>

          {payerMode === "existing" ? (
            <div className="yd-field">
              <label htmlFor="new-student-payer">בחירת הורה</label>
              <select
                id="new-student-payer"
                className="yd-input"
                value={payerId}
                onChange={(event) => setPayerId(event.target.value)}
              >
                {families.map((family) => (
                  <option key={family.id} value={family.id}>
                    {family.displayName}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="yd-row">
              <div className="yd-field" style={{ flex: 1 }}>
                <label htmlFor="new-student-payer-name">שם ההורה</label>
                <input
                  id="new-student-payer-name"
                  className="yd-input"
                  type="text"
                  value={newPayerName}
                  onChange={(event) => setNewPayerName(event.target.value)}
                />
              </div>
              <div className="yd-field" style={{ flex: 1 }}>
                <label htmlFor="new-student-payer-role">תפקיד</label>
                <select
                  id="new-student-payer-role"
                  className="yd-input"
                  value={newPayerRole}
                  onChange={(event) => setNewPayerRole(event.target.value)}
                >
                  {ROLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="yd-field" style={{ flex: 1 }}>
                <label htmlFor="new-student-payer-phone">טלפון</label>
                <input
                  id="new-student-payer-phone"
                  className="yd-input"
                  type="tel"
                  value={newPayerPhone}
                  onChange={(event) => setNewPayerPhone(event.target.value)}
                />
              </div>
            </div>
          )}

          <div className="yd-row">
            <div className="yd-field" style={{ flex: 1 }}>
              <label htmlFor="new-student-first-name">שם פרטי</label>
              <input
                id="new-student-first-name"
                className="yd-input"
                type="text"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
              />
            </div>
            <div className="yd-field" style={{ flex: 1 }}>
              <label htmlFor="new-student-family-name">שם משפחה</label>
              <input
                id="new-student-family-name"
                className="yd-input"
                type="text"
                value={familyName}
                onChange={(event) => setFamilyName(event.target.value)}
              />
            </div>
          </div>

          <div className="yd-row">
            <div className="yd-field" style={{ flex: 1 }}>
              <label htmlFor="new-student-group">חוג</label>
              <select
                id="new-student-group"
                className="yd-input"
                value={classGroupId}
                onChange={(event) => setClassGroupId(event.target.value)}
              >
                {classGroups.map((group) => (
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
              <label htmlFor="new-student-enrollment">תאריך התחלה</label>
              <DatePicker
                id="new-student-enrollment"
                style={{ width: "100%", height: 44 }}
                value={enrollmentStart ? dayjs(enrollmentStart) : null}
                onChange={(date) => setEnrollmentStart(date ? date.format("YYYY-MM-DD") : "")}
                format="DD/MM/YYYY"
                placeholder="בחרי תאריך"
                allowClear={false}
              />
            </div>
            <div className="yd-field" style={{ flex: 1 }}>
              <label htmlFor="new-student-price">תעריף חודשי (אופציונלי)</label>
              <input
                id="new-student-price"
                className="yd-input"
                type="number"
                value={startingPrice}
                onChange={(event) => setStartingPrice(event.target.value)}
                placeholder="סכום"
              />
            </div>
          </div>

          {(error || submitError) && (
            <p className="yd-login-error" role="alert">
              {error || submitError}
            </p>
          )}
        </div>

        <div className="ft">
          <button type="button" className="yd-btn primary" onClick={handleSubmit}>
            שמירה
          </button>
          {onClose && (
            <button type="button" className="yd-btn secondary" onClick={onClose}>
              ביטול
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
