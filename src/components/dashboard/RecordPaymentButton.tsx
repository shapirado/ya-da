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

export default function RecordPaymentButton({
  families,
  childrenByPayer,
  onRecordPayment,
}: RecordPaymentButtonProps) {
  const [open, setOpen] = useState(false);

  async function handleSubmit(input: CreateReceiptInput) {
    await onRecordPayment(input);
    setOpen(false);
  }

  return (
    <>
      <button type="button" className="yd-btn primary" onClick={() => setOpen(true)}>
        רישום תשלום ידני
      </button>
      {open && (
        <RecordPaymentModal
          families={families}
          childrenByPayer={childrenByPayer}
          onSubmit={handleSubmit}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
