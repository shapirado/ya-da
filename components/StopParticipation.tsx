'use client';

import { useEffect, useRef, useState } from 'react';
import { stopParticipation } from '@/app/actions';
import { monthLabel } from '@/lib/dates';
import { SubmitButton } from './SubmitButton';

/** Class card header: red pill "הפסקת השתתפות" opening a small popover with the month and a confirm button. */
export function StopParticipation({ childId, groupId, months }: { childId: string; groupId: string; months: string[] }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', off);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', off); document.removeEventListener('keydown', esc); };
  }, [open]);

  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="dialog"
        className="min-h-9 px-3.5 rounded-full border border-bad bg-white text-bad text-[13px] font-medium cursor-pointer hover:bg-bad-soft">
        הפסקת השתתפות
      </button>
      {open && (
        <div role="dialog" aria-label="הפסקת השתתפות" className="absolute top-[calc(100%+6px)] end-0 z-30 w-[min(300px,calc(100vw-32px))] bg-white border border-line rounded-2xl p-4 shadow-[0_8px_24px_rgba(23,22,28,0.14)]">
          <form action={stopParticipation} className="flex flex-col gap-3">
            <input type="hidden" name="child" value={childId} /><input type="hidden" name="group" value={groupId} />
            <label className="label">הפסקת השתתפות מחודש
              <select name="from" className="input">{months.map((d) => <option key={d} value={d}>{monthLabel(d)}</option>)}</select>
            </label>
            <p className="m-0 text-xs text-muted">אמחק את החיובים שלא שולמו מהחודש הזה והלאה</p>
            <div className="flex gap-2">
              <SubmitButton className="btn-danger flex-1" pending="מוחקת…">מחיקת החודשים הבאים</SubmitButton>
              <button type="button" onClick={() => setOpen(false)} className="btn-secondary">ביטול</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
