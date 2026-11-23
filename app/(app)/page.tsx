import Link from 'next/link';
import { loadModel, loadRecentPayments } from '@/lib/data';
import { allCharges, childName, familyDebts, fmtMoney, groupLabel, isClass, isStarted, maps } from '@/lib/billing';
import { fmtDate, hebrewWeekday, monthName, monthStart } from '@/lib/dates';
import { Dot, GenderIcon, Method, MethodIcon, PageHeader, PlusIcon, StatusChip, WhatsAppIcon, iconBtn } from '@/components/ui';
import { MobileMenu } from '@/components/MobileMenu';
import { Sheet } from '@/components/Sheet';
import { morningConfigured } from '@/lib/morning';
import { checkAccess } from '@/lib/auth';

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ g?: string; c?: string }> }) {
  const sp = await searchParams;
  const [m, recent, access] = await Promise.all([loadModel(), loadRecentPayments(6), checkAccess()]);
  const mp = maps(m);
  const thisMonth = monthStart(m.today);
  const charges = allCharges(m);
  const monthCharges = charges.filter((c) => c.isClass && c.month === thisMonth);
  const collected = monthCharges.reduce((t, c) => t + c.paid, 0);
  const debts = familyDebts(m);
  const openTotal = debts.reduce((t, d) => t + d.total, 0);
  const openCount = debts.reduce((t, d) => t + d.charges.length, 0);
  const activeKids = new Set(charges.filter((c) => c.started && (!c.isClass || c.month === thisMonth)).map((c) => c.childId)).size;

  const groups = m.groups.map((g) => {
    const rows = monthCharges.filter((c) => {
      const a = mp.activities.get(c.activityId);
      return a?.class_group_id === g.id;
    });
    const paid = rows.filter((r) => r.status === 'paid').length;
    const act = m.activities.find((a) => a.class_group_id === g.id && a.start_date === thisMonth);
    return { g, count: rows.length, paid, unpaid: rows.length - paid, price: act?.default_price ?? m.settings.default_full_price };
  }).sort((a, b) => groupLabel(a.g).localeCompare(groupLabel(b.g), 'he'));

  const camps = m.activities
    .filter((a) => !isClass(a))
    .map((a) => {
      const rows = charges.filter((c) => c.activityId === a.id);
      const by = (s: string) => rows.filter((r) => r.status === s).length;
      return { a, count: rows.length, unpaid: rows.length - by('paid'), deposit: by('deposit'), partial: by('partial'), open: by('unpaid') };
    })
    // Upcoming camps, and past ones that still have open payments
    .filter(({ a, unpaid }) => (a.start_date && a.start_date >= m.today) || unpaid > 0)
    .sort((x, y) => (x.a.start_date || '').localeCompare(y.a.start_date || ''));

  // A clicked group card shows its children in the side panel instead of the family debts
  const selGroup = sp.g ? m.groups.find((g) => g.id === sp.g) : undefined;
  const groupKids = selGroup
    ? monthCharges
        .filter((c) => mp.activities.get(c.activityId)?.class_group_id === selGroup.id)
        .sort((a, b) => a.childName.localeCompare(b.childName, 'he'))
    : [];
  // Each child's debt in this group: every started month still owed (past months + this one)
  const groupDebt = new Map<string, { total: number; months: number }>();
  if (selGroup) {
    for (const c of charges) {
      if (!c.started || !(c.due > 0) || mp.activities.get(c.activityId)?.class_group_id !== selGroup.id) continue;
      const d = groupDebt.get(c.childId) || { total: 0, months: 0 };
      groupDebt.set(c.childId, { total: d.total + c.due, months: d.months + 1 });
    }
  }
  // …and a clicked camp row shows the children registered to that camp
  const selCamp = !selGroup && sp.c ? camps.find(({ a }) => String(a.id) === sp.c)?.a : undefined;
  const campKids = selCamp
    ? charges.filter((c) => c.activityId === selCamp.id).sort((a, b) => a.childName.localeCompare(b.childName, 'he'))
    : [];
  const sel = selGroup
    ? { title: `הילדים בחוג ${groupLabel(selGroup)}`, color: selGroup.color || '#5C5A66', square: false, kids: groupKids, empty: 'אין ילדים רשומים לקבוצה החודש', paidLabel: 'שילמו החודש' }
    : selCamp
      ? { title: `הילדים ב${selCamp.name || 'קייטנה'}`, color: selCamp.color || '#8E5BD9', square: true, kids: campKids, empty: 'אין ילדים רשומים לקייטנה', paidLabel: 'שילמו במלואו' }
      : null;

  // the selected group's/camp's children: inline panel on desktop, bottom sheet on phones
  const kidRows = sel && (
    <ul className="list-none m-0 p-0 flex flex-col">
      {sel.kids.map((c) => {
        const child = mp.children.get(c.childId);
        const debt = selGroup ? groupDebt.get(c.childId) : undefined;
        return (
          <li key={c.linkId} className="flex items-center gap-3 py-2.5 border-b border-[#EEEFF3]">
            <Link href={`/children/${c.childId}`} className="flex-1 min-w-0 flex items-center gap-2.5 text-ink no-underline font-medium">
              <GenderIcon gender={child?.gender ?? null} />{c.childName}
            </Link>
            {selGroup ? (
              debt
                ? <span className="chip bg-bad-soft text-bad" title="כל החודשים שעוד לא שולמו בחוג הזה, כולל החודש">חוב {fmtMoney(debt.total)}{debt.months > 1 ? ` · ${debt.months} חודשים` : ''}</span>
                : <StatusChip status="paid" />
            ) : (
              <>
                <span className="text-sm text-muted">{fmtMoney(c.price)}</span>
                <StatusChip status={c.status} />
              </>
            )}
          </li>
        );
      })}
      {!sel.kids.length && <li className="text-muted py-3">{sel.empty}</li>}
    </ul>
  );
  const kidSummary = sel && `${sel.kids.length} ילדים · ${sel.kids.filter((c) => c.status === 'paid').length} ${sel.paidLabel}${selGroup && groupDebt.size > 0 ? ` · ${groupDebt.size} עם חוב בחוג, סה״כ ${fmtMoney([...groupDebt.values()].reduce((t, d) => t + d.total, 0))}` : ''}`;

  return (
    <>
      <PageHeader title="לוח בקרה" sub={`יום ${hebrewWeekday(m.today)}, ${fmtDate(m.today)} · חודש גבייה: ${monthName(m.today)}`}
        lead={<img src="/logo.png" alt="לוגו סטודיו ידיים" className="w-11 h-11 rounded-[13px] object-cover" />}
        mobile={<>
          <MobileMenu morningOk={morningConfigured()} email={access.ok ? access.email : ''} />
          <Link href="/children/new" aria-label="הוספת ילד/ה" title="אפתח טופס רישום" className={iconBtn}><PlusIcon /></Link>
        </>}>
        <Link href="/payments" className="btn-secondary no-underline" title="אקרא את צילום המסך ואזהה עבור מי התשלום">קריאת צילום תשלום</Link>
        <Link href="/children/new" className="btn-primary no-underline" title="אפתח טופס רישום ואצור לקוח חדש ב-Morning">הוספת ילד/ה</Link>
      </PageHeader>

      <Link href="/payments" title="אקרא את צילום המסך ואזהה עבור מי התשלום" className="md:hidden flex items-center gap-3.5 p-4 rounded-[18px] bg-nav text-white no-underline">
        <span className="w-12 h-12 rounded-[14px] bg-nav-active flex items-center justify-center flex-none">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><rect x="3" y="6" width="18" height="14" rx="2.5" /><circle cx="12" cy="13" r="3.5" /><path d="M8.5 6l1.5-2h4l1.5 2" /></svg>
        </span>
        <span className="flex-1 flex flex-col gap-0.5">
          <span className="font-semibold">קריאת צילום תשלום</span>
          <span className="text-[13px] text-[#B9B7C2]">שתפי צילום מפייבוקס או מהבנק — אני אפיק קבלה</span>
        </span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M15 6l-6 6 6 6" /></svg>
      </Link>

      <section aria-label="מדדים" className="grid gap-2.5 md:gap-3 grid-cols-2 md:grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
        <Kpi label={`נגבה ב${monthName(m.today)}`} value={fmtMoney(collected)} sub={`${monthCharges.filter((c) => c.status === 'paid').length} מתוך ${monthCharges.length} חיובי חוג`} tone="text-ok" />
        <Kpi label="חוב פתוח" value={fmtMoney(openTotal)} sub={`${debts.length} משפחות · ${openCount} חיובים`} tone="text-bad" />
        <Kpi label="ילדים פעילים" value={String(activeKids)} sub={`${m.groups.length} קבוצות חוג`} tone="text-muted" />
        <Kpi label="קבלות אחרונות" value={String(recent.length)} sub={recent[0] ? `אחרונה ${fmtDate(recent[0].created_at.slice(0, 10))}` : 'עוד לא הפקתי'} tone="text-muted" />
      </section>

      <div className="flex flex-wrap gap-4 items-start">
        <section aria-labelledby="groups-h" className="card flex-[3_1_460px] min-w-0 flex flex-col gap-3.5">
          <div className="flex justify-between items-center gap-2 flex-wrap">
            <h2 id="groups-h" className="m-0 text-[17px] md:text-[19px]"><span className="hidden md:inline">קבוצות החוג · {monthName(m.today)}</span><span className="md:hidden">קבוצות וקייטנות</span></h2>
            <Link href="/activities" className="hidden md:inline text-sm">ניהול פעילויות</Link>
            <span className="md:hidden text-xs text-muted">הקישי לראות מי בפנים</span>
          </div>
          <div className="grid gap-2 md:gap-3 grid-cols-2 md:grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
            {groups.map(({ g, count, paid, unpaid, price }) => (
              <Link key={g.id} href={selGroup?.id === g.id ? '/' : `/?g=${g.id}`} title="אציג את הילדים בקבוצה" aria-current={selGroup?.id === g.id ? 'true' : undefined} className={`no-underline text-ink rounded-[14px] p-3 md:p-4 flex flex-col gap-2 md:gap-2.5 hover:bg-page ${selGroup?.id === g.id ? 'border-2 border-accent bg-[#F7F8FF]' : 'border border-line'}`}>
                <span className="flex items-center gap-2.5"><Dot color={g.color || '#5C5A66'} size={12} /><span className="font-semibold">{groupLabel(g)}</span></span>
                <span className="hidden md:inline text-[13px] text-muted">{count} ילדים{price != null ? ` · ${fmtMoney(price)} לחודש` : ''}</span>
                <span className="h-1.5 md:h-2 rounded bg-[#ECEDF2] overflow-hidden flex">
                  <span className="h-1.5 md:h-2" style={{ width: count ? `${(paid / count) * 100}%` : 0, background: g.color || '#5C5A66' }} />
                </span>
                <span className="text-xs md:text-[13px] text-muted"><span className="hidden md:inline">{paid} שילמו · {unpaid} ממתינים</span><span className="md:hidden">{paid}/{count} שילמו</span></span>
              </Link>
            ))}
            {!groups.length && <p className="text-muted m-0">עוד אין קבוצות חוג. <Link href="/activities">אפשר לפתוח אחת כאן</Link></p>}
          </div>
          {camps.map(({ a, count, deposit, partial, open }) => (
            <Link key={a.id} href={selCamp?.id === a.id ? '/' : `/?c=${a.id}`} title="אציג את הילדים בקייטנה" aria-current={selCamp?.id === a.id ? 'true' : undefined}
              className={`no-underline text-ink rounded-[14px] p-3 md:p-4 flex flex-wrap gap-2 md:gap-3 items-center justify-between hover:bg-page ${selCamp?.id === a.id ? 'border-2 border-accent bg-[#F7F8FF]' : 'border border-line'}`}>
              <span className="flex items-center gap-2.5 flex-wrap">
                <Dot color={a.color || '#8E5BD9'} size={12} square />
                <b>{a.name}</b>
                <span className="text-[13px] text-muted">{fmtDate(a.start_date)}–{fmtDate(a.end_date)} · {count} נרשמו</span>
              </span>
              <span className="flex gap-1.5 flex-wrap">
                {deposit > 0 && <span className="chip bg-accent-soft text-accent-dark">{deposit} שילמו מקדמה</span>}
                {partial > 0 && <span className="chip bg-warn-soft text-warn">{partial} שילמו חלקית</span>}
                {open > 0 && <span className="chip bg-bad-soft text-bad">{open} טרם שילמו</span>}
              </span>
            </Link>
          ))}
        </section>

        {sel && (
          <section aria-labelledby="group-kids-h" className="card flex-[2_1_340px] min-w-0 hidden md:flex flex-col gap-3">
            <div className="flex justify-between items-center gap-2">
              <h2 id="group-kids-h" className="m-0 text-[19px] flex items-center gap-2.5">
                <Dot color={sel.color} size={12} square={sel.square} />{sel.title}
              </h2>
              <Link href="/" aria-label="סגירה — חזרה לחובות לפי משפחה" title="אחזור להצגת החובות לפי משפחה" className="w-11 h-11 rounded-xl border border-line bg-white text-ink flex items-center justify-center no-underline">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
              </Link>
            </div>
            {kidRows}
            <span className="text-[13px] text-muted">{kidSummary}</span>
          </section>
        )}
        {sel && (
          <Sheet title={sel.title} marker={<Dot color={sel.color} size={12} square={sel.square} />} closeHref="/" footer={kidSummary}>{kidRows}</Sheet>
        )}
        {/* family debts: desktop shows them unless a group/camp panel is open; phones always (the panel is a sheet) */}
        <section aria-labelledby="debt-h" className={`card flex-[2_1_340px] min-w-0 flex-col gap-3 ${sel ? 'flex md:hidden' : 'flex'}`}>
          <div className="flex justify-between items-center gap-2">
            <h2 id="debt-h" className="m-0 text-[17px] md:text-[19px]">חובות לפי משפחה</h2>
            {debts.length > 0 && <span className="chip bg-bad-soft text-bad">{debts.length} משפחות · {fmtMoney(openTotal)}</span>}
          </div>
          <ul className="list-none m-0 p-0 flex flex-col">
            {debts.slice(0, 6).map((d) => (
              <li key={d.payerId} className="flex items-center gap-3 py-2.5 border-b border-[#EEEFF3]">
                <span className="flex gap-0.5 flex-none">{[...new Set(d.charges.map((c) => c.color))].map((c) => <span key={c} className="w-1.5 md:w-2 h-7 md:h-[22px] rounded" style={{ background: c }} />)}</span>
                <span className="flex-1 min-w-0 flex flex-col">
                  <span className="font-medium">{d.payer?.name || 'ללא משלם'}</span>
                  <span className="text-xs md:text-[13px] text-muted">{d.childFirstNames.join(', ')} · {d.charges.length} חיובים</span>
                </span>
                <b>{fmtMoney(d.total)}</b>
                <Link href={`/reminders?p=${d.payerId}`} aria-label={`תזכורת ל${d.payer?.name || ''}`} title="אכין הודעה מרוכזת" className="w-11 h-11 rounded-xl bg-ok-soft text-wa flex items-center justify-center"><WhatsAppIcon size={20} /></Link>
              </li>
            ))}
            {!debts.length && <li className="text-muted py-3">אין חובות פתוחים — כולם שילמו</li>}
          </ul>
          {debts.length > 0 && <Link href="/reminders" className="btn-wa no-underline">הכנת תזכורות לכל {debts.length} המשפחות</Link>}
        </section>
      </div>

      <section aria-labelledby="recent-h" className="card flex flex-col gap-3">
        <div className="flex justify-between items-center gap-2 flex-wrap">
          <h2 id="recent-h" className="m-0 text-[17px] md:text-[19px]">תשלומים אחרונים</h2>
          <Link href="/payments" className="text-sm">לכל התשלומים</Link>
        </div>
        <ul className="md:hidden list-none m-0 p-0 flex flex-col">
          {recent.map((r) => (
            <li key={r.id} className="flex items-center gap-2.5 py-2 border-b border-[#EEEFF3]">
              <MethodIcon method={r.method} size={28} />
              <span className="flex-1 min-w-0 flex flex-col">
                <span className="font-medium text-sm">{(r.payer_id && mp.payers.get(r.payer_id)?.name) || r.raw_name}</span>
                <span className="text-xs text-muted">{fmtDate(r.paid_at || r.created_at.slice(0, 10))}{r.morning_document_number ? <> · {r.morning_document_url ? <a href={r.morning_document_url} target="_blank" rel="noopener">קבלה {r.morning_document_number}</a> : `קבלה ${r.morning_document_number}`}</> : ''}</span>
              </span>
              <b className="text-sm">{fmtMoney(r.amount)}</b>
            </li>
          ))}
          {!recent.length && <li className="text-muted text-sm py-2">עוד לא הפקתי קבלות דרך המערכת</li>}
        </ul>
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-[15px]">
            <thead><tr><th className="th">תאריך</th><th className="th">משלם/ת</th><th className="th">אמצעי</th><th className="th">סכום</th><th className="th">קבלה ב-Morning</th></tr></thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.id}>
                  <td className="td text-muted">{fmtDate(r.paid_at || r.created_at.slice(0, 10))}</td>
                  <td className="td font-medium">{(r.payer_id && mp.payers.get(r.payer_id)?.name) || r.raw_name}</td>
                  <td className="td"><Method method={r.method} /></td>
                  <td className="td font-semibold">{fmtMoney(r.amount)}</td>
                  <td className="td">{r.morning_document_url ? <a href={r.morning_document_url} target="_blank" rel="noopener" className="chip bg-ok-soft text-ok no-underline">קבלה {r.morning_document_number}</a> : <span className="chip bg-ok-soft text-ok">קבלה {r.morning_document_number || ''}</span>}</td>
                </tr>
              ))}
              {!recent.length && <tr><td className="td text-muted" colSpan={5}>עוד לא הפקתי קבלות דרך המערכת</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: string }) {
  return (
    <div className="bg-white rounded-2xl md:rounded-[18px] p-3.5 md:p-5 flex flex-col gap-1 md:gap-2 border border-line min-w-0">
      <span className="text-[13px] md:text-sm text-muted">{label}</span>
      <span className="text-2xl md:text-[30px] font-bold">{value}</span>
      <span className={`text-xs md:text-[13px] ${tone}`}>{sub}</span>
    </div>
  );
}
