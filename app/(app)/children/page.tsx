import Link from 'next/link';
import { loadModel } from '@/lib/data';
import { allCharges, childName, familyDebts, fmtMoney, groupLabel, isClass, maps, type Charge } from '@/lib/billing';
import { monthName, monthStart } from '@/lib/dates';
import { normName } from '@/lib/matching';
import { Dot, GenderIcon, PageHeader, PlusIcon } from '@/components/ui';
import { Flash } from '@/components/Flash';
import { NavSelect } from '@/components/NavSelect';
import { LiveSearch, type Suggestion } from '@/components/LiveSearch';

type SP = { q?: string; g?: string; future?: string; ok?: string; err?: string };

const CELL = {
  paid: { bg: '#2E9E62', border: 'none', fg: '#fff', t: 'שולם' },
  unpaid: { bg: '#D64534', border: 'none', fg: '#fff', t: 'לא שולם' },
  partial: { bg: '#E9A23B', border: 'none', fg: '#17161C', t: 'שולם חלקית' },
  deposit: { bg: '#3B6FD4', border: 'none', fg: '#fff', t: 'מקדמה' },
  future: { bg: '#fff', border: '1px solid #B5B7C4', fg: '#5C5A66', t: 'עתידי' },
};

export default async function ChildrenPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const m = await loadModel();
  const mp = maps(m);
  const showFuture = sp.future === '1';
  const charges = allCharges(m);
  const byChild = new Map<string, Charge[]>();
  for (const c of charges) byChild.set(c.childId, [...(byChild.get(c.childId) || []), c]);
  const debtByPayer = new Map(familyDebts(m).map((d) => [d.payerId, d]));
  const thisMonth = monthStart(m.today);
  const campList = m.activities.filter((a) => !isClass(a)).sort((a, b) => (b.start_date || '').localeCompare(a.start_date || ''));

  const q = normName(sp.q);
  // type-ahead dropdown: every child with the parent and phone it can be found by
  const suggestions: Suggestion[] = m.children
    .map((c) => {
      const payer = c.morning_customer_id ? mp.payers.get(c.morning_customer_id) : undefined;
      return { id: c.id, name: childName(c), sub: [payer?.name, payer?.phone].filter(Boolean).join(' · '), hay: `${childName(c)} ${payer?.name || ''} ${payer?.phone || ''}` };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'he'));
  const rows = m.children
    .map((c) => {
      const cs = byChild.get(c.id) || [];
      const groupIds = [...new Set(cs.filter((x) => x.isClass).map((x) => mp.activities.get(x.activityId)?.class_group_id).filter(Boolean))] as string[];
      const camps = [...new Map(cs.filter((x) => !x.isClass).map((x) => [x.activityId, x])).values()];
      const payer = c.morning_customer_id ? mp.payers.get(c.morning_customer_id) : undefined;
      return { c, cs, groupIds, camps, payer };
    })
    .filter(({ c, groupIds, camps, payer }) => {
      if (q && !normName(`${childName(c)} ${payer?.name || ''} ${payer?.phone || ''}`).includes(q)) return false;
      if (sp.g === 'camps') return camps.length > 0;
      if (sp.g?.startsWith('camp:')) return camps.some((x) => String(x.activityId) === sp.g!.slice(5));
      if (sp.g) return groupIds.includes(sp.g);
      return true;
    })
    .sort((a, b) => childName(a.c).localeCompare(childName(b.c), 'he'));

  const link = (patch: Partial<SP>) => {
    const p = new URLSearchParams();
    const merged = { q: sp.q, g: sp.g, future: sp.future, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `/children${p.size ? '?' + p : ''}`;
  };

  // One line per activity: each class group (its months), then each camp — shared by the table and the phone cards
  const subsOf = ({ cs, groupIds, camps }: { cs: Charge[]; groupIds: string[]; camps: Charge[] }) => [
    ...groupIds.map((gid) => {
      const months = cs.filter((x) => x.isClass && mp.activities.get(x.activityId)?.class_group_id === gid && (showFuture || x.started));
      const cur = months.find((x) => x.month === thisMonth);
      const g = mp.groups.get(gid);
      return { key: `g-${gid}`, color: g?.color || '#5C5A66', label: groupLabel(g), priced: cur, months, camp: undefined as Charge | undefined };
    }),
    ...camps.map((x) => ({ key: `c-${x.activityId}`, color: x.color, label: x.shortLabel, priced: x, months: undefined as Charge[] | undefined, camp: x })),
  ];
  const campCell = (x: Charge) => CELL[x.started || x.status !== 'unpaid' ? x.status : 'future'];
  const shortMonth = (iso: string | null) => { const n = monthName(iso); return n.length > 3 ? `${n.slice(0, 3)}׳` : n; };

  const priceNote = (ch: Charge | undefined) => {
    if (!ch) return null;
    const l = m.links.find((x) => x.id === ch.linkId);
    if (l?.price == null) return { t: 'מחיר מלא', cls: 'text-muted' };
    if (m.settings.default_discount_price != null && Number(l.price) === Number(m.settings.default_discount_price)) return { t: 'מחיר מוזל', cls: 'text-accent-dark' };
    return { t: 'מחיר מותאם', cls: 'text-warn' };
  };

  return (
    <>
      <PageHeader title="ילדים" sub={`${m.children.length} ילדים רשומים · ${new Set(m.children.map((c) => c.morning_customer_id)).size} משפחות משלמות`}>
        <Link href="/children/new" className="btn-primary no-underline" title="אפתח טופס רישום ואצור לקוח חדש ב-Morning">+ הוספת ילד/ה</Link>
      </PageHeader>
      <Flash ok={sp.ok} err={sp.err} />

      <div className="flex flex-wrap gap-2.5 items-center">
        <div className="flex-[1_1_260px] max-md:basis-full">
          <div role="search" className="relative flex items-center gap-2 min-h-11 px-3.5 rounded-xl bg-white border border-line-strong" title="אחפש לפי שם ילד/ה, הורה או טלפון">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5C5A66" strokeWidth="1.8" aria-hidden><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
            <LiveSearch suggestions={suggestions} defaultValue={sp.q || ''} placeholder="חיפוש לפי שם ילד/ה, הורה או טלפון" />
          </div>
        </div>
        {/* phones: one row that scrolls sideways, edge to edge */}
        <div role="group" aria-label="סינון לפי פעילות" className="flex flex-nowrap md:flex-wrap gap-1.5 max-md:overflow-x-auto max-md:-mx-4 max-md:px-4 max-md:pb-0.5 max-md:w-[calc(100%+2rem)] [&>*]:flex-none">
          <FilterChip href={link({ g: undefined })} on={!sp.g} color="#17161C">הכול</FilterChip>
          {m.groups.map((g) => <FilterChip key={g.id} href={link({ g: g.id })} on={sp.g === g.id} color={g.color || '#5C5A66'}>{groupLabel(g)}</FilterChip>)}
          <NavSelect
            label="סינון לפי קייטנה"
            placeholder="קייטנות"
            on={sp.g === 'camps' || !!sp.g?.startsWith('camp:')}
            value={sp.g === 'camps' || sp.g?.startsWith('camp:') ? sp.g : ''}
            options={[
              { value: 'camps', label: 'כל הקייטנות', href: link({ g: 'camps' }) },
              ...campList.map((a) => ({ value: `camp:${a.id}`, label: a.name || 'קייטנה', href: link({ g: `camp:${a.id}` }) })),
            ]}
          />
        </div>
      </div>

      <div className="md:hidden flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-2.5 text-[11px] text-muted">
          {(['paid', 'unpaid', 'partial', 'deposit'] as const).map((k) => <span key={k} className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: CELL[k].bg }} />{CELL[k].t}</span>)}
          <Link href={link({ future: showFuture ? undefined : '1' })} className="ms-auto chip !text-xs border border-line-strong bg-white text-accent-dark no-underline min-h-8" title="אציג או אסתיר את החודשים שעוד לא התחילו">
            {showFuture ? 'הסתרת עתידיים' : 'חודשים עתידיים'}
          </Link>
        </div>
        {rows.map(({ c, cs, groupIds, camps, payer }) => {
          const debt = c.morning_customer_id ? debtByPayer.get(c.morning_customer_id) : undefined;
          const subs = subsOf({ cs, groupIds, camps });
          return (
            <article key={c.id} className="bg-white border border-line rounded-2xl px-3.5 py-3 flex flex-col gap-2.5">
              <div className="flex items-center gap-2.5">
                <GenderIcon gender={c.gender} size={40} />
                <Link href={`/children/${c.id}`} className="flex-1 min-w-0 flex flex-col no-underline text-ink">
                  <span className="font-semibold">{childName(c)}</span>
                  <span className="text-xs text-muted truncate">{payer?.name || '—'}{payer?.phone ? <> · <span dir="ltr">{payer.phone}</span></> : null}</span>
                </Link>
                <span className="flex flex-col items-end flex-none">
                  <span className="text-[11px] text-muted">חוב משפחתי</span>
                  {debt ? <Link href={`/reminders?p=${debt.payerId}`} className="font-bold text-[15px] text-bad no-underline">{fmtMoney(debt.total)}</Link> : <b className="text-[15px] text-muted">—</b>}
                </span>
              </div>
              {subs.length > 0 && (
                <div className="flex flex-col border-t border-[#EEEFF3]">
                  {subs.map((s) => {
                    const note = priceNote(s.priced);
                    return (
                      <div key={s.key} className="flex items-center gap-2 min-h-10 py-1 border-b border-[#F1F2F5]">
                        <span className="flex-1 min-w-0 inline-flex items-center gap-1.5 text-[13px]">
                          <Dot color={s.color} size={8} />{s.label}
                          {s.priced && <span className="text-xs text-muted">· {fmtMoney(s.priced.price)}{note && note.t !== 'מחיר מלא' ? ` · ${note.t.replace('מחיר ', '')}` : ''}</span>}
                        </span>
                        {s.months ? (
                          <span className="flex gap-[3px] flex-wrap justify-end" aria-label="תשלומים חודשיים">
                            {s.months.map((x) => {
                              const st = CELL[x.started ? x.status : 'future'];
                              const tip = `${monthName(x.month)} · ${st.t}`;
                              return <span key={x.linkId} role="img" aria-label={tip} title={tip} className="min-w-[34px] h-[22px] px-1 box-border rounded-md text-[11px] flex items-center justify-center" style={{ background: st.bg, border: st.border, color: st.fg }}>{shortMonth(x.month)}</span>;
                            })}
                            {!s.months.length && <span className="text-muted text-xs">—</span>}
                          </span>
                        ) : s.camp ? (
                          <span className="flex flex-col items-end gap-0.5 flex-none">
                            <span className="chip !text-[11px] !px-2 !py-0.5" style={{ background: campCell(s.camp).bg, border: campCell(s.camp).border, color: campCell(s.camp).fg }}>{campCell(s.camp).t}</span>
                            {s.camp.status !== 'paid' && s.camp.paid > 0 && <span className="text-[11px] text-muted">שולם {fmtMoney(s.camp.paid)} מתוך {fmtMoney(s.camp.price)}</span>}
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
              <Link href={`/children/${c.id}`} title={`אפתח את ${c.first_name || ''} לעריכה — כולל הפסקת השתתפות`} className="self-start min-h-9 inline-flex items-center gap-1.5 text-[13px] no-underline">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M4 20h4L19 9l-4-4L4 16z" /></svg>עריכה וחיובים
              </Link>
            </article>
          );
        })}
        {!rows.length && <p className="text-muted text-sm m-0">לא מצאתי ילדים שמתאימים לחיפוש</p>}
      </div>

      <Link href="/children/new" title="אפתח טופס רישום" className="md:hidden fixed left-4 bottom-24 z-20 h-14 px-5 rounded-full bg-accent text-white text-[15px] font-semibold flex items-center gap-2 no-underline shadow-[0_6px_18px_rgba(52,70,196,0.35)]">
        <PlusIcon />ילד/ה חדש/ה
      </Link>

      <div className="card !p-3 overflow-x-auto hidden md:block">
        <div className="flex flex-wrap items-center gap-3.5 px-2.5 pb-2 text-xs text-muted">
          {(['paid', 'unpaid', 'partial', 'deposit'] as const).map((k) => <span key={k} className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-[3px]" style={{ background: CELL[k].bg }} />{CELL[k].t}</span>)}
          {showFuture && <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-[3px] box-border" style={{ border: CELL.future.border }} />עתידי</span>}
          <Link href={link({ future: showFuture ? undefined : '1' })} className="ms-auto chip border border-line-strong bg-white text-accent-dark no-underline min-h-9" title="אציג או אסתיר את החודשים שעוד לא התחילו">
            {showFuture ? 'הסתרת חודשים עתידיים' : 'הצגת חודשים עתידיים'}
          </Link>
        </div>
        <table className="w-full min-w-[880px] border-collapse text-[15px]">
          <thead>
            <tr>
              <th className="th">ילד/ה</th><th className="th">פעילות</th><th className="th">משלם/ת (Morning)</th>
              <th className="th">מחיר</th><th className="th">תשלומים</th><th className="th">חוב משפחתי</th>
              <th className="th"><span className="sr-only">פעולות</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ c, cs, groupIds, camps, payer }) => {
              const debt = c.morning_customer_id ? debtByPayer.get(c.morning_customer_id) : undefined;
              const subs = subsOf({ cs, groupIds, camps });
              const span = Math.max(subs.length, 1);
              const spanned = (
                <>
                  <td className="td align-top" rowSpan={span}>
                    <div className="flex flex-col"><span>{payer?.name || '—'}</span><span className="text-xs text-muted" dir="ltr">{payer?.phone}</span></div>
                  </td>
                </>
              );
              const tail = (
                <>
                  <td className="td align-top" rowSpan={span}>{debt ? <Link href={`/reminders?p=${debt.payerId}`} className="font-semibold text-bad no-underline" title={debt.charges.map((x) => `${x.childFirst} · ${x.label}`).join('\n')}>{fmtMoney(debt.total)}</Link> : <span className="text-muted">—</span>}</td>
                  <td className="td align-top" rowSpan={span}><Link href={`/children/${c.id}`} aria-label={`עריכת ${childName(c)}`} title={`אפתח את ${c.first_name || ''} לעריכה — כולל הפסקת השתתפות`} className="w-11 h-11 rounded-xl border border-line bg-white text-ink flex items-center justify-center"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M4 20h4L19 9l-4-4L4 16z" /></svg></Link></td>
                </>
              );
              const nameCell = (
                <td className="td align-top" rowSpan={span}>
                  <Link href={`/children/${c.id}`} className="flex items-center gap-2.5 text-ink no-underline font-medium"><GenderIcon gender={c.gender} />{childName(c)}</Link>
                </td>
              );
              if (!subs.length) {
                return (
                  <tr key={c.id} className="border-t-2 border-line">
                    {nameCell}<td className="td text-muted">—</td>{spanned}<td className="td text-muted">—</td><td className="td text-muted">—</td>{tail}
                  </tr>
                );
              }
              return subs.map((s, i) => {
                const note = priceNote(s.priced);
                return (
                  <tr key={`${c.id}-${s.key}`} className={i === 0 ? 'border-t-2 border-line' : ''}>
                    {i === 0 && nameCell}
                    <td className="td"><span className="chip bg-page"><Dot color={s.color} size={8} />{s.label}</span></td>
                    {i === 0 && spanned}
                    <td className="td">{s.priced ? <div className="flex flex-col"><b>{fmtMoney(s.priced.price)}</b>{note && <span className={`text-xs ${note.cls}`}>{note.t}</span>}</div> : <span className="text-muted">—</span>}</td>
                    <td className="td">
                      {s.months ? (
                        <div className="flex gap-[3px]">
                          {s.months.map((x) => {
                            const k = x.started ? x.status : 'future';
                            const st = CELL[k];
                            const tip = `${monthName(x.month)} · ${st.t}`;
                            return <span key={x.linkId} role="img" aria-label={tip} title={tip} className="w-5 h-6 rounded-[5px] box-border flex items-center justify-center text-[10px]" style={{ background: st.bg, border: st.border, color: st.fg }}>{monthName(x.month).charAt(0)}</span>;
                          })}
                          {!s.months.length && <span className="text-muted text-sm">—</span>}
                        </div>
                      ) : s.camp ? (
                        (() => {
                          const x = s.camp;
                          const k = x.started || x.status !== 'unpaid' ? x.status : 'future';
                          const st = CELL[k];
                          return (
                            <div className="flex items-center gap-2">
                              <span className="chip" style={{ background: st.bg, border: st.border, color: st.fg }}>{st.t}</span>
                              {k !== 'paid' && x.paid > 0 && <span className="text-xs text-muted">שולם {fmtMoney(x.paid)} מתוך {fmtMoney(x.price)}</span>}
                            </div>
                          );
                        })()
                      ) : null}
                    </td>
                    {i === 0 && tail}
                  </tr>
                );
              });
            })}
            {!rows.length && <tr><td className="td text-muted" colSpan={7}>לא מצאתי ילדים שמתאימים לחיפוש</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

function FilterChip({ href, on, color, children }: { href: string; on: boolean; color: string; children: React.ReactNode }) {
  return (
    <Link href={href} aria-current={on ? 'true' : undefined} className={`inline-flex items-center gap-1.5 min-h-10 md:min-h-11 px-3 md:px-3.5 whitespace-nowrap rounded-full border text-sm text-ink no-underline ${on ? 'border-accent bg-accent-soft' : 'border-line-strong bg-white'}`}>
      <Dot color={color} size={8} />{children}
    </Link>
  );
}
