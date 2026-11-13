import Link from 'next/link';
import { loadModel, loadReminderLog } from '@/lib/data';
import { familyDebts, fmtMoney } from '@/lib/billing';
import { fmtDate, fmtDateTime, monthStart } from '@/lib/dates';
import { reminderMessage, waLink } from '@/lib/messages';
import { Dot, PageHeader } from '@/components/ui';
import { CopyButton, WaButton } from '@/components/WaButton';

type SP = { p?: string; show?: string };

export default async function RemindersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const m = await loadModel();
  const sentLog = await loadReminderLog(monthStart(m.today));
  const all = familyDebts(m).map((d) => {
    const msg = reminderMessage(d);
    return { d, msg, wa: waLink(d.payer?.phone, msg), sentAt: sentLog.get(d.payerId) };
  });
  const showSent = sp.show === 'sent';
  const list = all.filter((x) => (showSent ? !!x.sentAt : !x.sentAt));
  const sel = all.find((x) => x.d.payerId === sp.p) || list[0];
  const total = all.reduce((t, x) => t + x.d.total, 0);
  const chargeCount = all.reduce((t, x) => t + x.d.charges.length, 0);
  const q = (patch: SP) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ p: sp.p, show: sp.show, ...patch })) if (v) p.set(k, v);
    return `/reminders${p.size ? '?' + p : ''}`;
  };

  return (
    <>
      <PageHeader title="תזכורות תשלום בוואטסאפ" sub="אני מאגדת את כל החובות לפי הורה משלם — כל הילדים, הפעילויות והחודשים שכבר התחילו, בהודעה אחת" />

      <div role="status" className="flex items-center gap-3 px-4 py-3 rounded-[14px] bg-accent-soft text-accent-dark text-sm">
        {all.length ? <span>סיימתי לחשב: <b>{all.length} משפחות</b>, <b>{chargeCount} חיובים פתוחים</b>, סה״כ <b>{fmtMoney(total)}</b> (עד {fmtDate(m.today)})</span> : <span>אין חובות פתוחים — אין למי לשלוח תזכורת</span>}
      </div>

      <div className="flex flex-wrap gap-4 items-start">
        <section aria-labelledby="fam-h" className="card flex-[3_1_480px] min-w-0 flex flex-col gap-3">
          <div className="flex flex-wrap justify-between items-center gap-2.5">
            <h2 id="fam-h" className="m-0 text-[19px]">חוב לפי משפחה</h2>
            <div role="group" aria-label="סינון" className="flex gap-1.5">
              <Link href={q({ show: undefined, p: undefined })} aria-current={!showSent ? 'true' : undefined} className={`chip min-h-10 border no-underline text-ink ${!showSent ? 'border-accent bg-accent-soft' : 'border-line-strong bg-white'}`}>טרם נשלח החודש · {all.filter((x) => !x.sentAt).length}</Link>
              <Link href={q({ show: 'sent', p: undefined })} aria-current={showSent ? 'true' : undefined} className={`chip min-h-10 border no-underline text-ink ${showSent ? 'border-accent bg-accent-soft' : 'border-line-strong bg-white'}`}>נשלח · {all.filter((x) => x.sentAt).length}</Link>
            </div>
          </div>
          <ul className="list-none m-0 p-0 flex flex-col gap-2.5">
            {list.map(({ d, msg, wa, sentAt }) => {
              const on = sel?.d.payerId === d.payerId;
              return (
                <li key={d.payerId} className={`rounded-[14px] px-3.5 py-3 flex flex-col gap-2.5 ${on ? 'border-2 border-accent bg-[#F7F8FF]' : 'border border-line bg-white'}`}>
                  <div className="flex flex-wrap items-center gap-3">
                    <Link href={q({ p: d.payerId })} title={`אציג את ההודעה של ${d.payer?.name || ''}`} className="flex-[1_1_220px] min-w-0 min-h-11 flex flex-col no-underline text-ink">
                      <span className="font-semibold">{d.payer?.name || 'ללא משלם/ת'} <span className="font-normal text-muted">· {d.childFirstNames.join(', ')}{d.charges.length > 1 ? ` · ${d.charges.length} חיובים` : ''}</span></span>
                      <span className="text-[13px] text-muted" dir="ltr">{d.payer?.phone || 'אין טלפון'}</span>
                    </Link>
                    <span className="flex flex-col min-w-[92px]"><span className="text-xs text-muted">חוב משפחתי</span><b className="text-lg">{fmtMoney(d.total)}</b></span>
                    <span className={`chip min-w-[110px] justify-center ${sentAt ? 'bg-accent-soft text-accent-dark' : 'bg-page text-muted'}`}>{sentAt ? `נשלח ${fmtDateTime(sentAt).slice(0, 10)}` : 'טרם נשלח'}</span>
                    <WaButton href={wa} payerId={d.payerId} total={d.total} message={msg} label={sentAt ? 'שוב' : 'פתיחה'} title={`אפתח את WhatsApp עם ההודעה המוכנה ל${d.payer?.name || ''}`} />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {d.charges.map((c) => <span key={c.linkId} className="chip bg-page"><Dot color={c.color} size={8} />{c.childFirst} · {c.label} · <b>{fmtMoney(c.due)}</b></span>)}
                  </div>
                </li>
              );
            })}
            {!list.length && <li className="text-muted py-2">{showSent ? 'עוד לא שלחתי תזכורות החודש' : 'שלחתי לכולם החודש'}</li>}
          </ul>
        </section>

        {sel && (
          <section aria-labelledby="msg-h" className="flex-[2_1_340px] min-w-0 rounded-[18px] p-5 bg-[#ECE5DA] flex flex-col gap-3 md:sticky md:top-4">
            <div className="flex justify-between items-center gap-2">
              <h2 id="msg-h" className="m-0 text-[17px] text-[#2B2722]">ההודעה ל{sel.d.payer?.name || ''}</h2>
              <span className="text-[13px] text-[#4A453C]">{sel.d.charges.length} חיובים</span>
            </div>
            <div className="self-start max-w-[94%] bg-[#D9FDD3] rounded-xl px-3.5 py-3 text-[15px] leading-relaxed whitespace-pre-line">{sel.msg}</div>
            <div className="flex gap-2 flex-wrap">
              <WaButton href={sel.wa} payerId={sel.d.payerId} total={sel.d.total} message={sel.msg} label="פתיחה ב-WhatsApp" className="btn-wa flex-[1_1_160px]" title="אפתח את WhatsApp Web או את האפליקציה" />
              <CopyButton text={sel.msg} />
            </div>
          </section>
        )}
      </div>
    </>
  );
}
