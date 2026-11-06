import AppShell from "@/src/components/AppShell";
import InvoicesTable from "@/src/components/invoices/InvoicesTable";
import { listChildrenWithPayer } from "@/src/lib/db/children";
import { listPayers } from "@/src/lib/db/payers";
import { listAllReceipts } from "@/src/lib/db/receipts";
import { buildInvoiceRows } from "@/src/lib/invoiceRows";

// Always show the live receipts log rather than a build-time snapshot.
export const dynamic = "force-dynamic";

export default async function InvoicesPage() {
  const [receipts, children, payers] = await Promise.all([
    listAllReceipts(),
    listChildrenWithPayer(),
    listPayers(),
  ]);

  const rows = buildInvoiceRows(receipts, children, payers);
  const months = Array.from(new Set(rows.flatMap((row) => row.months))).sort((a, b) =>
    a > b ? -1 : 1,
  );

  return (
    <AppShell>
      <div className="yd-stack">
        <h1 className="yd-title">יומן קבלות</h1>
        <p className="yd muted small" style={{ marginTop: -8 }}>
          כל הקבלות שהתקבלו — מ-Morning ומידני — {rows.length} בסך הכול
        </p>
        <InvoicesTable rows={rows} months={months} />
      </div>
    </AppShell>
  );
}
