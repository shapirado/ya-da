import type { Model } from '@/lib/billing';
import { fmtMoney, groupLabel, isClass } from '@/lib/billing';
import { addMonths, fmtDate, monthLabel, monthStart, seasonFor } from '@/lib/dates';
import { Dot } from './ui';

/** Class-group and camp checkboxes with a price choice each, plus the start month. */
export function EnrollFields({ m, exclude = { groups: [], camps: [] } }: { m: Model; exclude?: { groups: string[]; camps: number[] } }) {
  const full = m.settings.default_full_price;
  const disc = m.settings.default_discount_price;
  const season = seasonFor(m.today);
  const startMonths: string[] = [];
  for (let d = monthStart(m.today < season.start ? season.start : m.today); d <= season.end; d = addMonths(d, 1)) startMonths.push(d);
  const camps = m.activities.filter((a) => !isClass(a) && (!a.end_date || a.end_date >= m.today) && !exclude.camps.includes(a.id));
  const groups = m.groups.filter((g) => !exclude.groups.includes(g.id));

  return (
    <fieldset className="border-0 m-0 p-0 flex flex-col gap-2">
      <legend className="text-[13px] font-semibold text-muted pb-2">שיבוץ לפעילויות</legend>
      {groups.map((g) => (
        <div key={g.id} className="flex flex-wrap items-center gap-2.5 min-h-[52px] px-3 py-1.5 rounded-xl border border-line">
          <label className="flex-1 flex items-center gap-2.5 text-sm min-h-11 min-w-[150px]">
            <input type="checkbox" name="group" value={g.id} className="w-[18px] h-[18px] accent-accent" />
            <Dot color={g.color || '#5C5A66'} />חוג · {groupLabel(g)}
          </label>
          <PriceChoice name={`mode_${g.id}`} customName={`custom_${g.id}`} full={full} disc={disc} />
        </div>
      ))}
      {camps.map((a) => (
        <div key={a.id} className="flex flex-wrap items-center gap-2.5 min-h-[52px] px-3 py-1.5 rounded-xl border border-line">
          <label className="flex-1 flex items-center gap-2.5 text-sm min-h-11 min-w-[150px]">
            <input type="checkbox" name="camp" value={a.id} className="w-[18px] h-[18px] accent-accent" />
            <Dot color={a.color || '#8E5BD9'} square />{a.name} <span className="text-muted text-xs">{fmtDate(a.start_date)}</span>
          </label>
          <PriceChoice name={`mode_camp_${a.id}`} customName={`custom_camp_${a.id}`} full={a.default_price} disc={null} />
        </div>
      ))}
      {!groups.length && !camps.length && <p className="text-muted text-sm m-0">אין פעילויות פתוחות לשיבוץ</p>}
      {groups.length > 0 && (
        <label className="flex items-center gap-2.5 text-sm" title="אצור חיוב לכל חודש מהחודש שתבחרי ועד סוף השנה">
          מצטרף/ת לחוג מחודש
          <select name="from" defaultValue={startMonths[0]} className="input !w-auto">
            {startMonths.map((d) => <option key={d} value={d}>{monthLabel(d)}</option>)}
          </select>
        </label>
      )}
      <span className="text-xs text-muted">בחוג אצור חיוב לכל חודש עד סוף השנה; קייטנה היא חיוב אחד. ״מחיר מלא״ עוקב אחרי מחיר הפעילות.</span>
    </fieldset>
  );
}

function PriceChoice({ name, customName, full, disc }: { name: string; customName: string; full: number | null; disc: number | null }) {
  return (
    <span className="flex items-center gap-1.5 text-[13px] text-muted">
      <select name={name} aria-label="מחיר" className="min-h-9 px-1.5 rounded-lg border border-line-strong bg-white text-sm text-ink" title="אחייב לפי המחיר שתבחרי">
        <option value="full">מלא{full != null ? ` · ${fmtMoney(full)}` : ''}</option>
        {disc != null && <option value="discount">מוזל · {fmtMoney(disc)}</option>}
        <option value="custom">מחיר מותאם</option>
      </select>
      <input name={customName} inputMode="decimal" placeholder="₪" aria-label="מחיר מותאם" className="w-16 min-h-9 px-2 rounded-lg border border-line-strong text-sm" />
    </span>
  );
}
