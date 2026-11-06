import { monthLabel } from "@/src/components/dashboard/MonthRow";
import type { ReceiptLineRow } from "@/src/lib/db/receipts";

// Shown for a payment-history line whose month or amount hasn't been
// resolved yet in the receipts review queue.
const NOT_YET_MATCHED = "טרם שויך";

export type PaymentHistoryListProps = {
  childFirstName: string;
  history: ReceiptLineRow[];
};

function isoToDdmmyyyy(iso: string): string | null {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const [, yyyy, mm, dd] = match;
  return `${dd}/${mm}/${yyyy}`;
}

export default function PaymentHistoryList({ childFirstName, history }: PaymentHistoryListProps) {
  return (
    <div className="yd-card yd-pad yd-stack">
      <span className="small muted">היסטוריית תשלומים · {childFirstName}</span>
      {history.length === 0 ? (
        <span className="small muted">אין תשלומים עדיין</span>
      ) : (
        history
          .slice()
          // Lines with no month yet (unmatched webhook items) sort first.
          .sort((a, b) => ((a.month ?? "9999") > (b.month ?? "9999") ? -1 : 1))
          .map((line) => {
            const receivedAt = line.receivedAt ? isoToDdmmyyyy(line.receivedAt) : null;
            const transactionDate = line.transactionDate ? isoToDdmmyyyy(line.transactionDate) : null;
            const details = [
              line.externalDocNumber ? `קבלה #${line.externalDocNumber}` : null,
              transactionDate ? `תאריך תשלום: ${transactionDate}` : null,
              receivedAt ? `התקבל: ${receivedAt}` : null,
            ].filter(Boolean);

            return (
              <div key={line.id} className="yd-stack" style={{ gap: 2 }}>
                <div className="yd-row" style={{ justifyContent: "space-between" }}>
                  <span>{line.month ? monthLabel(line.month) : NOT_YET_MATCHED}</span>
                  <span>
                    {line.amount === null ? NOT_YET_MATCHED : `${line.amount.toLocaleString("he-IL")} ₪`}
                  </span>
                </div>
                {details.length > 0 && (
                  <span className="small muted">{details.join(" · ")}</span>
                )}
              </div>
            );
          })
      )}
    </div>
  );
}
