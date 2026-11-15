'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { commitPayment, createCustomerFromScan, createReceiptForNewCustomer, enrollFromScan, findDepositItems, payerCharges, scanScreenshot, searchMorning, type CampPayKind, type DepositItem, type EnrollOptions, type PayerOption, type ScanCtx, type ScanItem, type ScanSuggest } from '@/app/actions';
import type { MorningClientHit, MorningItemHit } from '@/lib/morning';
import type { PaymentMethod } from '@/lib/types';
import { MethodIcon, METHOD_LABEL } from './ui';

type Phase = 'idle' | 'scanning' | 'review' | 'error';

const money = (n: number) => '₪' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
const pretty = (raw: string) => { try { return JSON.stringify(JSON.parse(raw), null, 2); } catch { return raw || '(ריק)'; } };
const ddmmyyyy = (iso: string | null) => (iso ? iso.split('-').reverse().join('/') : '');
const REASON: Record<string, string> = {
  alias: 'השם שבצילום שמור אצלי כשם חלופי',
  name: 'השם שבצילום זהה לשם הלקוח',
  family: 'שם המשפחה תואם',
  children: 'שמות הילדים מופיעים בהערה',
  sender: 'שמות הילדים מופיעים בשם השולח',
  manual: 'בחירה ידנית',
};

export function PaymentScanner() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [items, setItems] = useState<ScanItem[]>([]);
  const [allPayers, setAllPayers] = useState<{ id: string; name: string }[]>([]);
  const [enroll, setEnroll] = useState<EnrollOptions>({ groups: [], camps: [] });
  const [labels, setLabels] = useState<string[]>([]);
  const [debug, setDebug] = useState<{ model: string; raw: string } | null>(null);
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
    setEnroll(res.enroll);
    setLabels(res.labels);
    setDebug(res.debug);
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
          {items.map((it, i) => <PaymentCard key={i} item={it} preview={i === 0 ? preview : null} debug={i === 0 ? debug : null} allPayers={allPayers} enroll={enroll} labels={labels} />)}
        </>
      )}
    </div>
  );
}

// How a first camp payment below its price is treated, and (for a deposit) the Morning item it is invoiced with
type Dep = { kind: CampPayKind; item: DepositItem | null; price?: number | null };
const DEP_DEFAULT: Dep = { kind: 'deposit', item: null };

