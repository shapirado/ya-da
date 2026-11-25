import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadModel } from '@/lib/data';
import { allCharges, childName, fmtMoney, groupLabel, hasPayment, maps, type Charge } from '@/lib/billing';
import { monthLabel, monthStart } from '@/lib/dates';
import { getMorningClient, morningConfigured, searchClientReceipts, type MorningClient, type ReceiptRef } from '@/lib/morning';
import { markCharge, saveChild } from '@/app/actions';
import { EnrollFields } from '@/components/EnrollFields';
import type { JoinInfo } from '@/components/JoinMonth';
import { ChildPayers, type MorningContact, type PayerContact } from '@/components/ChildPayers';
import { PriceEdit } from '@/components/PriceEdit';
import { StopParticipation } from '@/components/StopParticipation';
import { BackIcon, Dot, GenderIcon, PageHeader, StatusChip } from '@/components/ui';
import { Flash } from '@/components/Flash';
import { SubmitButton } from '@/components/SubmitButton';

type Receipt = ReceiptRef;

/**
 * Receipt number + link for each Morning document id: one document search for payer 1, then payer 2 for
 * whatever wasn't found. Anything Morning can't answer is left out (the cell shows "—").
 */
async function loadReceipts(ids: string[], payerIds: (string | null)[]): Promise<Map<string, Receipt>> {
  const out = new Map<string, Receipt>();
  if (!ids.length || !morningConfigured()) return out;
  for (const pid of payerIds) {
    if (!pid || ids.every((d) => out.has(d))) continue;
    try {
      const found = await searchClientReceipts(pid);
      for (const d of ids) if (!out.has(d) && found.has(d)) out.set(d, found.get(d)!);
    } catch (e) {
      console.log('[receipts] Morning search failed for', pid, e instanceof Error ? e.message : e);
    }
  }
  return out;
}

/** A payer as Morning has it now; null when Morning can't be reached (the page falls back to the alias row). */
async function morningClient(id: string | null): Promise<MorningClient | null> {
  if (!id || !morningConfigured()) return null;
  try { return await getMorningClient(id); } catch (e) { console.log('[child page] Morning client', id, e instanceof Error ? e.message : e); return null; }
}

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
  // Morning is the source of truth for the child's payers' phone/email; other payers come from the alias rows
  const [c1, c2] = await Promise.all([morningClient(child.morning_customer_id), morningClient(child.morning_customer_id_2)]);
  const live = new Map([c1, c2].filter((c): c is MorningClient => !!c).map((c) => [c.id, c]));
  const payers: PayerContact[] = [...m.payers]
    .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'he'))
    .map((p) => {
      const c = live.get(p.morning_customer_id);
      // the payer's own phone is `phone`; `mobile` belongs to the contact when there is one
      return c
        ? { id: p.morning_customer_id, name: p.name || c.name || '—', phone: c.phone || (c.contactPerson ? '' : c.mobile), email: c.emails[0] || '' }
        : { id: p.morning_customer_id, name: p.name || '—', phone: p.phone || '', email: p.email || '' };
    });
  const contact: MorningContact | null = c1?.contactPerson ? { name: c1.contactPerson, phone: c1.mobile, email: c1.emails[1] || '' } : null;
  const thisMonth = monthStart(m.today);
  const hiddenFuture = charges.filter((c) => c.isClass && !c.started && !hasPayment(c)).length;
  const receipts = await loadReceipts([...new Set(charges.flatMap((c) => c.invoices))], [child.morning_customer_id, child.morning_customer_id_2]);

  // a group whose first month for this child is this month: its join month shows under the group in the שיבוץ card
  const join: Record<string, JoinInfo> = {};
  for (const [gid, rows] of byGroup) {
    const sorted = [...rows].sort((a, b) => (a.month || '').localeCompare(b.month || ''));
    const first = sorted[0];
    if (!first || first.month !== thisMonth) continue;
    const act = mp.activities.get(first.activityId);
    join[gid] = {
      linkId: first.linkId,
      month: thisMonth,
      price: first.price,
      locked: first.status === 'paid' || first.status === 'deposit' || first.paid > 0,
      base: sorted[1]?.price ?? Number(act?.default_price ?? m.settings.default_full_price ?? first.price),
      day: mp.groups.get(gid)?.day ?? null,
    };
  }
  const current = [...byGroup.entries()].filter(([, rows]) => rows.some((r) => (r.month || '') >= thisMonth)).map(([gid]) => gid);
  const payerNames = [child.morning_customer_id ? mp.payers.get(child.morning_customer_id)?.name : null, child.morning_customer_id_2 ? mp.payers.get(child.morning_customer_id_2)?.name : contact?.name].filter(Boolean).join(' · ');

  return (
    <>
      <PageHeader
        title={<span className="inline-flex items-center gap-2.5"><GenderIcon gender={child.gender} size={24} />{childName(child)}</span>}
        sub={<span className="text-[15px]">{payerNames || 'ללא משלם/ת'}</span>}
        lead={<Link href="/children" aria-label="חזרה לרשימת הילדים" className="w-11 h-11 rounded-xl flex items-center justify-center text-ink"><BackIcon /></Link>}>
        <Link href="/children" className="btn-secondary no-underline">חזרה לרשימה</Link>
      </PageHeader>
      <Flash ok={sp.ok} err={sp.err} />

      <div className="flex flex-wrap gap-8 items-start">
        {/* side column: details + enrolment, one form, one save */}
        <form action={saveChild} className="flex-[1_1_520px] min-w-0 flex flex-col gap-6">
          <input type="hidden" name="id" value={id} />
          <section aria-labelledby="details-h" className="card flex flex-col gap-8">
            <h2 id="details-h" className="m-0 text-lg">פרטים</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <label className="label min-w-0">שם פרטי<input name="first_name" defaultValue={child.first_name || ''} className="input" required /></label>
              <label className="label min-w-0">שם משפחה<input name="family_name" defaultValue={child.family_name || ''} className="input" /></label>
              <label className="label min-w-0">מגדר
                <select name="gender" defaultValue={child.gender || ''} className="input"><option value="בת">בת</option><option value="בן">בן</option><option value="">לא צוין</option></select>
              </label>
            </div>
            <ChildPayers payers={payers} payer1={child.morning_customer_id} payer2={child.morning_customer_id_2} contact={contact} />
          </section>

          <section aria-label="שיבוץ לפעילויות" className="card flex flex-col gap-4">
            <EnrollFields m={m} exclude={{ groups: [], camps: camps.map((c) => c.activityId) }} current={current} join={join} heading />
          </section>

          <SubmitButton className="btn-primary w-full !min-h-12" pending="שומרת…" title="אשמור את הפרטים ואת השיבוץ">שמירה</SubmitButton>
        </form>

        {/* charges column */}
        <section className="flex-[1_1_560px] min-w-0 flex flex-col gap-6">
          {[...byGroup.entries()].map(([gid, rows]) => {
            const g = mp.groups.get(gid);
            const visible = rows.filter((r) => showFuture || r.started || hasPayment(r)); // months paid ahead always show
            const futureMonths = rows.filter((r) => (r.month || '') >= thisMonth).map((r) => r.month!);
            return (
              <div key={gid} className="card flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="m-0 text-lg flex items-center gap-2"><Dot color={g?.color || '#5C5A66'} size={12} />חוג {groupLabel(g)}</h2>
                  {hiddenFuture > 0 && (
                    <Link href={`/children/${id}${showFuture ? '' : '?future=1'}`} className="chip border border-line-strong bg-white text-accent-dark no-underline">
                      {showFuture ? 'הסתרת חודשים עתידיים' : 'הצגת חודשים עתידיים'}
                    </Link>
                  )}
                  <span className="flex-1" />
                  {futureMonths.length > 0 && <StopParticipation childId={id} groupId={gid} months={futureMonths} />}
                </div>
                <ChargeTable rows={visible} childId={id} receipts={receipts} />
              </div>
            );
          })}
          {camps.length > 0 && (
            <div className="card flex flex-col gap-3">
              <h2 className="m-0 text-lg">קייטנות</h2>
              <ChargeTable rows={camps} childId={id} receipts={receipts} camp />
            </div>
          )}
          {!charges.length && <div className="card text-muted">עוד אין חיובים לילד/ה הזה/ו — אפשר לשבץ בצד</div>}
        </section>
      </div>
    </>
  );
}

