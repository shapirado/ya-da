import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadModel } from '@/lib/data';
import { allCharges, childName, fmtMoney, groupLabel, maps, type Charge } from '@/lib/billing';
import { monthLabel, monthStart } from '@/lib/dates';
import { enrollChild, markCharge, removeCharge, setChargePrice, stopParticipation, updateChild } from '@/app/actions';
import { EnrollFields } from '@/components/EnrollFields';
import { Dot, GenderIcon, PageHeader, StatusChip } from '@/components/ui';
import { Flash } from '@/components/Flash';
import { SubmitButton } from '@/components/SubmitButton';

export default async function ChildPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; err?: string; future?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const m = await loadModel();
  const mp = maps(m);
  const child = mp.children.get(id);
  if (!child) notFound();
  const showFuture = sp.future === '1';
  const charges = allCharges(m).filter((c) => c.childId === id);
  const byGroup = new Map<string, Charge[]>();
  for (const c of charges.filter((x) => x.isClass)) {
    const gid = mp.activities.get(c.activityId)?.class_group_id || 'none';
    byGroup.set(gid, [...(byGroup.get(gid) || []), c]);
  }
  const camps = charges.filter((c) => !c.isClass);
  const payers = [...m.payers].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'he'));
  const thisMonth = monthStart(m.today);
  const hiddenFuture = charges.filter((c) => c.isClass && !c.started).length;

  return (
    <>
      <PageHeader title={childName(child)} sub={<span className="inline-flex items-center gap-2"><GenderIcon gender={child.gender} size={24} />{mp.payers.get(child.morning_customer_id || '')?.name || 'ללא משלם/ת'}</span>}>
        <Link href="/children" className="btn-secondary no-underline">חזרה לרשימה</Link>
      </PageHeader>
      <Flash ok={sp.ok} err={sp.err} />

      <div className="flex flex-wrap gap-4 items-start">
        <section className="flex-[999_1_520px] min-w-0 flex flex-col gap-4">
          {[...byGroup.entries()].map(([gid, rows]) => {
            const g = mp.groups.get(gid);
            const visible = rows.filter((r) => showFuture || r.started);
            const futureMonths = rows.filter((r) => (r.month || '') >= thisMonth).map((r) => r.month!);
            return (
              <div key={gid} className="card flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="m-0 text-lg flex items-center gap-2"><Dot color={g?.color || '#5C5A66'} size={12} />חוג {groupLabel(g)}</h2>
                  {hiddenFuture > 0 && (
                    <Link href={`/children/${id}${showFuture ? '' : '?future=1'}`} className="chip border border-line-strong bg-white text-accent-dark no-underline">
                      {showFuture ? 'הסתרת חודשים עתידיים' : 'הצגת חודשים עתידיים'}
                    </Link>
                  )}
                </div>
                <ChargeTable rows={visible} childId={id} />
                {futureMonths.length > 0 && (
                  <form action={stopParticipation} className="flex flex-wrap items-end gap-2.5 pt-3 border-t border-line">
                    <input type="hidden" name="child" value={id} /><input type="hidden" name="group" value={gid} />
                    <label className="label">הפסקת השתתפות מחודש
                      <select name="from" className="input !w-auto">{futureMonths.map((d) => <option key={d} value={d}>{monthLabel(d)}</option>)}</select>
                    </label>
                    <SubmitButton className="btn-danger" pending="מוחקת…" title="אמחק את החיובים שלא שולמו מהחודש הזה והלאה">מחיקת החודשים הבאים</SubmitButton>
                  </form>
                )}
              </div>
            );
          })}
          {camps.length > 0 && (
            <div className="card flex flex-col gap-3">
              <h2 className="m-0 text-lg">קייטנות</h2>
              <ChargeTable rows={camps} childId={id} camp />
            </div>
          )}
          {!charges.length && <div className="card text-muted">עוד אין חיובים לילד/ה הזה/ו — אפשר לשבץ בצד</div>}
        </section>

        <aside className="flex-[1_1_340px] min-w-0 flex flex-col gap-4">
          <form action={updateChild} className="card flex flex-col gap-3">
            <h2 className="m-0 text-lg">פרטים</h2>
            <input type="hidden" name="id" value={id} />
            <div className="grid grid-cols-2 gap-2.5">
              <label className="label">שם פרטי<input name="first_name" defaultValue={child.first_name || ''} className="input" required /></label>
              <label className="label">שם משפחה<input name="family_name" defaultValue={child.family_name || ''} className="input" /></label>
            </div>
            <label className="label">מגדר
              <select name="gender" defaultValue={child.gender || ''} className="input"><option value="בת">בת</option><option value="בן">בן</option><option value="">לא צוין</option></select>
            </label>
            <label className="label">משלם/ת
              <select name="payer" defaultValue={child.morning_customer_id || ''} className="input">
                {payers.map((p) => <option key={p.morning_customer_id} value={p.morning_customer_id}>{p.name}</option>)}
              </select>
            </label>
            <SubmitButton pending="שומרת…">שמירה</SubmitButton>
          </form>

          <form action={enrollChild} className="card flex flex-col gap-3">
            <input type="hidden" name="id" value={id} />
            <EnrollFields m={m} exclude={{ groups: [...byGroup.keys()], camps: camps.map((c) => c.activityId) }} />
            <SubmitButton pending="יוצרת חיובים…" title="אצור את החיובים לפעילויות שסימנת">שיבוץ</SubmitButton>
          </form>
        </aside>
      </div>
    </>
  );
}

