'use client';

import { useRef, useState } from 'react';
import { setChargePrice } from '@/app/actions';
import { fmtMoney } from '@/lib/billing';

/** "₪260 ✎" — the pencil swaps to an inline input; Enter saves (setChargePrice), Esc cancels. */
export function PriceEdit({ childId, linkId, price, month }: { childId: string; linkId: number; price: number; month: string }) {
  const [edit, setEdit] = useState(false);
  const form = useRef<HTMLFormElement>(null);

  if (!edit) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span>{fmtMoney(price)}</span>
        <button type="button" onClick={() => setEdit(true)} aria-label={`עריכת המחיר של ${month}`} title="אשנה את המחיר של החודש הזה בלבד"
          className="w-7 h-7 grid place-items-center rounded-lg border-0 bg-transparent text-muted hover:bg-page hover:text-accent cursor-pointer">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M4 20h4L19 9l-4-4L4 16v4z" /><path d="M14 6l4 4" /></svg>
        </button>
      </span>
    );
  }

  return (
    <form ref={form} action={setChargePrice} className="inline-flex items-center gap-1.5">
      <input type="hidden" name="child" value={childId} />
      <input type="hidden" name="link" value={linkId} />
      <input
        name="price"
        defaultValue={price}
        autoFocus
        inputMode="decimal"
        aria-label={`המחיר של ${month}`}
        onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); setEdit(false); } }}
        className="w-20 min-h-9 px-2 rounded-lg border border-line-strong bg-white"
      />
      <button className="text-sm text-accent bg-transparent border-0 cursor-pointer min-h-9 font-semibold">שמירה</button>
      <button type="button" onClick={() => setEdit(false)} className="text-sm text-muted bg-transparent border-0 cursor-pointer min-h-9">ביטול</button>
    </form>
  );
}
