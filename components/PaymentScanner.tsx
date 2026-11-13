'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { commitPayment, payerCharges, scanScreenshot, type PayerOption, type ScanItem } from '@/app/actions';
import type { PaymentMethod } from '@/lib/types';
import { MethodIcon, METHOD_LABEL } from './ui';

type Phase = 'idle' | 'scanning' | 'review' | 'error';

const money = (n: number) => '₪' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
const ddmmyyyy = (iso: string | null) => (iso ? iso.split('-').reverse().join('/') : '');
const REASON: Record<string, string> = {
  alias: 'השם שבצילום שמור אצלי כשם חלופי',
  name: 'השם שבצילום זהה לשם הלקוח',
  family: 'שם המשפחה תואם',
  children: 'שמות הילדים מופיעים בהערה',
  manual: 'בחירה ידנית',
};

export function PaymentScanner() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [items, setItems] = useState<ScanItem[]>([]);
  const [allPayers, setAllPayers] = useState<{ id: string; name: string }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) { setError('זה לא נראה כמו תמונה'); setPhase('error'); return; }
    const dataUrl = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(file); });
    setPreview(dataUrl);
    setPhase('scanning');
    const [head, base64] = dataUrl.split(',');
    const mime = head.match(/data:([^;]+)/)?.[1] || 'image/png';
    const res = await scanScreenshot(base64, mime);
    if (!res.ok) { setError(res.error); setPhase('error'); return; }
    setItems(res.items);
    setAllPayers(res.allPayers);
    setPhase('review');
  }

  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      if (phase === 'scanning') return;
      const item = Array.from(e.clipboardData?.items || []).find((i) => i.type.startsWith('image/'));
      const file = item?.getAsFile();
      if (file) { e.preventDefault(); handleFile(file); }
    }
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  });

  const reset = () => { setPhase('idle'); setPreview(null); setItems([]); setError(''); };

  return (
    <div className="flex flex-col gap-4">
      {(phase === 'idle' || phase === 'error') && (
        <div
          className="card border-2 border-dashed !border-line-strong flex flex-col items-center gap-3 text-center py-10"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        >
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#3446C4" strokeWidth="1.5" aria-hidden><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="M12 11v6M9 14h6" /></svg>
          <p className="m-0 font-semibold">הדביקי צילום מסך של אישור התשלום</p>
          <p className="m-0 text-sm text-muted">
            צילום מסך: <kbd className="px-1.5 py-0.5 bg-page border border-line-strong rounded text-xs">Win+Shift+S</kbd> ואז הדבקה עם <kbd className="px-1.5 py-0.5 bg-page border border-line-strong rounded text-xs">Ctrl+V</kbd> — או גרירה / בחירת קובץ
          </p>
          <p className="m-0 text-xs text-muted">אפשר צילום עם כמה תשלומים — אטפל בכל אחד בנפרד</p>
          <button type="button" className="btn-secondary" onClick={() => fileRef.current?.click()} title="אבחר תמונה מהמחשב או מהטלפון">בחירת תמונה</button>
          <input ref={fileRef} type="file" accept="image/*" className="sr-only" aria-label="בחירת צילום מסך" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
          {phase === 'error' && <p role="alert" className="m-0 text-bad text-sm">לא הצלחתי לקרוא את התמונה: {error}</p>}
        </div>
      )}

      {phase === 'scanning' && (
        <div className="card flex flex-col items-center gap-3">
          {preview && <img src={preview} alt="הצילום שהעלית" className="max-h-60 rounded-xl border border-line object-contain" />}
          <div role="status" className="flex items-center gap-2 text-accent-dark"><span className="spinner" />אני קוראת את הצילום ומחפשת למי הוא שייך…</div>
        </div>
      )}

      {phase === 'review' && (
        <>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div role="status" className="text-ok text-sm">קראתי את הצילום — מצאתי {items.length === 1 ? 'תשלום אחד' : `${items.length} תשלומים`}</div>
            <button type="button" className="btn-secondary" onClick={reset} title="אנקה ואחכה לצילום הבא">צילום חדש</button>
          </div>
          {items.map((it, i) => <PaymentCard key={i} item={it} preview={i === 0 ? preview : null} allPayers={allPayers} />)}
        </>
      )}
    </div>
  );
}

