import Link from 'next/link';
import { loadModel, loadRecentPayments } from '@/lib/data';
import { activityLabel, childName, fmtMoney, maps } from '@/lib/billing';
import { fmtDate, fmtDateTime } from '@/lib/dates';
import { Method, Notice, PageHeader } from '@/components/ui';
import { PaymentScanner } from '@/components/PaymentScanner';
import { fetchDocument, morningConfigured } from '@/lib/morning';

type SP = { tab?: string };

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const receiptsTab = sp.tab === 'receipts';
  const [m, recent] = await Promise.all([loadModel(), loadRecentPayments(20)]);
  const payers = new Map(m.payers.map((p) => [p.morning_customer_id, p.name]));

  return (
    <>
      <PageHeader title="תשלומים וקבלות" sub="קריאת צילומי תשלום והקבלות שהופקו ב-Morning" />
      <div role="tablist" aria-label="תצוגה" className="flex gap-1.5">
        <Tab href="/payments" on={!receiptsTab}>קריאת צילום</Tab>
        <Tab href="/payments?tab=receipts" on={receiptsTab}>קבלות Morning</Tab>
      </div>

      {receiptsTab ? <MorningReceipts /> : (
        <>
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
      )}
    </>
  );
}

async function MorningReceipts() {
  if (!morningConfigured()) return <Notice tone="warn">מפתחות Morning לא מוגדרים — לא אוכל להביא קבלות</Notice>;
  const m = await loadModel();
  const mp = maps(m);

  // Which children/activities reference each invoice id (child_activity.invoices)
  const refs = new Map<string, string[]>();
  for (const l of m.links) {
    for (const inv of l.invoices || []) {
      const c = mp.children.get(l.child_id);
      const a = mp.activities.get(l.activity_id);
      const label = `${c ? childName(c) : '?'} · ${a ? activityLabel(a, mp.groups) : '?'}`;
      refs.set(inv, [...(refs.get(inv) || []), label]);
    }
  }
  const ids = [...refs.keys()];
  let docs;
  try {
    
    docs = await Promise.all(ids.map((id) => fetchDocument(id)));
    
  } catch (e) {
    return <Notice tone="warn">לא הצלחתי להתחבר ל-Morning — {e instanceof Error ? e.message : 'שגיאה לא ידועה'}. כדאי לבדוק את מפתחות ה-API ואת MORNING_ENV</Notice>;
  }

  const sorted = docs.sort((x, y) => (y.date || '').localeCompare(x.date || ''));
  const missing = sorted.filter((d) => !d.ok);

  return (
    <section aria-labelledby="morning-h" className="card flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="morning-h" className="m-0 text-[19px]">קבלות Morning</h2>
        <span className="text-sm text-muted">{ids.length} קבלות מקושרות לפעילויות</span>
      </div>
      {missing.length > 0 && <Notice tone="warn">{missing.length} קבלות לא נמצאו ב-Morning (ייתכן שנמחקו או שהמזהה שגוי)</Notice>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-[15px]">
          <thead><tr><th className="th">קבלה</th><th className="th">תאריך</th><th className="th">לקוח/ה ב-Morning</th><th className="th">סכום</th><th className="th">עבור</th></tr></thead>
          <tbody>
            {sorted.filter((d) => d.ok).map((d) => (
              <tr key={d.id}>
                <td className="td font-medium">{d.url ? <a href={d.url} target="_blank" rel="noopener">{d.number || 'פתיחה'}</a> : d.number || '—'}</td>
                <td className="td">{d.date ? fmtDate(d.date.slice(0, 10)) : '—'}</td>
                <td className="td">{d.clientName || '—'}</td>
                <td className="td font-semibold">{d.amount != null ? fmtMoney(d.amount) : '—'}</td>
                <td className="td">
                  <div className="flex flex-col gap-0.5">{(refs.get(d.id) || []).map((t, i) => <span key={i} className="text-sm">{t}</span>)}</div>
                </td>
              </tr>
            ))}
            {!ids.length && <tr><td className="td text-muted" colSpan={5}>אין קבלות מקושרות — המזהים נשמרים על הפעילות של כל ילד/ה</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Tab({ href, on, children }: { href: string; on: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} role="tab" aria-selected={on} className={`inline-flex items-center min-h-11 px-4 rounded-full border text-sm no-underline ${on ? 'border-accent bg-accent-soft text-accent-dark font-semibold' : 'border-line-strong bg-white text-ink'}`}>
      {children}
    </Link>
  );
}
