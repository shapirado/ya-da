// Date helpers. Display format is always DD/MM/YYYY; storage is ISO YYYY-MM-DD.

export const TZ = 'Asia/Jerusalem';

export const HEB_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

export const HEB_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

/** Today's date in Israel as YYYY-MM-DD. */
export function todayISO(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** YYYY-MM-DD → DD/MM/YYYY */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

/** Timestamp → DD/MM/YYYY HH:MM in Israel time. */
export function fmtDateTime(ts: string | null | undefined): string {
  if (!ts) return '—';
  const d = new Date(ts);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('day')}/${get('month')}/${get('year')} ${get('hour')}:${get('minute')}`;
}

/** "נובמבר 2026" from an ISO date. */
export function monthLabel(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m] = iso.split('-').map(Number);
  return `${HEB_MONTHS[m - 1]} ${y}`;
}

/** "נובמבר" only. */
export function monthName(iso: string | null | undefined): string {
  if (!iso) return '—';
  return HEB_MONTHS[Number(iso.split('-')[1]) - 1];
}

/** First day of the month containing iso, as YYYY-MM-01. */
export function monthStart(iso: string): string {
  return iso.slice(0, 7) + '-01';
}

/** Last day of the month containing iso. */
export function monthEnd(iso: string): string {
  const [y, m] = iso.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${iso.slice(0, 7)}-${String(last).padStart(2, '0')}`;
}

/** Adds n months to a YYYY-MM-01 date. */
export function addMonths(iso: string, n: number): string {
  const [y, m] = iso.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 10);
}

/** Inclusive list of month starts from `from` to `to`. */
export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let cur = monthStart(from);
  const last = monthStart(to);
  while (cur <= last && out.length < 36) {
    out.push(cur);
    cur = addMonths(cur, 1);
  }
  return out;
}

/** Season (Oct–Jun) that contains the given date: returns {start, end}. */
export function seasonFor(iso: string): { start: string; end: string } {
  const [y, m] = iso.split('-').map(Number);
  const startYear = m >= 7 ? y : y - 1;
  return { start: `${startYear}-10-01`, end: `${startYear + 1}-06-30` };
}

export function hebrewWeekday(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return HEB_DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}