/** מקדמה / תשלום חלקי switch for a camp paid below its price, plus the Morning deposit item (found by name, or picked). */
function DepositChoice({ activityId, value, onChange, lockKind }: { activityId: number; value: Dep; onChange: (v: Dep) => void; lockKind?: boolean }) {
  const [results, setResults] = useState<MorningItemHit[] | null>(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const searched = useRef(false);
  const kindRef = useRef(value.kind);
  kindRef.current = value.kind;

  async function search(q?: string) {
    setBusy(true);
    setErr('');
    const res = await findDepositItems(activityId, q);
    setBusy(false);
    if (!res.ok) { setErr(res.error); setResults(null); return; }
    setResults(res.items);
    if (!q) setQuery(res.query);
    // a single hit is the item; anything else waits for a pick
    // (kindRef: the user may have switched to תשלום חלקי while the search was running)
    onChange({ kind: kindRef.current, item: res.items.length === 1 ? { id: res.items[0].id, name: res.items[0].name } : null, price: res.items.length === 1 ? res.items[0].price : null });
  }

  // First time מקדמה is the choice: look the item up by "<activity name> - מקדמה"
  useEffect(() => {
    // an item handed in already (copied from a sibling's charge) needs no search
    if (value.kind !== 'deposit' || searched.current || value.item) return;
    searched.current = true;
    search();
  });

  const btn = (on: boolean) => `flex-1 min-h-11 px-3 rounded-[10px] text-sm cursor-pointer disabled:cursor-default disabled:opacity-60 ${on ? 'border-2 border-accent bg-[#F7F8FF]' : 'border border-line-strong bg-white'}`;
  const single = !!value.item && (!results || (results.length === 1 && value.item.id === results[0].id));

  return (
    <div className="flex flex-col gap-2 p-3 rounded-[14px] border border-line bg-[#FBFBFC] text-sm">
      <span className="text-muted">הסכום נמוך ממחיר הקייטנה — איך לרשום את התשלום?</span>
      <div role="radiogroup" aria-label="סוג התשלום לקייטנה" className="flex gap-1.5">
        <button type="button" role="radio" aria-checked={value.kind === 'deposit'} disabled={lockKind} onClick={() => onChange({ ...value, kind: 'deposit' })} className={btn(value.kind === 'deposit')}>מקדמה</button>
        <button type="button" role="radio" aria-checked={value.kind === 'partial'} disabled={lockKind} onClick={() => onChange({ ...value, kind: 'partial' })} className={btn(value.kind === 'partial')}>תשלום חלקי</button>
      </div>
      {value.kind === 'deposit' && (
        <>
          {busy && <div role="status" className="flex items-center gap-2 text-accent-dark"><span className="spinner" />מחפשת את פריט המקדמה ב-Morning…</div>}
          {err && <p role="alert" className="m-0 text-bad">חיפוש הפריט נכשל: {err}</p>}
          {single && <span>פריט ב-Morning: <b>{value.item!.name}</b></span>}
          {results && !single && !busy && (
            <div role="radiogroup" aria-label="פריט מקדמה ב-Morning" className="flex flex-col gap-1.5">
              <span className="text-warn">{results.length ? `לא מצאתי פריט אחד בשם ״${query}״ — בחרי את פריט המקדמה מהרשימה` : `לא מצאתי ב-Morning פריט בשם ״${query}״ — נסי חיפוש אחר`}</span>
              {results.map((it) => (
                <button key={it.id} type="button" role="radio" aria-checked={value.item?.id === it.id} onClick={() => onChange({ kind: 'deposit', item: { id: it.id, name: it.name }, price: it.price })}
                  className={`text-right min-h-11 px-3 rounded-[10px] cursor-pointer flex justify-between items-center gap-2 ${value.item?.id === it.id ? 'border-2 border-accent bg-[#F7F8FF]' : 'border border-line-strong bg-white'}`}>
                  <span>{it.name}</span>{it.price != null && <span className="text-muted">{money(it.price)}</span>}
                </button>
              ))}
            </div>
          )}
          {(results || err) && !single && (
            <div className="flex gap-1.5">
              <input value={query} onChange={(e) => setQuery(e.target.value)} aria-label="חיפוש פריט ב-Morning"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); search(query); } }} className="input flex-1 min-w-0" />
              <button type="button" className="btn-secondary flex-none" disabled={busy || !query.trim()} onClick={() => search(query)} title="אחפש פריטים ב-Morning לפי השם">חיפוש</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const radioBtn = (on: boolean) => `flex-1 min-h-11 px-3 rounded-[10px] text-sm cursor-pointer ${on ? 'border-2 border-accent bg-[#F7F8FF]' : 'border border-line-strong bg-white'}`;

/**
 * Existing payer: what the note points at (child, קייטנה/חוג, where that charge stands) and, when the child
 * isn't registered to the activity yet, the step that registers them so the payment has a charge to go to.
 */
function FocusPanel({ part, option, enroll, onEnrolled, onPick }: { part: 'info' | 'enroll'; option: PayerOption; enroll: EnrollOptions; onEnrolled: (childFirst: string, activity: string) => Promise<void>; onPick: (childFirst: string) => Promise<void> }) {
  const f = option.focus;
  const [childSel, setChildSel] = useState(f.childId || (option.kids.length && !f.childName ? option.kids[0].id : 'new'));
  const [first, setFirst] = useState(f.childId ? '' : f.childName);
  const [family, setFamily] = useState('');
  const [gender, setGender] = useState('בת');
  const [activity, setActivity] = useState(f.activity);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [picking, setPicking] = useState('');

  async function pickNow(name: string) {
    setPicking(name);
    await onPick(name);
    setPicking('');
  }

  const actLabel = activity.startsWith('c:') ? enroll.camps.find((c) => `c:${c.id}` === activity)?.name
    : activity ? `חוג ${enroll.groups.find((g) => `g:${g.id}` === activity)?.label || ''}` : '';
  const state = !f.registered ? (f.activity ? 'לא רשום/ה לפעילות הזו' : option.charges.length ? 'בחרי את החיוב למטה' : '—')
    : f.status === 'paid' ? `שולם במלואו (${money(f.paid)})`
    : f.status === 'deposit' ? `שולמה מקדמה ${money(f.paid)} מתוך ${money(f.price)}`
    : f.status === 'partial' ? `שולם ${money(f.paid)} מתוך ${money(f.price)}`
    : `לא שולם · ${money(f.price)}`;

  async function enrollNow() {
    setBusy(true);
    setErr('');
    const isNew = childSel === 'new';
    const res = await enrollFromScan({ payerId: option.payerId, childId: isNew ? '' : childSel, childFirst: first, childFamily: family, gender, activity });
    if (!res.ok) { setErr(res.error); setBusy(false); return; }
    await onEnrolled(isNew ? first.trim() : option.kids.find((k) => k.id === childSel)?.first || '', activity);
    setBusy(false);
  }

  const row = 'flex justify-between gap-3';
  if (part === 'enroll') {
    if (f.registered || f.pick.length) return null;
    const form = (
        <div className="flex flex-col gap-2.5 p-3 rounded-[14px] border-2 border-dashed border-line-strong">
          <b className="text-sm">{actLabel ? `רישום ל${actLabel}` : 'רישום לפעילות'}</b>
          <p className="m-0 text-[13px] text-muted">ארשום את הילד/ה לפעילות ואצור את החיוב, ואז אפשר לשייך אליו את התשלום</p>
          <label className="label">ילד/ה
            <select value={childSel} onChange={(e) => setChildSel(e.target.value)} className="input">
              {option.kids.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
              <option value="new">+ ילד/ה חדש/ה</option>
            </select>
          </label>
          {childSel === 'new' && (
            <>
              <div className="grid grid-cols-2 gap-2.5">
                <label className="label">שם הילד/ה<input value={first} onChange={(e) => setFirst(e.target.value)} className="input" /></label>
                <label className="label">שם משפחה<input value={family} onChange={(e) => setFamily(e.target.value)} className="input" /></label>
              </div>
              <div role="radiogroup" aria-label="מגדר" className="flex gap-1.5">
                {['בת', 'בן'].map((g) => <button key={g} type="button" role="radio" aria-checked={gender === g} onClick={() => setGender(g)} className={radioBtn(gender === g)}>{g}</button>)}
              </div>
            </>
          )}
          <label className="label">פעילות
            <select value={activity} onChange={(e) => setActivity(e.target.value)} className="input">
              <option value="">— בחירה —</option>
              {enroll.camps.length > 0 && <optgroup label="קייטנות">{enroll.camps.map((c) => <option key={c.id} value={`c:${c.id}`}>{c.name}</option>)}</optgroup>}
              {enroll.groups.length > 0 && <optgroup label="חוגים (חיוב מהחודש הזה)">{enroll.groups.map((g) => <option key={g.id} value={`g:${g.id}`}>חוג {g.label}</option>)}</optgroup>}
            </select>
          </label>
          <button type="button" className="btn-secondary" disabled={busy || !activity || (childSel === 'new' && !first.trim())} onClick={enrollNow}
            title="ארשום את הילד/ה לפעילות ואצור את החיוב — בלי להפיק קבלה">
            {busy ? <><span className="spinner" />רושמת…</> : actLabel ? `רישום ל${actLabel}` : 'רישום לפעילות'}
          </button>
          {err && <p role="alert" className="m-0 text-sm text-bad">לא הצלחתי לרשום: {err}</p>}
        </div>
    );
    // the payer has charges to pay: registration is a side path, kept closed until asked for
    return option.charges.length > 0
      ? <details className="text-sm"><summary className="cursor-pointer min-h-11 flex items-center text-muted">התשלום עבור פעילות שהילד/ה עוד לא רשום/ה אליה? רישום לפעילות</summary>{form}</details>
      : form;
  }
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-1.5 p-3 rounded-[14px] border border-line bg-[#FBFBFC] text-sm">
        <b>מה זיהיתי מההערה</b>
        <div className={row}><span className="text-muted">ילד/ה</span>
          <span className="text-left">{f.childId ? f.childName : f.childName ? `״${f.childName}״ — אין ילד/ה בשם הזה אצל המשלם/ת` : f.pick.length ? 'לא ברור — צריך לבחור' : 'לא זוהה'}</span></div>
        <div className={row}><span className="text-muted">פעילות</span><span className="text-left">{f.activityLabel || 'לא זוהתה'}</span></div>
        <div className={row}><span className="text-muted">מצב</span><span className={`text-left ${f.status === 'paid' ? 'text-warn font-semibold' : ''}`}>{state}</span></div>
        {f.payments.map((p, i) => (
          <div key={i} className={`${row} text-[13px] text-muted`}>
            <span>תשלום קודם · {ddmmyyyy(p.date)}</span>
            <span>{money(p.amount)}{p.url ? <> · <a href={p.url} target="_blank" rel="noopener">קבלה {p.number || ''}</a></> : p.number ? ` · קבלה ${p.number}` : ''}</span>
          </div>
        ))}
      </div>
      {f.pick.length > 0 && (
        <div className="flex flex-col gap-2.5 p-3 rounded-[14px] border-2 border-accent bg-[#F7F8FF]">
          <b className="text-sm">עבור איזה ילד/ה התשלום?</b>
          <p className="m-0 text-[13px] text-muted">לא כתוב בצילום עבור מי התשלום, ולמשלם/ת יש יותר מילד/ה אחד/ת — לא שייכתי את הסכום לבד. אפשר גם לסמן את החיובים ידנית למטה</p>
          <div className="flex gap-1.5 flex-wrap">
            {f.pick.map((n) => (
              <button key={n} type="button" className="btn-secondary" disabled={!!picking} onClick={() => pickNow(n)}>
                {picking === n ? <><span className="spinner" />בודקת…</> : n}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PaymentCard({ item, preview, debug, allPayers, enroll, labels }: { item: ScanItem; preview: string | null; debug: { model: string; raw: string } | null; allPayers: { id: string; name: string }[]; enroll: EnrollOptions; labels: string[] }) {
  const router = useRouter();
  const ex = item.extracted;
  // no match → start on the new-customer path
  const [mode, setMode] = useState<'existing' | 'new'>(item.candidates.length ? 'existing' : 'new');
  // new-customer fields, prefilled from the screenshot
  // the sender's own name without "אמא של…"; the full line stays as "שם בצילום" and as the כינוי
  const [npName, setNpName] = useState(ex.payerOwnName || ex.payerName || '');
  const [npPhone, setNpPhone] = useState('');
  const [npEmail, setNpEmail] = useState('');
  // child and activity are prefilled from the note ("עבור דליה קייטנת אומנות…") when it says so
  const [ncFirst, setNcFirst] = useState(item.suggest.childFirst);
  const [ncFamily, setNcFamily] = useState('');
  const [ncGender, setNcGender] = useState('בת');
  const [activity, setActivity] = useState(item.suggest.activity);
  const [doneName, setDoneName] = useState('');
  // Morning search: pick an existing client (mcSel) or leave it null to open a new one
  const [mcQuery, setMcQuery] = useState(ex.payerOwnName || ex.payerName || '');
  const [mcResults, setMcResults] = useState<MorningClientHit[] | null>(null);
  const [mcSel, setMcSel] = useState<MorningClientHit | null>(null);
  const [mcBusy, setMcBusy] = useState(false);
  const [mcError, setMcError] = useState('');
  const [npLabels, setNpLabels] = useState<string[]>([]);
  const [alias, setAlias] = useState(ex.payerName || '');
  // stage 1 done (client + child + charges saved) → only the receipt is left
  const [created, setCreated] = useState<{ payerId: string; childId: string; warning?: string } | null>(null);
  const autoSearched = useRef(false);
  const payerName = mcSel ? mcSel.name : npName;
  // a new Morning client is opened as "<parent> (<child>)"
  const clientName = mcSel || !npName.trim() || !ncFirst.trim() ? payerName : `${npName.trim()} (${ncFirst.trim()})`;
  // deposit / partial choice: one for the new-customer camp, one per camp charge of an existing customer
  const [newDep, setNewDep] = useState<Dep>(DEP_DEFAULT);
  const [deps, setDeps] = useState<Record<number, Dep>>({});
  const camp = activity.startsWith('c:') ? enroll.camps.find((c) => `c:${c.id}` === activity) : undefined;
  // an existing customer's charge qualifies when it's a camp, nothing was paid yet and this payment doesn't cover it
  const depOn = (c: PayerOption['charges'][number], v: string | undefined) => v != null && !c.isClass && !(c.paid > 0) && (Number(v) || 0) > 0 && (Number(v) || 0) < c.price - 0.005;
  const depOf = (linkId: number) => deps[linkId] || DEP_DEFAULT;

  async function searchMc(q = mcQuery) {
    if (!q.trim()) return;
    setMcBusy(true);
    setMcError('');
    const res = await searchMorning(q);
    setMcBusy(false);
    if (!res.ok) { setMcError(res.error); setMcResults(null); return; }
    setMcResults(res.clients);
    setMcSel((cur) => (cur && res.clients.some((c) => c.id === cur.id) ? cur : null));
  }

  // First time the new-customer path opens: search Morning for the name on the screenshot
  useEffect(() => {
    if (mode !== 'new' || autoSearched.current) return;
    autoSearched.current = true;
    searchMc();
  });
  const [amount, setAmount] = useState(String(ex.amount ?? ''));
  const [date, setDate] = useState(ex.date || new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<PaymentMethod>(ex.method);
  const [rawName, setRawName] = useState(ex.payerName || '');
  const [note, setNote] = useState(ex.note || '');
  const [option, setOption] = useState<PayerOption | null>(item.candidates[0] || null);
  const [alloc, setAlloc] = useState<Record<number, string>>(() => Object.fromEntries((item.candidates[0]?.suggested || []).map((a) => [a.linkId, String(a.amount)])));
  const [state, setState] = useState<'edit' | 'loading' | 'saving' | 'done' | 'error'>('edit');
  const [msg, setMsg] = useState('');
  // what the note points at; replaced after a registration so the new charge becomes the identified one
  const [sug, setSug] = useState<ScanSuggest>(item.suggest);
  // duplicate alerts must be dismissed explicitly before a receipt (or a new customer) can go out
  const [notDup, setNotDup] = useState(false);
  // one deposit per child: suggested once per payer, and never after the user changed the split by hand
  const touched = useRef(false);
  const splitFor = useRef('');
  const [splitNote, setSplitNote] = useState('');
  const fresh = () => { touched.current = false; splitFor.current = ''; setSplitNote(''); };
  const edited = () => { touched.current = true; setSplitNote(''); };
  const [receipt, setReceipt] = useState<{ number: string | null; url: string | null } | null>(null);

  const amt = Number(amount) || 0;
  const alerts = mode === 'existing' && option ? option.alerts : item.alerts;
  const newDepOn = !!camp && amt > 0 && amt < camp.price - 0.005;
  const assigned = Object.values(alloc).reduce((t, v) => t + (Number(v) || 0), 0);

  async function choosePayer(id: string) {
    const cand = item.candidates.find((c) => c.payerId === id);
    setNotDup(false);
    fresh();
    if (cand) { setOption(cand); setAlloc(Object.fromEntries(cand.suggested.map((a) => [a.linkId, String(a.amount)]))); return; }
    if (!id) { setOption(null); setAlloc({}); return; }
    setState('loading');
    const opt = await payerCharges(id, scanCtx());
    setOption(opt);
    setAlloc(Object.fromEntries((opt?.suggested || []).map((a) => [a.linkId, String(a.amount)])));
    setState('edit');
  }

  const scanCtx = (s: ScanSuggest = sug): ScanCtx => ({ amount: amt, date, reference: ex.reference || '', suggest: s });

  // "עבור איזה ילד/ה?": re-read the payer with that child as the one the payment is for
  async function pickChild(childFirst: string) {
    if (!option) return;
    const s: ScanSuggest = { ...sug, childFirst };
    setSug(s);
    fresh();
    const opt = await payerCharges(option.payerId, scanCtx(s));
    if (opt) {
      setOption({ ...opt, score: option.score, reason: option.reason });
      setAlloc(Object.fromEntries(opt.suggested.map((a) => [a.linkId, String(a.amount)])));
      setNotDup(false);
    }
  }

  // after "רישום ל<activity>": re-read the payer so the new charge is listed, identified and ticked
  async function afterEnroll(childFirst: string, act: string) {
    if (!option) return;
    const s: ScanSuggest = { childFirst, activity: act, isCamp: act.startsWith('c:'), isClass: act.startsWith('g:'), named: true, senderKids: [] };
    setSug(s);
    fresh();
    const opt = await payerCharges(option.payerId, scanCtx(s));
    if (opt) {
      setOption({ ...opt, score: option.score, reason: option.reason });
      setAlloc(Object.fromEntries(opt.suggested.map((a) => [a.linkId, String(a.amount)])));
    }
    router.refresh();
  }

  // The amount is exactly one deposit for each of the payer's children in the same camp → suggest a deposit each
  useEffect(() => {
    if (mode !== 'existing' || !option || touched.current || splitFor.current === option.payerId) return;
    for (const c of option.charges) {
      const d = deps[c.linkId];
      if (!d?.item || d.kind !== 'deposit' || d.price == null || !(d.price > 0) || !depOn(c, alloc[c.linkId])) continue;
      const sib = option.charges.filter((x) => x.activityId === c.activityId && !x.isClass && !(x.paid > 0));
      if (sib.length < 2 || Math.abs(d.price * sib.length - amt) > 0.005) continue;
      splitFor.current = option.payerId;
      setAlloc(Object.fromEntries(sib.map((x) => [x.linkId, String(d.price)])));
      setDeps((cur) => ({ ...cur, ...Object.fromEntries(sib.map((x) => [x.linkId, d])) }));
      setSplitNote(`הסכום הוא בדיוק ${sib.length} מקדמות של ${money(d.price)} — חילקתי ${money(d.price)} לכל אחד/ת מ: ${sib.map((x) => x.childFirst).join(', ')}. אפשר לשנות`);
      return;
    }
  });

  async function submit() {
    setState('saving');
    if (mode === 'new' && !created) {
      // stage 1: client + child + aliases + charges — no receipt yet
      const r = await createCustomerFromScan({
        morningClientId: mcSel?.id || '',
        payerName, payerPhone: mcSel ? mcSel.phone : npPhone, payerEmail: mcSel ? mcSel.email : npEmail,
        labels: mcSel ? [] : npLabels, alias, rawName,
        childFirst: ncFirst, childFamily: ncFamily, gender: ncGender, activity,
        kind: newDepOn ? newDep.kind : null,
      });
      if (!r.ok) { setMsg(r.error); setState('error'); return; }
      setCreated({ payerId: r.payerId, childId: r.childId, warning: r.warning });
      setState('edit');
      router.refresh();
      return;
    }
    const res = mode === 'new' && created
      ? await createReceiptForNewCustomer({
          payerId: created.payerId, childId: created.childId, childFirst: ncFirst,
          amount: amt, date, method, rawName, note, reference: ex.reference || '',
          kind: newDepOn ? newDep.kind : null, depositItem: newDepOn && newDep.kind === 'deposit' ? newDep.item : null,
        })
      : option
        ? await commitPayment({
            payerId: option.payerId, rawName, amount: amt, date, method, note, reference: ex.reference || '',
            allocations: Object.entries(alloc).map(([linkId, v]) => {
              const c = option.charges.find((x) => x.linkId === Number(linkId));
              const d = c && depOn(c, v) ? depOf(c.linkId) : null;
              return { linkId: Number(linkId), amount: Number(v) || 0, kind: d?.kind ?? null, depositItem: d?.kind === 'deposit' ? d.item : null };
            }),
          })
        : null;
    if (!res) { setState('edit'); return; }
    if (!res.ok) { setMsg(res.error); setState('error'); return; }
    if (mode === 'new') setDoneName(payerName);
    setReceipt({ number: res.number, url: res.url });
    setState('done');
    router.refresh();
  }

  if (state === 'done') {
    return (
      <div className="card flex flex-wrap items-center gap-3 !bg-ok-soft !border-ok-soft">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1E6E46" strokeWidth="2.4" aria-hidden><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        <span className="flex-1 text-ok">{doneName ? `רשמתי את ${ncFirst} אצל ${doneName} ו` : `ל${option?.name} `}הפקתי קבלה {receipt?.number || ''} על {money(amt)} ועדכנתי את החיובים</span>
        {receipt?.url && <a href={receipt.url} target="_blank" rel="noopener" className="btn-secondary no-underline">פתיחת הקבלה</a>}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-4 items-start">
      <section className="card flex-[1_1_280px] min-w-0 flex flex-col gap-3">
        <h2 className="m-0 text-lg">1 · מה זיהיתי (אפשר לתקן)</h2>
        {preview && <img src={preview} alt="הצילום שהעלית" className="max-h-72 self-center rounded-xl border border-line object-contain" />}
        {debug && (
          <details className="text-xs">
            <summary className="cursor-pointer min-h-9 flex items-center text-muted">debug · התשובה הגולמית של Gemini ({debug.model})</summary>
            <pre dir="ltr" className="m-0 p-2.5 rounded-[10px] bg-page border border-line overflow-x-auto whitespace-pre-wrap break-words text-left">{pretty(debug.raw)}</pre>
          </details>
        )}
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
          {mode === 'existing' && option && option.score > 0 && <span className={`chip ${option.score >= 80 ? 'bg-ok-soft text-ok' : 'bg-warn-soft text-warn'}`}>התאמה {option.score}%</span>}
        </div>
        <div role="radiogroup" aria-label="סוג משלם/ת" className="flex gap-1.5">
          <button type="button" role="radio" aria-checked={mode === 'existing'} disabled={!!created} onClick={() => setMode('existing')}
            className={`flex-1 min-h-11 px-3 rounded-[10px] text-sm cursor-pointer disabled:opacity-50 disabled:cursor-default ${mode === 'existing' ? 'border-2 border-accent bg-[#F7F8FF]' : 'border border-line-strong bg-white'}`}>לקוח/ה קיים/ת</button>
          <button type="button" role="radio" aria-checked={mode === 'new'} disabled={!!created} onClick={() => setMode('new')}
            className={`flex-1 min-h-11 px-3 rounded-[10px] text-sm cursor-pointer disabled:cursor-default ${mode === 'new' ? 'border-2 border-accent bg-[#F7F8FF]' : 'border border-line-strong bg-white'}`}>+ לקוח/ה חדש/ה</button>
        </div>
        {mode === 'new' && created ? (
          <div role="status" className="flex flex-col gap-1.5 p-3 rounded-[14px] bg-ok-soft text-ok text-sm">
            <b>שמרתי: {clientName} · {[ncFirst, ncFamily].filter(Boolean).join(' ')}</b>
            <span>{mcSel ? 'הלקוח/ה קיים/ת ב-Morning' : 'פתחתי לקוח/ה ב-Morning'}, רשמתי את הילד/ה ויצרתי את החיובים. עוד לא הפקתי קבלה.</span>
            {created.warning && <span className="text-warn">{created.warning}</span>}
          </div>
        ) : mode === 'new' ? (
          <div className="flex flex-col gap-2.5">
            <p className="m-0 text-sm text-muted">אחפש את הלקוח/ה ב-Morning (או אפתח חדש/ה), וארשום את הילד/ה לפעילות. את הקבלה אפיק רק בשלב הבא.</p>
            <div className="flex flex-col gap-2 p-3 rounded-[14px] border border-line bg-[#FBFBFC]">
              <label className="label" htmlFor={`mcq-${ex.reference || ex.payerName || ''}`}>חיפוש ב-Morning</label>
              <div className="flex gap-1.5">
                <input id={`mcq-${ex.reference || ex.payerName || ''}`} value={mcQuery} onChange={(e) => setMcQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); searchMc(); } }}
                  placeholder="שם הלקוח/ה כפי שהוא ב-Morning" className="input flex-1 min-w-0" />
                <button type="button" className="btn-secondary flex-none" disabled={mcBusy || !mcQuery.trim()} onClick={() => searchMc()} title="אחפש לקוחות ב-Morning לפי השם">
                  {mcBusy ? <span className="spinner" /> : 'חיפוש'}
                </button>
              </div>
              {mcError && <p role="alert" className="m-0 text-sm text-bad">החיפוש נכשל: {mcError}</p>}
              {mcResults && (
                <div role="radiogroup" aria-label="לקוח/ה ב-Morning" className="flex flex-col gap-1.5">
                  {!mcResults.length && <p className="m-0 text-sm text-muted">לא מצאתי ב-Morning לקוח/ה בשם הזה — אפשר לנסות שם אחר (למשל בעברית)</p>}
                  {mcResults.map((c) => (
                    <button key={c.id} type="button" role="radio" aria-checked={mcSel?.id === c.id} onClick={() => setMcSel(c)}
                      className={`text-right min-h-11 px-3 py-1.5 rounded-[10px] text-sm cursor-pointer flex flex-col ${mcSel?.id === c.id ? 'border-2 border-accent bg-[#F7F8FF]' : 'border border-line-strong bg-white'}`}>
                      <b>{c.name}</b>
                      {(c.phone || c.email || c.labels.length > 0) && <span className="text-[13px] text-muted" dir="auto">{[c.phone, c.email, c.labels.join(', ')].filter(Boolean).join(' · ')}</span>}
                    </button>
                  ))}
                  <button type="button" role="radio" aria-checked={!mcSel} onClick={() => setMcSel(null)}
                    className={`text-right min-h-11 px-3 rounded-[10px] text-sm cursor-pointer ${!mcSel ? 'border-2 border-accent bg-[#F7F8FF]' : 'border border-line-strong bg-white'}`}>+ לקוח/ה חדש/ה ב-Morning</button>
                </div>
              )}
            </div>
            {!mcSel && (
              <>
                <label className="label">שם המשלם/ת<input value={npName} onChange={(e) => setNpName(e.target.value)} className="input" /></label>
                <div className="grid grid-cols-2 gap-2.5">
                  <label className="label">טלפון<input value={npPhone} onChange={(e) => setNpPhone(e.target.value)} type="tel" dir="ltr" className="input text-right" /></label>
                  <label className="label">אימייל לקבלות<input value={npEmail} onChange={(e) => setNpEmail(e.target.value)} type="email" dir="ltr" className="input text-right" /></label>
                </div>
                {labels.length > 0 && (
                  <div role="group" aria-label="תוויות ב-Morning" className="flex flex-col gap-1.5">
                    <span className="label">תוויות ב-Morning</span>
                    <div className="flex flex-wrap gap-1.5">
                      {labels.map((l) => {
                        const on = npLabels.includes(l);
                        return (
                          <button key={l} type="button" aria-pressed={on} onClick={() => setNpLabels((cur) => (on ? cur.filter((x) => x !== l) : [...cur, l]))}
                            className={`min-h-11 px-3 rounded-[10px] text-sm cursor-pointer ${on ? 'border-2 border-accent bg-[#F7F8FF]' : 'border border-line-strong bg-white'}`}>{l}</button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
            <label className="label">כינוי<input value={alias} onChange={(e) => setAlias(e.target.value)} className="input" title="שם נוסף שבו המשלם/ת מופיע/ה בצילומים — אזהה אותו בפעם הבאה" /></label>
            <div className="grid grid-cols-2 gap-2.5">
              <label className="label">שם הילד/ה<input value={ncFirst} onChange={(e) => setNcFirst(e.target.value)} className="input" /></label>
              <label className="label">שם משפחה<input value={ncFamily} onChange={(e) => setNcFamily(e.target.value)} className="input" /></label>
            </div>
            <div role="radiogroup" aria-label="מגדר" className="flex gap-1.5">
              {['בת', 'בן'].map((g) => (
                <button key={g} type="button" role="radio" aria-checked={ncGender === g} onClick={() => setNcGender(g)}
                  className={`flex-1 min-h-11 rounded-[10px] text-sm cursor-pointer ${ncGender === g ? 'border-2 border-accent bg-[#F7F8FF]' : 'border border-line-strong bg-white'}`}>{g}</button>
              ))}
            </div>
            <label className="label">פעילות
              <select value={activity} onChange={(e) => { setActivity(e.target.value); setNewDep(DEP_DEFAULT); }} className="input">
                <option value="">— בחירה —</option>
                {enroll.camps.length > 0 && <optgroup label="קייטנות">{enroll.camps.map((c) => <option key={c.id} value={`c:${c.id}`}>{c.name}</option>)}</optgroup>}
                {enroll.groups.length > 0 && <optgroup label="חוגים (חיוב מהחודש הזה)">{enroll.groups.map((g) => <option key={g.id} value={`g:${g.id}`}>חוג {g.label}</option>)}</optgroup>}
              </select>
            </label>
          </div>
        ) : (
        <>
        <label className="label">משלם/ת
          <select value={option?.payerId || ''} onChange={(e) => choosePayer(e.target.value)} className="input" title="אם טעיתי — בחרי משלם/ת אחר/ת ואזכור את השם לפעם הבאה">
            <option value="">— בחירה —</option>
            {item.candidates.length > 0 && <optgroup label="ההתאמות שמצאתי">{item.candidates.map((c) => <option key={c.payerId} value={c.payerId}>{c.name} · {c.score}% · חוב {money(c.debt)}</option>)}</optgroup>}
            <optgroup label="כל המשלמים">{allPayers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>
          </select>
        </label>
        {!item.candidates.length && <p className="m-0 text-sm text-warn">לא מצאתי התאמה לשם ״{rawName}״ — בחרי משלם/ת קיים/ת, או פתחי לקוח/ה חדש/ה למעלה</p>}
        {option && <p className="m-0 text-sm text-muted leading-relaxed">{REASON[option.reason] || ''}{option.debt ? ` · חוב פתוח ${money(option.debt)}` : ''}</p>}
        {state === 'loading' && <div role="status" className="flex items-center gap-2 text-sm text-accent-dark"><span className="spinner" />בודקת את החיובים הפתוחים…</div>}
        {option && <FocusPanel key={`${option.payerId}-${option.focus.linkId ?? 'none'}-${option.focus.activity}-${option.focus.childName}`} part="info" option={option} enroll={enroll} onEnrolled={afterEnroll} onPick={pickChild} />}
        {option && (
          <div className="flex flex-col gap-2">
            {option.charges.map((c) => {
              const on = alloc[c.linkId] != null;
              return (
                <div key={c.linkId} className="flex flex-col gap-1.5">
                <div className={`flex items-center gap-2.5 p-2.5 rounded-[14px] ${on ? 'border-2 border-accent bg-[#F7F8FF]' : 'border border-line'}`}>
                  <label className="flex-1 flex items-center gap-2.5 min-h-11 min-w-0">
                    <input type="checkbox" checked={on} className="w-5 h-5 accent-accent flex-none"
                      onChange={(e) => { edited(); setAlloc((a) => { const n = { ...a }; if (e.target.checked) n[c.linkId] = String(Math.min(c.due, Math.max(0, amt - assigned)) || c.due); else delete n[c.linkId]; return n; }); }} />
                    <span className="flex flex-col min-w-0">
                      <b className="flex items-center gap-1.5 flex-wrap">{c.childFirst}{option.focus.linkId === c.linkId && <span className="chip bg-accent-soft text-accent-dark font-normal">זוהה מההערה</span>}</b>
                      <span className="text-[13px] text-muted flex items-center gap-1.5"><span className="w-2 h-2 rounded-full flex-none" style={{ background: c.color }} />{c.label} · חוב {money(c.due)}</span>
                    </span>
                  </label>
                  {on && <label className="flex items-center gap-1 text-[13px] text-muted">₪<input value={alloc[c.linkId]} onChange={(e) => { edited(); setAlloc((a) => ({ ...a, [c.linkId]: e.target.value })); }} inputMode="decimal" aria-label={`סכום עבור ${c.childFirst}`} className="w-16 min-h-10 px-2 rounded-lg border border-line-strong text-[15px]" /></label>}
                </div>
                {depOn(c, alloc[c.linkId]) && <DepositChoice activityId={c.activityId} value={depOf(c.linkId)} onChange={(v) => setDeps((d) => ({ ...d, [c.linkId]: v }))} />}
                </div>
              );
            })}
            {!option.charges.length && <p className="m-0 text-sm text-muted">אין למשלם/ת הזה/ו חיובים פתוחים</p>}
            {splitNote && <p role="status" className="m-0 text-[13px] text-accent-dark">{splitNote}</p>}
            <div className="flex justify-between text-sm px-0.5"><span className="text-muted">שויך</span><b className={assigned > amt + 0.005 ? 'text-bad' : ''}>{money(assigned)} מתוך {money(amt)}</b></div>
            {assigned < amt - 0.005 && assigned > 0 && <p className="m-0 text-xs text-warn">היתרה ({money(amt - assigned)}) תירשם בקבלה כזיכוי לחודשים הבאים</p>}
          </div>
        )}
        {option && <FocusPanel key={`enroll-${option.payerId}-${option.focus.linkId ?? 'none'}-${option.focus.activity}-${option.focus.childName}`} part="enroll" option={option} enroll={enroll} onEnrolled={afterEnroll} onPick={pickChild} />}
        </>
        )}
      </section>

      <section className="card flex-[1_1_280px] min-w-0 flex flex-col gap-3">
        <h2 className="m-0 text-lg">3 · קבלה ב-Morning</h2>
        {mode === 'new' && newDepOn && camp && <DepositChoice key={camp.id} activityId={camp.id} value={newDep} onChange={setNewDep} lockKind={!!created} />}
        <div className="border border-line rounded-[14px] p-4 flex flex-col gap-2 bg-[#FBFBFC] text-sm">
          <div className="flex justify-between"><span className="text-muted">לקוח</span><span>{mode === 'new' ? `${clientName || '—'}${mcSel ? '' : created ? '' : ' · חדש/ה'}` : option?.name || '—'}</span></div>
          {mode === 'new' ? (
            <div className="flex justify-between gap-2 py-1.5 border-b border-[#EEEFF3]">
              <span>{camp ? (newDepOn && newDep.kind === 'deposit' ? newDep.item?.name || `${camp.name} - מקדמה` : camp.name) : activity ? `חוג ${enroll.groups.find((g) => `g:${g.id}` === activity)?.label || ''}` : '—'}{ncFirst ? ` · ${ncFirst}` : ''}</span>
              <b>{money(amt)}</b>
            </div>
          ) : option?.charges.filter((c) => alloc[c.linkId] != null).map((c) => (
            <div key={c.linkId} className="flex justify-between gap-2 py-1.5 border-b border-[#EEEFF3]"><span>{depOn(c, alloc[c.linkId]) && depOf(c.linkId).kind === 'deposit' ? depOf(c.linkId).item?.name || `${c.label} - מקדמה` : c.label} · {c.childFirst}</span><b>{money(Number(alloc[c.linkId]) || 0)}</b></div>
          ))}
          <div className="flex justify-between text-base font-bold"><span>סה״כ</span><span>{money(amt)}</span></div>
          <div className="flex justify-between items-center text-muted"><span>אמצעי תשלום</span><span className="inline-flex items-center gap-1.5"><MethodIcon method={method} size={18} />{METHOD_LABEL[method]} · {ddmmyyyy(date)}</span></div>
        </div>
        {alerts.length > 0 && (
          <div role="alert" className="flex flex-col gap-2 p-3 rounded-[14px] bg-warn-soft text-sm">
            <b className="text-warn">נראה כמו תשלום כפול</b>
            {alerts.map((a, i) => (
              <span key={i}>{a.text}{a.url && <> · <a href={a.url} target="_blank" rel="noopener">פתיחת הקבלה</a></>}</span>
            ))}
            <label className="flex items-center gap-2.5 min-h-11 font-medium">
              <input type="checkbox" checked={notDup} onChange={(e) => setNotDup(e.target.checked)} className="w-5 h-5 accent-accent flex-none" />
              זה לא כפל — להמשיך
            </label>
          </div>
        )}
        <button type="button" className="btn-primary min-h-[52px]"
          disabled={state === 'saving' || (alerts.length > 0 && !notDup) || (mode === 'new'
            ? created ? !amt || (newDepOn && newDep.kind === 'deposit' && !newDep.item) : !payerName.trim() || !ncFirst.trim() || !activity
            : !amt || !option || !assigned || assigned > amt + 0.005
              || option.charges.some((c) => depOn(c, alloc[c.linkId]) && depOf(c.linkId).kind === 'deposit' && !depOf(c.linkId).item))}
          onClick={submit}
          title={mode !== 'new' ? 'אפיק קבלה ב-Morning ואסמן את החיובים כשולמו'
            : created ? 'אפיק קבלה ב-Morning על התשלום הזה ואעדכן את החיובים'
            : 'אשמור את הלקוח/ה, הילד/ה והחיובים — בלי להפיק קבלה עדיין'}>
          {state === 'saving'
            ? <><span className="spinner" />{mode !== 'new' || created ? 'מפיקה קבלה…' : 'שומרת לקוח/ה וילד/ה…'}</>
            : mode !== 'new' ? 'הפקת קבלה ב-Morning' : created ? 'יצירת קבלה במורנינג' : mcSel ? 'שמירת לקוח/ה ורישום הילד/ה' : 'פתיחת לקוח/ה ורישום הילד/ה'}
        </button>
        {mode === 'new' && !created && <p className="m-0 text-xs text-muted">שלב 1 מתוך 2 — הקבלה תופק רק אחרי לחיצה נוספת</p>}
        {state === 'saving' && <div role="status" className="text-sm text-accent-dark">{mode !== 'new' || created ? 'מפיקה קבלה ומעדכנת את החיובים…' : 'שומרת את הלקוח/ה, הילד/ה והחיובים…'}</div>}
        {state === 'error' && <p role="alert" className="m-0 text-sm text-bad">לא הצלחתי: {msg}</p>}
      </section>
    </div>
  );
}
