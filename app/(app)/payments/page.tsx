import { loadModel, loadRecentPayments } from '@/lib/data';
import { fmtMoney } from '@/lib/billing';
import { fmtDate, fmtDateTime } from '@/lib/dates';
import { Method, Notice, PageHeader } from '@/components/ui';
import { PaymentScanner } from '@/components/PaymentScanner';
import { morningConfigured } from '@/lib/morning';

export default async function PaymentsPage() {
  const [m, recent] = await Promise.all([loadModel(), loadRecentPayments(20)]);
  const payers = new Map(m.payers.map((p) => [p.morning_customer_id, p.name]));
  return (
    <>
      <PageHeader title="קריאת צילום תשלום" sub="תדביקי צילום מסך — אני אזהה סכום, משלם/ת וילד/ה, ואפיק קבלה ב-Morning" />
      {!morningConfigured() && <Notice tone="warn">מפתחות Morning לא מוגדרים — אוכל לקרוא צילומים אבל לא להפיק קבלות</Notice>}
      {!process.env.GEMINI_API_KEY && <Notice tone="warn">חסר GEMINI_API_KEY — לא אוכל לקרוא צילומים</Notice>}
      <PaymentScanner />

      <section aria-labelledby="log-h" className="card flex flex-col gap-3">
        <h2 id="log-h" className="m-0 text-[19px]">קבלות שהפקתי</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-[15px]">
            <thead><tr><th className="th">תאריך תשלום</th><th className="th">משלם/ת</th><th className="th">שם בצילום</th><th className="th">אמצעי</th><th className="th">סכום</th><th className="th">קבלה</th><th className="th">נקלט</th></tr></thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.id}>
                  <td className="td">{fmtDate(r.paid_at)}</td>
                  <td className="td font-medium">{(r.payer_id && payers.get(r.payer_id)) || '—'}</td>
                  <td className="td text-muted">{r.raw_name}</td>
                  <td className="td"><Method method={r.method} /></td>
                  <td className="td font-semibold">{fmtMoney(r.amount)}</td>
                  <td className="td">{r.morning_document_url ? <a href={r.morning_document_url} target="_blank" rel="noopener">{r.morning_document_number || 'פתיחה'}</a> : r.morning_document_number}</td>
                  <td className="td text-muted text-sm">{fmtDateTime(r.created_at)}</td>
                </tr>
              ))}
              {!recent.length && <tr><td className="td text-muted" colSpan={7}>עוד לא הפקתי קבלות</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
