'use client';

import { useEffect, useRef, useState } from 'react';
import { setJoinMonthPrice } from '@/app/actions';
import { fmtDate, joinMonthPrice, monthEnd, monthLabel } from '@/lib/dates';
import { DateField } from './DateField';

export type JoinInfo = {
  linkId: number;
  /** first day of the join month, YYYY-MM-DD */
  month: string;
  price: number;
  /** the month has a payment: price and date are locked */
  locked: boolean;
  /** full monthly price the lessons-left share is taken from (next month's price, else the activity's) */
  base: number;
  /** class_groups.day */
  day: string | null;
};

/**
 * Under the current group, while this is the child's join month: that month's price (editable)
 * and a join-date edit that recalculates it. Lives inside the שיבוץ form, so it saves through its own formAction.
 */
export function JoinMonth({ info }: { info: JoinInfo }) {
  const [price, setPrice] = useState(String(info.price));
  const [editDate, setEditDate] = useState(false);
  const [date, setDate] = useState('');
  const [calc, setCalc] = useState<string | null>(null);
  const save = useRef<HTMLButtonElement>(null);
  // picking a join date saves the recalculated price at once (after the price box has re-rendered)
  const [autoSave, setAutoSave] = useState(false);
  useEffect(() => {
    if (!autoSave) return;
    setAutoSave(false);
    const b = save.current;
    console.log('[join price] saving', { link: info.linkId, price: b?.form?.querySelector<HTMLInputElement>('[name=join_price]')?.value });
    b?.form?.requestSubmit(b);
  }, [autoSave, info.linkId]);

  if (info.locked) {
    return (
      <div className="basis-full flex flex-wrap items-center gap-2 pt-2 border-t border-line text-sm">
        <span className="text-muted">חודש ההצטרפות · {monthLabel(info.month)}</span>
        <b>₪{info.price}</b>
        <span className="chip bg-ok-soft text-ok !text-xs">שולם</span>
      </div>
    );
  }

  const onDate = (iso: string) => {
    setDate(iso);
    if (!iso) { setCalc(null); return; }
    const r = joinMonthPrice(info.base, info.day, iso);
    if (!r) { setCalc('לא זיהיתי את יום החוג — אפשר להקליד מחיר'); return; }
    if (!r.left) { setCalc(`לא נשארו שיעורים בחודש מ-${fmtDate(iso)} — לא שמרתי`); return; }
    setPrice(String(r.price));
    setCalc(`${r.left} מתוך ${r.total} שיעורים × ₪${info.base} = ₪${r.price} · שומרת…`);
    setAutoSave(true);
  };

  return (
    <div className="basis-full flex flex-col gap-2 pt-2 border-t border-line">
      <input type="hidden" name="join_link" value={info.linkId} />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label className="flex items-center gap-2">
          <span className="text-muted">מחיר חודש ההצטרפות · {monthLabel(info.month)}</span>
          <input
            name="join_price"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); save.current?.click(); } }}
            inputMode="decimal"
            aria-label="מחיר חודש ההצטרפות"
            className="w-20 min-h-9 px-2 rounded-lg border border-line-strong bg-white"
          />
        </label>
        <button ref={save} formAction={setJoinMonthPrice} formNoValidate className="text-sm text-accent bg-transparent border-0 cursor-pointer min-h-9" title="אעדכן את המחיר של חודש ההצטרפות">עדכון</button>
        {!editDate && (
          <button type="button" onClick={() => setEditDate(true)} className="text-sm text-accent-dark bg-transparent border-0 cursor-pointer min-h-9 underline">עריכת תאריך הצטרפות</button>
        )}
      </div>
      {editDate && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">תאריך הצטרפות</span>
          <DateField value={date} onChange={onDate} min={info.month} max={monthEnd(info.month)} ariaLabel="תאריך הצטרפות" />
          <button type="button" onClick={() => { setEditDate(false); setDate(''); setCalc(null); setPrice(String(info.price)); }} className="text-sm text-muted bg-transparent border-0 cursor-pointer min-h-9">ביטול</button>
        </div>
      )}
      {calc && <span className="text-xs text-muted">{calc}</span>}
    </div>
  );
}
