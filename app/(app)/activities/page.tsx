import Link from 'next/link';
import { loadModel } from '@/lib/data';
import { allCharges, fmtMoney, groupLabel, isClass } from '@/lib/billing';
import { addMonths, fmtDate, monthLabel, monthStart, seasonFor } from '@/lib/dates';
import { changeGroupPrice, createClassGroup, generateMonths, saveCamp, saveSettings, updateClassGroup } from '@/app/actions';
import { Dot, PageHeader, SWATCHES } from '@/components/ui';
import { Flash } from '@/components/Flash';
import { SubmitButton } from '@/components/SubmitButton';

type SP = { g?: string; future?: string; camp?: string; ok?: string; err?: string };

export default async function ActivitiesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const m = await loadModel();
  const charges = allCharges(m);
  const groups = [...m.groups].sort((a, b) => groupLabel(a).localeCompare(groupLabel(b), 'he'));
  const newGroup = sp.g === 'new' || !groups.length;
  const sel = newGroup ? undefined : groups.find((g) => g.id === sp.g) || groups[0];
  const showFuture = sp.future === '1';
  const thisMonth = monthStart(m.today);
  const season = seasonFor(m.today);

  const months = sel ? m.activities.filter((a) => a.class_group_id === sel.id).sort((a, b) => (a.start_date || '').localeCompare(b.start_date || '')) : [];
  const visibleMonths = months.filter((a) => showFuture || !a.start_date || a.start_date <= m.today);
  const futureMonths = months.filter((a) => (a.start_date || '') >= thisMonth);
  const kidsIn = (gid: string) => new Set(charges.filter((c) => c.isClass && c.month === thisMonth && m.activities.find((a) => a.id === c.activityId)?.class_group_id === gid).map((c) => c.childId)).size;
  const camps = m.activities.filter((a) => !isClass(a)).sort((a, b) => (b.start_date || '').localeCompare(a.start_date || ''));
  const editCamp = sp.camp === 'new' ? 'new' : camps.find((c) => String(c.id) === sp.camp);
  const seasonMonths: string[] = [];
  for (let d = season.start; d <= season.end; d = addMonths(d, 1)) seasonMonths.push(d);
  const nextSeason = seasonFor(addMonths(season.end.slice(0, 8) + '01', 2));

  return (
    <>
      <PageHeader title="חוגים וקייטנות" sub="כל חוג מחולק לחודשים — רשומה לכל חודש. קייטנה היא רשומה אחת.">
        <Link href="/activities?g=new" className="btn-primary no-underline" title="אפתח קבוצת חוג חדשה ואצור לה את חודשי השנה">+ קבוצת חוג</Link>
        <Link href="/activities?camp=new#camp-form" className="btn-secondary no-underline" title="אפתח קייטנה חדשה כרשומה אחת">+ קייטנה</Link>
      </PageHeader>
      <Flash ok={sp.ok} err={sp.err} />

      <div className="flex flex-wrap gap-4 items-start">
        <section className="flex-[999_1_520px] min-w-0 flex flex-col gap-3.5">
          <form action={saveSettings} className="card !py-4 flex flex-wrap items-end gap-3.5">
            <div className="flex-[1_1_200px] flex flex-col gap-1">
              <h2 className="m-0 text-[17px]">מחירים כלליים</h2>
              <span className="text-[13px] text-muted">אשתמש בהם כשאני יוצרת חודשים חדשים ובמחיר מוזל לאחים</span>
            </div>
            <label className="label">מחיר מלא (₪)<input name="full" defaultValue={m.settings.default_full_price ?? ''} inputMode="decimal" className="input !w-28" /></label>
            <label className="label">מחיר מוזל (₪)<input name="discount" defaultValue={m.settings.default_discount_price ?? ''} inputMode="decimal" className="input !w-28" /></label>
            <SubmitButton className="btn-secondary" pending="שומרת…" title="חודשים שכבר נוצרו לא ישתנו">שמירה</SubmitButton>
          </form>

          <h2 className="mx-1 mt-1 mb-0 text-[17px] text-muted font-medium">קבוצות חוג</h2>
          <div className="grid gap-2.5 grid-cols-[repeat(auto-fit,minmax(190px,1fr))]">
            {groups.map((g) => {
              const on = g.id === sel?.id;
              return (
                <Link key={g.id} href={`/activities?g=${g.id}`} aria-current={on ? 'true' : undefined} title={`אציג את החודשים של ${groupLabel(g)}`}
                  className={`no-underline text-ink rounded-[14px] p-3.5 flex flex-col gap-2 ${on ? 'bg-[#F7F8FF] border-2 border-accent' : 'bg-white border border-line'}`}>
                  <span className="flex items-center gap-2.5"><Dot color={g.color || '#5C5A66'} size={14} square /><b className="text-[17px]">{groupLabel(g)}</b></span>
                  <span className="text-[13px] text-muted">{kidsIn(g.id)} ילדים החודש</span>
                </Link>
              );
            })}
          </div>

          {sel && (
            <section className="card !py-4 flex flex-col gap-2.5" aria-labelledby="months-h">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="months-h" className="m-0 text-lg">החודשים של {groupLabel(sel)}</h2>
                <Link href={`/activities?g=${sel.id}${showFuture ? '' : '&future=1'}`} className="chip border border-line-strong bg-white text-accent-dark no-underline min-h-10" title="אציג או אסתיר את החודשים שעוד לא התחילו">
                  {showFuture ? 'הסתרת חודשים עתידיים' : `הצגת ${months.length - visibleMonths.length} חודשים עתידיים`}
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] border-collapse text-[15px]">
                  <thead><tr><th className="th">חודש</th><th className="th">תאריכים</th><th className="th">מחיר</th><th className="th">רשומים</th><th className="th">שילמו</th><th className="th">מצב</th></tr></thead>
                  <tbody>
                    {visibleMonths.map((a) => {
                      const rows = charges.filter((c) => c.activityId === a.id);
                      const cur = a.start_date === thisMonth;
                      const past = (a.end_date || '') < m.today;
                      return (
                        <tr key={a.id} className={cur ? 'bg-[#FAFBFF]' : ''}>
                          <td className="td font-medium">{monthLabel(a.start_date)}</td>
                          <td className="td text-muted text-sm">{fmtDate(a.start_date)}–{fmtDate(a.end_date)}</td>
                          <td className="td font-semibold">{a.default_price != null ? fmtMoney(a.default_price) : '—'}</td>
                          <td className="td">{rows.length}</td>
                          <td className="td">{a.start_date && a.start_date <= m.today ? rows.filter((r) => r.status === 'paid').length : '—'}</td>
                          <td className="td"><span className={`chip ${cur ? 'bg-accent-soft text-accent-dark' : 'bg-page text-muted'}`}>{cur ? 'החודש' : past ? 'הסתיים' : 'עתידי'}</span></td>
                        </tr>
                      );
                    })}
                    {!visibleMonths.length && <tr><td className="td text-muted" colSpan={6}>אין חודשים שהתחילו — אפשר ליצור חודשים בצד</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <h2 className="mx-1 mt-2 mb-0 text-[17px] text-muted font-medium">קייטנות · רשומה אחת לכל קייטנה</h2>
          <div className="grid gap-2.5 grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
            {camps.map((c) => {
              const rows = charges.filter((x) => x.activityId === c.id);
              const over = (c.end_date || '9999') < m.today;
              return (
                <Link key={c.id} href={`/activities?camp=${c.id}${sel ? `&g=${sel.id}` : ''}#camp-form`} title="אפתח את הקייטנה לעריכה" className="no-underline text-ink bg-white border border-line rounded-[14px] p-4 flex flex-col gap-2.5">
                  <span className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2.5"><Dot color={c.color || '#8E5BD9'} size={14} square /><b>{c.name}</b></span>
                    <span className={`chip ${over ? 'bg-page text-muted' : 'bg-ok-soft text-ok'}`}>{over ? 'הסתיימה' : 'פתוחה'}</span>
                  </span>
                  <span className="text-muted text-sm">{fmtDate(c.start_date)}–{fmtDate(c.end_date)}</span>
                  <span className="text-sm"><b>{rows.length}</b> נרשמו · <b>{c.default_price != null ? fmtMoney(c.default_price) : '—'}</b></span>
                </Link>
              );
            })}
            {!camps.length && <p className="text-muted m-0">עוד אין קייטנות</p>}
          </div>
        </section>

        <aside className="flex-[1_1_360px] min-w-0 flex flex-col gap-4">
          {editCamp ? (
            <form id="camp-form" action={saveCamp} className="card flex flex-col gap-3">
              <h2 className="m-0 text-xl">{editCamp === 'new' ? 'קייטנה חדשה' : editCamp.name}</h2>
              {editCamp !== 'new' && <input type="hidden" name="id" value={editCamp.id} />}
              <label className="label">שם<input name="name" required defaultValue={editCamp === 'new' ? '' : editCamp.name || ''} className="input" /></label>
              <div className="grid grid-cols-2 gap-2.5">
                <label className="label">מתאריך<input type="date" name="start" defaultValue={editCamp === 'new' ? '' : editCamp.start_date || ''} className="input" /></label>
                <label className="label">עד תאריך<input type="date" name="end" defaultValue={editCamp === 'new' ? '' : editCamp.end_date || ''} className="input" /></label>
                <label className="label">מחיר (₪)<input name="price" inputMode="decimal" defaultValue={editCamp === 'new' ? '' : editCamp.default_price ?? ''} className="input" /></label>
                <label className="label">מזהה פריט ב-Morning<input name="item" dir="ltr" defaultValue={editCamp === 'new' ? '' : editCamp.morning_item_id || ''} className="input" placeholder="לא חובה" /></label>
              </div>
              <ColorPicker value={editCamp === 'new' ? '#8E5BD9' : editCamp.color || '#8E5BD9'} />
              <div className="flex gap-2.5">
                <SubmitButton pending="שומרת…" className="btn-primary flex-1">שמירה</SubmitButton>
                <Link href="/activities" className="btn-secondary no-underline">סגירה</Link>
              </div>
            </form>
          ) : newGroup ? (
            <form action={createClassGroup} className="card flex flex-col gap-3">
              <h2 className="m-0 text-xl">קבוצת חוג חדשה</h2>
              <div className="grid grid-cols-2 gap-2.5">
                <label className="label">יום<select name="day" className="input" defaultValue="ראשון">{['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'].map((d) => <option key={d}>{d}</option>)}</select></label>
                <label className="label">שעה<input name="time" placeholder="16:00" dir="ltr" required className="input text-right" /></label>
                <label className="label">מחודש<MonthSelect name="from" months={seasonMonths} value={thisMonth > season.start ? thisMonth : season.start} /></label>
                <label className="label">עד חודש<MonthSelect name="to" months={seasonMonths} value={season.end.slice(0, 8) + '01'} /></label>
                <label className="label">מחיר לחודש (₪)<input name="price" inputMode="decimal" placeholder={String(m.settings.default_full_price ?? '')} className="input" /></label>
              </div>
              <ColorPicker value="#3446C4" />
              <SubmitButton pending="פותחת קבוצה ויוצרת חודשים…">פתיחת קבוצה</SubmitButton>
            </form>
          ) : sel ? (
            <div className="card flex flex-col gap-4">
              <h2 className="m-0 text-xl flex items-center gap-2.5"><Dot color={sel.color || '#5C5A66'} size={16} square />{groupLabel(sel)}</h2>
              <form action={updateClassGroup} className="flex flex-col gap-2.5">
                <input type="hidden" name="id" value={sel.id} />
                <div className="grid grid-cols-2 gap-2.5">
                  <label className="label">יום<select name="day" className="input" defaultValue={sel.day || ''}>{['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'].map((d) => <option key={d}>{d}</option>)}</select></label>
                  <label className="label">שעה<input name="time" defaultValue={sel.time || ''} dir="ltr" className="input text-right" /></label>
                </div>
                <ColorPicker value={sel.color || '#3446C4'} />
                <SubmitButton className="btn-secondary" pending="שומרת…">שמירת פרטי הקבוצה</SubmitButton>
              </form>

              {futureMonths.length > 0 && (
                <form action={changeGroupPrice} className="flex flex-col gap-2.5 pt-4 border-t border-line">
                  <h3 className="m-0 text-[13px] font-semibold text-muted">שינוי מחיר באמצע השנה</h3>
                  <input type="hidden" name="id" value={sel.id} />
                  <div className="grid grid-cols-2 gap-2.5">
                    <label className="label">מחיר חדש (₪)<input name="price" inputMode="decimal" required className="input" /></label>
                    <label className="label">החל מחודש<MonthSelect name="from" months={futureMonths.map((a) => a.start_date!)} value={futureMonths[Math.min(1, futureMonths.length - 1)].start_date!} /></label>
                  </div>
                  <p className="m-0 p-3 rounded-xl bg-page text-[13px] leading-relaxed">אעדכן רק את החודש שתבחרי והחודשים שאחריו. חודשים שעברו וילדים עם מחיר מוזל או מותאם לא ישתנו.</p>
                  <SubmitButton pending="מעדכנת מחירים…" title="אעדכן את המחיר בחודשים הבאים בלבד">עדכון מחיר</SubmitButton>
                </form>
              )}

              <form action={generateMonths} className="flex flex-col gap-2.5 pt-4 border-t border-line">
                <h3 className="m-0 text-[13px] font-semibold text-muted">יצירת חודשים</h3>
                <input type="hidden" name="id" value={sel.id} />
                <p className="m-0 text-sm text-muted">יש לקבוצה {months.length} חודשים. אצור רק חודשים שחסרים בטווח.</p>
                <div className="grid grid-cols-2 gap-2.5">
                  <label className="label">מתאריך<input type="date" name="from" defaultValue={nextSeason.start} className="input" /></label>
                  <label className="label">עד<input type="date" name="to" defaultValue={nextSeason.end} className="input" /></label>
                </div>
                <label className="label">מחיר לחודש (₪)<input name="price" inputMode="decimal" placeholder={String(m.settings.default_full_price ?? '')} className="input" /></label>
                <SubmitButton className="btn-secondary" pending="יוצרת חודשים…" title="אצור רשומה לכל חודש שחסר">יצירת חודשים</SubmitButton>
              </form>
            </div>
          ) : null}
        </aside>
      </div>
    </>
  );
}

function MonthSelect({ name, months, value }: { name: string; months: string[]; value: string }) {
  return <select name={name} defaultValue={value} className="input">{months.map((d) => <option key={d} value={d}>{monthLabel(d)}</option>)}</select>;
}

function ColorPicker({ value }: { value: string }) {
  return (
    <fieldset className="border-0 m-0 p-0">
      <legend className="text-sm pb-1.5">צבע</legend>
      <div className="flex flex-wrap gap-2">
        {SWATCHES.map((hex) => (
          <label key={hex} className="cursor-pointer">
            <input type="radio" name="color" value={hex} defaultChecked={hex.toLowerCase() === value.toLowerCase()} className="peer sr-only" />
            <span className="block w-11 h-11 rounded-xl border-[3px] border-white peer-checked:border-ink peer-focus-visible:outline-2 peer-focus-visible:outline-accent" style={{ background: hex }} />
            <span className="sr-only">{hex}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
