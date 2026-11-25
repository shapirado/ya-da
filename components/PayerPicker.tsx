'use client';

import { useEffect, useRef, useState } from 'react';
import { searchMorning } from '@/app/actions';
import type { MorningClientHit } from '@/lib/morning';
import { MORNING_LABELS } from '@/lib/flags';

type Picked = { id: string; created: boolean };

const pick = (on: boolean) => `text-right min-h-11 px-3 py-1.5 rounded-[10px] text-sm cursor-pointer flex flex-col ${on ? 'border-2 border-accent bg-[#F7F8FF]' : 'border border-line-strong bg-white'}`;

/**
 * Payer fields of the new-child form. A new payer is always tied to a Morning customer chosen here:
 * either one found by the search, or a new one marked with the explicit "הוספה כלקוח/ה ב-Morning" button.
 * Nothing changes in Morning until "שמירה": the new customer is opened then, named "<parent> (<child>)",
 * with the labels of the child's ticked activities plus any chosen here.
 *
 * The name / phone / email inputs stay uncontrolled so RegistrationPaste can keep filling them by name.
 */
export function PayerPicker({ prefix, payers, labels, optional }: {
  prefix: 'payer' | 'payer2';
  /** app payers for the "existing payer" select (primary payer only) */
  payers?: { id: string; label: string }[];
  labels: string[];
  /** second payer: nothing is required unless a name was typed */
  optional?: boolean;
}) {
  const [existing, setExisting] = useState('');
  const [results, setResults] = useState<MorningClientHit[] | null>(null);
  const [searched, setSearched] = useState('');
  const [sel, setSel] = useState<Picked | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [busy, setBusy] = useState<'search' | 'add' | null>(null);
  const [err, setErr] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // Block the save while a new payer has no Morning customer — otherwise the server refuses and the form is lost
  const guard = useRef({ existing, sel });
  guard.current = { existing, sel };
  useEffect(() => {
    const form = nameRef.current?.form;
    if (!form) return;
    const onSubmit = (e: Event) => {
      const { existing, sel } = guard.current;
      if (existing || sel) return;
      if (optional && !nameRef.current?.value.trim()) return;
      e.preventDefault();
      setErr(optional
        ? 'למשלם/ת השני/ה עוד אין לקוח ב-Morning — צריך לחפש ולבחור, להוסיף, או למחוק את השם'
        : 'עוד לא נבחר לקוח ב-Morning — צריך לחפש ולבחור לקוח/ה קיים/ת, או להוסיף כלקוח/ה חדש/ה');
      boxRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    };
    form.addEventListener('submit', onSubmit);
    return () => form.removeEventListener('submit', onSubmit);
  }, [optional]);

  async function search() {
    const q = nameRef.current?.value.trim() || '';
    if (!q) { setErr('צריך שם כדי לחפש'); return; }
    setBusy('search');
    setErr('');
    const r = await searchMorning(q);
    setBusy(null);
    if (!r.ok) { setErr(`החיפוש ב-Morning נכשל: ${r.error}`); return; }
    setResults(r.clients);
    setSearched(q);
  }

  function choose(c: MorningClientHit) {
    if (nameRef.current) nameRef.current.value = c.name || '';
    if (phoneRef.current) phoneRef.current.value = c.phone || '';
    if (emailRef.current) emailRef.current.value = c.email || '';
    setSel({ id: c.id, created: false });
    setErr('');
  }

  function add() {
    const name = nameRef.current?.value.trim() || '';
    if (!name) { setErr('צריך שם מלא'); return; }
    setErr('');
    setSel({ id: '', created: true });
  }

  const locked = !!sel;

  return (
    <div ref={boxRef} className="flex flex-col gap-3">
      {payers && (
        <label className="label" title="אחבר את הילד/ה ללקוח קיים ואאחד את החוב המשפחתי">
          משלם/ת קיים/ת (אח/ות כבר רשום/ה)
          <select name="existing_payer" className="input" value={existing} onChange={(e) => { setExisting(e.target.value); setErr(''); }}>
            <option value="">— משלם/ת חדש/ה —</option>
            {payers.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </label>
      )}

      {/* hidden rather than unmounted, so pasted registration details aren't lost */}
      <div className={existing ? 'hidden' : 'flex flex-col gap-3'}>
        <input type="hidden" name={`${prefix}_morning_id`} value={sel?.id || ''} />
        {sel?.created && <input type="hidden" name={`${prefix}_morning_new`} value="1" />}
        {sel?.created && chosen.map((l) => <input key={l} type="hidden" name={`${prefix}_labels`} value={l} />)}
        <div className="flex gap-2 items-end">
          <label className="label flex-1">שם מלא
            <input ref={nameRef} name={`${prefix}_name`} className="input"
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (!locked) search(); } }} />
          </label>
          {!locked && (
            <button type="button" className="btn-secondary flex-none" disabled={!!busy} onClick={search} title="אחפש לקוחות ב-Morning לפי השם">
              {busy === 'search' ? <><span className="spinner" />מחפשת…</> : 'חיפוש ב-Morning'}
            </button>
          )}
        </div>

        {!locked && results && (
          <div role="radiogroup" aria-label="לקוחות ב-Morning" className="flex flex-col gap-1.5">
            {results.length > 0
              ? <p className="m-0 text-xs text-muted">מצאתי ב-Morning לפי ״{searched}״ — בחירה תמלא את הפרטים מ-Morning:</p>
              : <p className="m-0 text-sm text-muted">לא מצאתי ב-Morning לקוח/ה בשם ״{searched}״ — אפשר לנסות שם אחר (למשל בעברית)</p>}
            {results.map((c) => (
              <button key={c.id} type="button" role="radio" aria-checked={false} onClick={() => choose(c)} className={pick(false)}>
                <b>{c.name}</b>
                <span className="text-[13px] text-muted" dir="ltr">{[c.phone, c.email].filter(Boolean).join(' · ') || '—'}</span>
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2.5">
          <label className="label">{optional ? 'טלפון' : 'טלפון (וואטסאפ)'}
            <input ref={phoneRef} name={`${prefix}_phone`} type="tel" dir="ltr" className="input text-right" />
          </label>
          <label className="label">{optional ? 'אימייל' : 'אימייל לקבלות'}
            <input ref={emailRef} name={`${prefix}_email`} type="email" dir="ltr" className="input text-right" />
          </label>
        </div>

        {locked && (
          <div role="status" className="flex items-center justify-between gap-3 p-3 rounded-[14px] bg-ok-soft text-sm">
            <span>{sel!.created ? `לקוח/ה חדש/ה ייפתח/תיפתח ב-Morning בשמירה${MORNING_LABELS ? `${chosen.length ? ` · תוויות: ${chosen.join(', ')}` : ''} · התווית של הפעילות תתווסף לבד` : ''}` : 'נבחר/ה לקוח/ה קיים/ת ב-Morning — הפרטים נלקחו משם ואפשר לערוך אותם כאן (ב-Morning הם לא ישתנו)'}</span>
            <button type="button" className="btn-secondary flex-none" onClick={() => setSel(null)} title={sel!.created ? 'אבטל — שום דבר לא נפתח ב-Morning' : 'אבטל את הבחירה — הלקוח ב-Morning לא יימחק'}>שינוי</button>
          </div>
        )}

        {/* A new Morning customer is opened only from here, and only after a search came back */}
        {!locked && results && (
          <div className="flex flex-col gap-2.5 p-3 rounded-[14px] border-2 border-dashed border-line-strong">
            <span className="text-sm">{results.length ? 'אף אחד מהם לא מתאים?' : 'אין לקוח/ה כזה ב-Morning.'} אפשר להוסיף לפי הפרטים שלמעלה — השם ב-Morning יהיה ״שם ההורה (שם הילד/ה)״</span>
            {MORNING_LABELS && labels.length > 0 && (
              <div role="group" aria-label="תוויות ב-Morning" className="flex gap-1.5 flex-wrap">
                {labels.map((l) => {
                  const on = chosen.includes(l);
                  return (
                    <button key={l} type="button" aria-pressed={on} onClick={() => setChosen(on ? chosen.filter((x) => x !== l) : [...chosen, l])}
                      className={`min-h-9 px-3 rounded-full text-[13px] cursor-pointer ${on ? 'border-2 border-accent bg-[#F7F8FF]' : 'border border-line-strong bg-white'}`}>{l}</button>
                  );
                })}
              </div>
            )}
            <button type="button" className="btn-secondary self-start" disabled={!!busy} onClick={add} title="הלקוח/ה ייפתח/תיפתח ב-Morning כשאשמור את הטופס">
              הוספה כלקוח/ה ב-Morning
            </button>
          </div>
        )}

        {!locked && !results && !optional && <p className="m-0 text-xs text-muted">למשלם/ת חדש/ה — קודם חיפוש ב-Morning; לקוח חדש ייפתח שם רק בלחיצה על ״הוספה כלקוח/ה ב-Morning״</p>}
        {err && <p role="alert" className="m-0 text-sm text-bad">{err}</p>}
      </div>
    </div>
  );
}
