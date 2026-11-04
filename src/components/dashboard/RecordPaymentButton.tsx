"use client";

import { useState } from "react";
import RecordPaymentModal, {
  type CreateReceiptInput,
  type RecordPaymentChild,
  type RecordPaymentFamily,
} from "@/src/components/RecordPayment/RecordPaymentModal";

export type RecordPaymentButtonProps = {
  families: RecordPaymentFamily[];
  childrenByPayer: Record<string, RecordPaymentChild[]>;
  onRecordPayment: (input: CreateReceiptInput) => Promise<void>;
};

const SUBMIT_ERROR = "לא הצלחנו לשמור את התשלום, נסי שוב";

export default function RecordPaymentButton({
  families,
  childrenByPayer,
  onRecordPayment,
}: RecordPaymentButtonProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(input: CreateReceiptInput) {
    try {
      await onRecordPayment(input);
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
        className="yd-btn primary"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        רישום תשלום ידני
      </button>
      {open && (
        <RecordPaymentModal
          families={families}
          childrenByPayer={childrenByPayer}
          onSubmit={handleSubmit}
          onClose={() => setOpen(false)}
          error={error}
        />
      )}
    </>
  );
}
