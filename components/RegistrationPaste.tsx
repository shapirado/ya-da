'use client';

import { useState, useTransition } from 'react';
import { parseRegistration } from '@/app/actions';

/** Paste a registration message (WhatsApp etc.) and fill the new-child form (#new-child-form). */
export function RegistrationPaste() {
  const [text, setText] = useState('');
  const [msg, setMsg] = useState<{ t: string; bad?: boolean } | null>(null);
  const [pending, start] = useTransition();

  const form = () => document.getElementById('new-child-form');
  const fill = (name: string, v: string | number | null) => {
    if (v == null || v === '') return;
    const el = form()?.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`);
    if (el) el.value = String(v);
  };
  const check = (name: string, value: string | number) => {
    const el = form()?.querySelector<HTMLInputElement>(`[name="${name}"][value="${value}"]`);
    if (el) el.checked = true;
  };

  const parse = () => start(async () => {
    setMsg(null);
    const r = await parseRegistration(text);
    if (!r.ok) { setMsg({ t: `לא הצלחתי לקרוא את הטקסט: ${r.error}`, bad: true }); return; }
    const { reg, groupIds, campIds } = r.data;
    fill('first_name', reg.childFirst);
    fill('family_name', reg.childFamily);
    if (reg.gender) check('gender', reg.gender);
    fill('payer_name', reg.payerName);
    fill('payer_phone', reg.payerPhone);
    fill('payer_email', reg.payerEmail);
    fill('payer2_name', reg.payer2Name);
    fill('payer2_phone', reg.payer2Phone);
    fill('payer2_email', reg.payer2Email);
    for (const id of groupIds) check('group', id);
    for (const id of campIds) check('camp', id);
    fill('paid_amount', reg.paidAmount);
    if (reg.method) fill('paid_method', reg.method);
    fill('paid_date', reg.paidDate);
    const missed = reg.activity && !groupIds.length && !campIds.length ? ` לא זיהיתי למה "${reg.activity}" מתאים — סמני את הפעילות ידנית.` : '';
    setMsg({ t: `מילאתי את הטופס — כדאי לעבור על הפרטים לפני השמירה.${missed}` });
  });

  return (
    <section className="card max-w-[760px] flex flex-col gap-3" aria-labelledby="paste-h">
      <h2 id="paste-h" className="m-0 text-[17px]">הדבקת פרטי הרשמה</h2>
      <p className="m-0 text-sm text-muted">אפשר להדביק את ההודעה מההורה — אקרא ממנה את הפרטים ואמלא את הטופס למטה</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder={'למשל: היי, רוצה לרשום את נועה כהן לקייטנת חנוכה. אמא: שרית כהן 050-1234567, sarit@gmail.com. העברתי 200 ש"ח מקדמה בביט'}
        className="input !h-auto resize-y leading-relaxed"
      />
      <div className="flex items-center gap-3 flex-wrap">
        <button type="button" onClick={parse} disabled={pending || !text.trim()} className="btn-secondary">
          {pending ? 'קוראת את הפרטים…' : 'קריאת הפרטים ומילוי הטופס'}
        </button>
        {msg && <span className={`text-sm ${msg.bad ? 'text-bad' : 'text-ok'}`} role="status">{msg.t}</span>}
      </div>
    </section>
  );
}
