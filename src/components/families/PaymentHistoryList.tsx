import { monthLabel } from "@/src/components/dashboard/MonthRow";
import type { ReceiptLineRow } from "@/src/lib/db/receipts";

// Shown for a payment-history line whose month or amount hasn't been
// resolved yet in the receipts review queue.
const NOT_YET_MATCHED = "טרם שויך";

export type PaymentHistoryListProps = {
  childFirstName: string;
  history: ReceiptLineRow[];
};

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
          .map((line) => (
            <div key={line.id} className="yd-row" style={{ justifyContent: "space-between" }}>
              <span>{line.month ? monthLabel(line.month) : NOT_YET_MATCHED}</span>
              <span>
                {line.amount === null ? NOT_YET_MATCHED : `${line.amount.toLocaleString("he-IL")} ₪`}
              </span>
            </div>
          ))
      )}
    </div>
  );
}
