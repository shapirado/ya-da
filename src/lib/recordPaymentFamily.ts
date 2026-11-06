import type { Payer } from "@/src/lib/db/payers";
import type { RecordPaymentFamily } from "@/src/components/RecordPayment/RecordPaymentModal";

// Carries a payer's full details into the modal's family select + parent
// detail panel, so matching a receipt shows who the parent actually is.
// Lives outside RecordPaymentModal.tsx (a "use client" file) so server
// components can call it directly when building their `families` prop.
export function toRecordPaymentFamily(payer: Payer): RecordPaymentFamily {
  return {
    id: payer.id,
    displayName: payer.displayName,
    firstName: payer.firstName,
    lastName: payer.lastName,
    role: payer.role,
    phone: payer.phone,
    email: payer.email,
  };
}