function PaymentCard({ item, preview, allPayers }: { item: ScanItem; preview: string | null; allPayers: { id: string; name: string }[] }) {
  const router = useRouter();
  const ex = item.extracted;
  const [amount, setAmount] = useState(String(ex.amount ?? ''));
  const [date, setDate] = useState(ex.date || new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<PaymentMethod>(ex.method);
  const [rawName, setRawName] = useState(ex.payerName || '');
  const [note, setNote] = useState(ex.note || '');
  const [option, setOption] = useState<PayerOption | null>(item.candidates[0] || null);
  const [alloc, setAlloc] = useState<Record<number, string>>(() => Object.fromEntries((item.candidates[0]?.suggested || []).map((a) => [a.linkId, String(a.amount)])));
  const [state, setState] = useState<'edit' | 'loading' | 'saving' | 'done' | 'error'>('edit');
  const [msg, setMsg] = useState('');
  const [receipt, setReceipt] = useState<{ number: string | null; url: string | null } | null>(null);

  const amt = Number(amount) || 0;
  const assigned = Object.values(alloc).reduce((t, v) => t + (Number(v) || 0), 0);

  async function choosePayer(id: string) {
    const cand = item.candidates.find((c) => c.payerId === id);
    if (cand) { setOption(cand); setAlloc(Object.fromEntries(cand.suggested.map((a) => [a.linkId, String(a.amount)]))); return; }
    if (!id) { setOption(null); setAlloc({}); return; }
    setState('loading');
    const opt = await payerCharges(id, amt);
    setOption(opt);
    setAlloc(Object.fromEntries((opt?.suggested || []).map((a) => [a.linkId, String(a.amount)])));
    setState('edit');
  }

  async function submit() {
    if (!option) return;
    setState('saving');
    const res = await commitPayment({
      payerId: option.payerId, rawName, amount: amt, date, method, note, reference: ex.reference || '',
      allocations: Object.entries(alloc).map(([linkId, v]) => ({ linkId: Number(linkId), amount: Number(v) || 0 })),
    });
    if (!res.ok) { setMsg(res.error); setState('error'); return; }
    setReceipt({ number: res.number, url: res.url });
    setState('done');
    router.refresh();
  }

  if (state === 'done') {
    return (
      <div className="card flex flex-wrap items-center gap-3 !bg-ok-soft !border-ok-soft">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1E6E46" strokeWidth="2.4" aria-hidden><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        <span className="flex-1 text-ok">הפקתי קבלה {receipt?.number || ''} ל{option?.name} על {money(amt)} ועדכנתי את החיובים</span>
        {receipt?.url && <a href={receipt.url} target="_blank" rel="noopener" className="btn-secondary no-underline">פתיחת הקבלה</a>}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-4 items-start">
      <section className="card flex-[1_1_280px] min-w-0 flex flex-col gap-3">
        <h2 className="m-0 text-lg">1 · מה זיהיתי (אפשר לתקן)</h2>
        {preview && <img src={preview} alt="הצילום שהעלית" className="max-h-72 self-center rounded-xl border border-line object-contain" />}
        <label className="flex items-center gap-2.5 text-sm"><span className="w-[72px] text-muted flex-none">סכום</span><input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className="input" /></label>
        <label className="flex items-center gap-2.5 text-sm"><span className="w-[72px] text-muted flex-none">תאריך</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" /></label>
        <label className="flex items-center gap-2.5 text-sm"><span className="w-[72px] text-muted flex-none">שם בצילום</span><input value={rawName} onChange={(e) => setRawName(e.target.value)} className="input" /></label>
        <label className="flex items-center gap-2.5 text-sm"><span className="w-[72px] text-muted flex-none">הערה</span><input value={note} onChange={(e) => setNote(e.target.value)} className="input" /></label>
        <div role="radiogroup" aria-label="אמצעי תשלום" className="flex items-center gap-2.5 text-sm">
          <span className="w-[72px] text-muted flex-none">אמצעי</span>
          <div className="flex flex-wrap gap-1.5">
            {(['bit', 'paybox', 'bank', 'cash'] as PaymentMethod[]).map((mt) => (
              <button key={mt} type="button" role="radio" aria-checked={method === mt} onClick={() => setMethod(mt)}
                className={`inline-flex items-center gap-1.5 min-h-11 px-3 rounded-[10px] text-sm cursor-pointer ${method === mt ? 'border-2 border-accent bg-[#F7F8FF]' : 'border border-line-strong bg-white'}`}>
                <MethodIcon method={mt} />{METHOD_LABEL[mt]}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="card flex-[1_1_320px] min-w-0 flex flex-col gap-3">
        <div className="flex justify-between items-center gap-2">
          <h2 className="m-0 text-lg">2 · עבור מי התשלום?</h2>
          {option && option.score > 0 && <span className={`chip ${option.score >= 80 ? 'bg-ok-soft text-ok' : 'bg-warn-soft text-warn'}`}>התאמה {option.score}%</span>}
        </div>
        <label className="label">משלם/ת
          <select value={option?.payerId || ''} onChange={(e) => choosePayer(e.target.value)} className="input" title="אם טעיתי — בחרי משלם/ת אחר/ת ואזכור את השם לפעם הבאה">
            <option value="">— בחירה —</option>
            {item.candidates.length > 0 && <optgroup label="ההתאמות שמצאתי">{item.candidates.map((c) => <option key={c.payerId} value={c.payerId}>{c.name} · {c.score}% · חוב {money(c.debt)}</option>)}</optgroup>}
            <optgroup label="כל המשלמים">{allPayers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>
          </select>
        </label>
        {!item.candidates.length && <p className="m-0 text-sm text-warn">לא מצאתי התאמה לשם ״{rawName}״ — בחרי משלם/ת ואזכור את השם לפעם הבאה</p>}
        {option && <p className="m-0 text-sm text-muted leading-relaxed">{REASON[option.reason] || ''}{option.debt ? ` · חוב פתוח ${money(option.debt)}` : ''}</p>}
        {state === 'loading' && <div role="status" className="flex items-center gap-2 text-sm text-accent-dark"><span className="spinner" />בודקת את החיובים הפתוחים…</div>}
        {option && (
          <div className="flex flex-col gap-2">
            {option.charges.map((c) => {
              const on = alloc[c.linkId] != null;
              return (
                <div key={c.linkId} className={`flex items-center gap-2.5 p-2.5 rounded-[14px] ${on ? 'border-2 border-accent bg-[#F7F8FF]' : 'border border-line'}`}>
                  <label className="flex-1 flex items-center gap-2.5 min-h-11 min-w-0">
                    <input type="checkbox" checked={on} className="w-5 h-5 accent-accent flex-none"
                      onChange={(e) => setAlloc((a) => { const n = { ...a }; if (e.target.checked) n[c.linkId] = String(Math.min(c.due, Math.max(0, amt - assigned)) || c.due); else delete n[c.linkId]; return n; })} />
                    <span className="flex flex-col min-w-0">
                      <b>{c.childFirst}</b>
                      <span className="text-[13px] text-muted flex items-center gap-1.5"><span className="w-2 h-2 rounded-full flex-none" style={{ background: c.color }} />{c.label} · חוב {money(c.due)}</span>
                    </span>
                  </label>
                  {on && <label className="flex items-center gap-1 text-[13px] text-muted">₪<input value={alloc[c.linkId]} onChange={(e) => setAlloc((a) => ({ ...a, [c.linkId]: e.target.value }))} inputMode="decimal" aria-label={`סכום עבור ${c.childFirst}`} className="w-16 min-h-10 px-2 rounded-lg border border-line-strong text-[15px]" /></label>}
                </div>
              );
            })}
            {!option.charges.length && <p className="m-0 text-sm text-muted">אין למשלם/ת הזה/ו חיובים פתוחים</p>}
            <div className="flex justify-between text-sm px-0.5"><span className="text-muted">שויך</span><b className={assigned > amt + 0.005 ? 'text-bad' : ''}>{money(assigned)} מתוך {money(amt)}</b></div>
            {assigned < amt - 0.005 && assigned > 0 && <p className="m-0 text-xs text-warn">היתרה ({money(amt - assigned)}) תירשם בקבלה כזיכוי לחודשים הבאים</p>}
          </div>
        )}
      </section>

      <section className="card flex-[1_1_280px] min-w-0 flex flex-col gap-3">
        <h2 className="m-0 text-lg">3 · קבלה ב-Morning</h2>
        <div className="border border-line rounded-[14px] p-4 flex flex-col gap-2 bg-[#FBFBFC] text-sm">
          <div className="flex justify-between"><span className="text-muted">לקוח</span><span>{option?.name || '—'}</span></div>
          {option?.charges.filter((c) => alloc[c.linkId] != null).map((c) => (
            <div key={c.linkId} className="flex justify-between gap-2 py-1.5 border-b border-[#EEEFF3]"><span>{c.label} · {c.childFirst}</span><b>{money(Number(alloc[c.linkId]) || 0)}</b></div>
          ))}
          <div className="flex justify-between text-base font-bold"><span>סה״כ</span><span>{money(amt)}</span></div>
          <div className="flex justify-between items-center text-muted"><span>אמצעי תשלום</span><span className="inline-flex items-center gap-1.5"><MethodIcon method={method} size={18} />{METHOD_LABEL[method]} · {ddmmyyyy(date)}</span></div>
        </div>
        <button type="button" className="btn-primary min-h-[52px]" disabled={!option || !assigned || assigned > amt + 0.005 || state === 'saving'} onClick={submit}
          title="אפיק קבלה ב-Morning ואסמן את החיובים כשולמו">
          {state === 'saving' ? <><span className="spinner" />מפיקה קבלה…</> : 'הפקת קבלה ב-Morning'}
        </button>
        {state === 'saving' && <div role="status" className="text-sm text-accent-dark">מפיקה קבלה ומעדכנת את החיובים…</div>}
        {state === 'error' && <p role="alert" className="m-0 text-sm text-bad">לא הצלחתי: {msg}</p>}
      </section>
    </div>
  );
}
