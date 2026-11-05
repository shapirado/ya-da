"use client";

import { useState } from "react";
import NewStudentModal, { type CreateStudentInput, type NewStudentFamily } from "./NewStudentModal";
import type { ClassGroup } from "@/src/lib/db/classGroups";

export type NewStudentButtonProps = {
  families: NewStudentFamily[];
  classGroups: ClassGroup[];
  onCreateStudent: (input: CreateStudentInput) => Promise<void>;
};

const SUBMIT_ERROR = "לא הצלחנו לשמור את התלמיד/ה, נסי שוב";

export default function NewStudentButton({ families, classGroups, onCreateStudent }: NewStudentButtonProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(input: CreateStudentInput) {
    try {
      await onCreateStudent(input);
      setOpen(false);
      setError(null);
    } catch {
      setError(SUBMIT_ERROR);
    }
  }

  return (
    <>
      <button
        type="button"
        className="yd-btn secondary"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        תלמיד/ה חדש/ה
      </button>
      {open && (
        <NewStudentModal
          families={families}
          classGroups={classGroups}
          onSubmit={handleSubmit}
          onClose={() => setOpen(false)}
          error={error}
        />
      )}
    </>
  );
}