function ChargeTable({ rows, childId, camp = false }: { rows: Charge[]; childId: string; camp?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] border-collapse text-[15px]">
        <thead><tr><th className="th">{camp ? 'קייטנה' : 'חודש'}</th><th className="th">מחיר</th><th className="th">שולם</th><th className="th">מצב</th><th className="th"><span className="sr-only">פעולות</span></th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.linkId}>
              <td className="td font-medium">{camp ? r.shortLabel : monthLabel(r.month)}</td>
              <td className="td">
                <form action={setChargePrice} className="flex items-center gap-1.5">
                  <input type="hidden" name="child" value={childId} /><input type="hidden" name="link" value={r.linkId} />
                  <input name="price" defaultValue={r.price} inputMode="decimal" aria-label="מחיר" className="w-20 min-h-9 px-2 rounded-lg border border-line-strong" title="ריק = מחיר הפעילות" />
                  <button className="text-sm text-accent bg-transparent border-0 cursor-pointer min-h-9" title="אעדכן את המחיר של החיוב הזה בלבד">עדכון</button>
                </form>
              </td>
              <td className="td">{fmtMoney(r.paid)}</td>
              <td className="td">{r.started || r.status === 'paid' ? <StatusChip status={r.status} /> : <span className="chip bg-page text-muted">עתידי</span>}</td>
              <td className="td">
                <div className="flex gap-1.5">
                  <form action={markCharge}>
                    <input type="hidden" name="child" value={childId} /><input type="hidden" name="link" value={r.linkId} />
                    <input type="hidden" name="status" value={r.status === 'paid' ? 'unpaid' : 'paid'} />
                    <button className="btn-secondary !min-h-9 !text-[13px] !px-2.5" title={r.status === 'paid' ? 'אסמן כלא שולם' : 'אסמן כשולם בלי להפיק קבלה'}>{r.status === 'paid' ? 'ביטול תשלום' : 'סימון כשולם'}</button>
                  </form>
                  {r.status !== 'paid' && r.paid === 0 && (
                    <form action={removeCharge}>
                      <input type="hidden" name="child" value={childId} /><input type="hidden" name="link" value={r.linkId} />
                      <button className="btn-danger !min-h-9 !text-[13px] !px-2.5" title="אמחק את החיוב הזה">מחיקה</button>
                    </form>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {!rows.length && <tr><td className="td text-muted" colSpan={5}>אין חודשים שהתחילו</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