function ChargeTable({ rows, childId, receipts, camp = false }: { rows: Charge[]; childId: string; receipts: Map<string, Receipt>; camp?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[15px]">
        <thead><tr><th className="th">{camp ? 'קייטנה' : 'חודש'}</th><th className="th">מחיר</th><th className="th">שולם</th><th className="th">מצב</th><th className="th">קבלה</th></tr></thead>
        <tbody>
          {rows.map((r) => {
            const name = camp ? r.shortLabel : monthLabel(r.month);
            const docs = r.invoices.map((d) => ({ id: d, ...receipts.get(d) })).filter((d) => d.number);
            return (
              <tr key={r.linkId}>
                <td className="td font-medium whitespace-nowrap">{name}</td>
                <td className="td whitespace-nowrap"><PriceEdit childId={childId} linkId={r.linkId} price={r.price} month={name} /></td>
                <td className="td whitespace-nowrap">{fmtMoney(r.paid)}</td>
                <td className="td">
                  <span className="inline-flex flex-wrap items-center gap-1.5">
                    {/* a deposit before the start is real status, not "future" */}
                    {r.started || r.status !== 'unpaid' || r.paid > 0 ? <StatusChip status={r.status} /> : <span className="chip bg-page text-muted">עתידי</span>}
                    <form action={markCharge}>
                      <input type="hidden" name="child" value={childId} /><input type="hidden" name="link" value={r.linkId} />
                      <input type="hidden" name="status" value={r.status === 'paid' ? 'unpaid' : 'paid'} />
                      <button className="text-xs text-accent-dark bg-transparent border-0 cursor-pointer min-h-7 px-1 underline" title={r.status === 'paid' ? 'אסמן כלא שולם' : 'אסמן כשולם בלי להפיק קבלה'}>
                        {r.status === 'paid' ? 'ביטול תשלום' : 'סימון כשולם'}
                      </button>
                    </form>
                  </span>
                </td>
                <td className="td">
                  {docs.length ? docs.map((d, i) => (
                    <span key={d.id}>
                      {i > 0 && ', '}
                      {d.url ? <a href={d.url} target="_blank" rel="noopener" title="אפתח את הקבלה ב-Morning">{d.number}</a> : d.number}
                    </span>
                  )) : <span className="text-muted">—</span>}
                </td>
              </tr>
            );
          })}
          {!rows.length && <tr><td className="td text-muted" colSpan={5}>אין חודשים שהתחילו</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
