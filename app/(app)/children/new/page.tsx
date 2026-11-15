import Link from 'next/link';
import { loadModel } from '@/lib/data';
import { createChild, morningLabels } from '@/app/actions';
import { PayerPicker } from '@/components/PayerPicker';
import { EnrollFields } from '@/components/EnrollFields';
import { GenderIcon, Notice, PageHeader } from '@/components/ui';
import { Flash } from '@/components/Flash';
import { SubmitButton } from '@/components/SubmitButton';
import { RegistrationPaste } from '@/components/RegistrationPaste';
import { morningConfigured } from '@/lib/morning';

export default async function NewChild({ searchParams }: { searchParams: Promise<{ err?: string }> }) {
  const sp = await searchParams;
  const [m, labels] = await Promise.all([loadModel(), morningLabels()]);
  const payers = [...m.payers].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'he'));

  return (
    <>
      <PageHeader title="ילד/ה חדש/ה" sub="המשלם/ת נבחר/ת מ-Morning (או נוסף/ת שם בלחיצה) — בשמירה ארשום את הילד/ה ואצור את החיובים">
        <Link href="/children" className="btn-secondary no-underline">חזרה לרשימה</Link>
      </PageHeader>
      <Flash err={sp.err} />
      {!morningConfigured() && <Notice tone="warn">מפתחות Morning לא מוגדרים — אוכל לשמור רק עם משלם/ת קיים/ת</Notice>}
      <RegistrationPaste />

      <form id="new-child-form" action={createChild} className="card max-w-[760px] flex flex-col gap-5">
        <fieldset className="border-0 m-0 p-0 flex flex-col gap-3">
          <legend className="text-[13px] font-semibold text-muted pb-2">פרטי הילד/ה</legend>
          <div className="grid grid-cols-2 gap-2.5">
            <label className="label">שם פרטי<input name="first_name" required className="input" /></label>
            <label className="label">שם משפחה<input name="family_name" className="input" /></label>
          </div>
          <div role="radiogroup" aria-label="מגדר" className="flex gap-2">
            {['בת', 'בן'].map((g) => (
              <label key={g} className="flex-1 flex items-center justify-center gap-2 min-h-[52px] rounded-xl border border-line-strong text-[15px] has-[:checked]:border-accent has-[:checked]:border-2 has-[:checked]:bg-accent-soft cursor-pointer">
                <input type="radio" name="gender" value={g} defaultChecked={g === 'בת'} className="accent-accent" />
                <GenderIcon gender={g} size={28} />{g}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="border-0 m-0 p-0 flex flex-col gap-3">
          <legend className="text-[13px] font-semibold text-muted pb-2">משלם/ת</legend>
          <PayerPicker prefix="payer" labels={labels}
            payers={payers.map((p) => ({ id: p.morning_customer_id, label: `${p.name || ''}${p.phone ? ` · ${p.phone}` : ''}` }))} />
          <details className="text-sm">
            <summary className="cursor-pointer min-h-11 flex items-center" title="אחפש את ההורה הנוסף ב-Morning ואשמור אותו כמשלם/ת נוסף/ת">הוספת משלם/ת שני/ה (הורה נוסף)</summary>
            <div className="pt-2"><PayerPicker prefix="payer2" labels={labels} optional /></div>
          </details>
        </fieldset>

        <EnrollFields m={m} />

        <fieldset className="border-0 m-0 p-0 flex flex-col gap-3">
          <legend className="text-[13px] font-semibold text-muted pb-2">תשלום שהתקבל (לא חובה)</legend>
          <p className="m-0 text-xs text-muted">אם שולמה מקדמה / דמי הרשמה — אשייך את הסכום לחיובים ואפיק קבלה ב-Morning</p>
          <div className="grid grid-cols-3 gap-2.5">
            <label className="label">סכום (₪)<input name="paid_amount" inputMode="decimal" className="input" /></label>
            <label className="label">אמצעי
              <select name="paid_method" className="input" defaultValue="bit">
                <option value="bit">ביט</option><option value="paybox">פייבוקס</option><option value="bank">העברה בנקאית</option>
                <option value="cash">מזומן</option><option value="credit">אשראי</option><option value="other">אחר</option>
              </select>
            </label>
            <label className="label">תאריך<input type="date" name="paid_date" className="input" /></label>
          </div>
        </fieldset>

        <div className="flex gap-2.5">
          <SubmitButton pending="שומרת…" className="btn-primary flex-1" title="אשמור את הילד/ה ואצור את החיובים — בלי לפתוח לקוח ב-Morning">שמירה</SubmitButton>
          <Link href="/children" className="btn-secondary no-underline">ביטול</Link>
        </div>
      </form>
    </>
  );
}
