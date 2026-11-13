import Link from 'next/link';
import { loadModel } from '@/lib/data';
import { createChild } from '@/app/actions';
import { EnrollFields } from '@/components/EnrollFields';
import { GenderIcon, Notice, PageHeader } from '@/components/ui';
import { Flash } from '@/components/Flash';
import { SubmitButton } from '@/components/SubmitButton';
import { morningConfigured } from '@/lib/morning';

export default async function NewChild({ searchParams }: { searchParams: Promise<{ err?: string }> }) {
  const sp = await searchParams;
  const m = await loadModel();
  const payers = [...m.payers].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'he'));

  return (
    <>
      <PageHeader title="ילד/ה חדש/ה" sub="בשמירה אפתח כרטיס לקוח ב-Morning למשלם/ת ואצור את החיובים">
        <Link href="/children" className="btn-secondary no-underline">חזרה לרשימה</Link>
      </PageHeader>
      <Flash err={sp.err} />
      {!morningConfigured() && <Notice tone="warn">מפתחות Morning לא מוגדרים — אוכל לשמור רק עם משלם/ת קיים/ת</Notice>}

      <form action={createChild} className="card max-w-[760px] flex flex-col gap-5">
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
          <label className="label" title="אחבר את הילד/ה ללקוח קיים ואאחד את החוב המשפחתי">
            משלם/ת קיים/ת (אח/ות כבר רשום/ה)
            <select name="existing_payer" className="input" defaultValue="">
              <option value="">— משלם/ת חדש/ה —</option>
              {payers.map((p) => <option key={p.morning_customer_id} value={p.morning_customer_id}>{p.name}{p.phone ? ` · ${p.phone}` : ''}</option>)}
            </select>
          </label>
          <p className="text-xs text-muted m-0">למשלם/ת חדש/ה — אפתח כרטיס לקוח ב-Morning:</p>
          <label className="label">שם מלא<input name="payer_name" className="input" /></label>
          <div className="grid grid-cols-2 gap-2.5">
            <label className="label">טלפון (וואטסאפ)<input name="payer_phone" type="tel" dir="ltr" className="input text-right" /></label>
            <label className="label">אימייל לקבלות<input name="payer_email" type="email" dir="ltr" className="input text-right" /></label>
          </div>
          <details className="text-sm">
            <summary className="cursor-pointer min-h-11 flex items-center" title="אצור לקוח שני ב-Morning ואשמור אותו כמשלם/ת נוסף/ת">הוספת משלם/ת שני/ה (הורה נוסף)</summary>
            <div className="flex flex-col gap-2.5 pt-2">
              <label className="label">שם מלא<input name="payer2_name" className="input" /></label>
              <div className="grid grid-cols-2 gap-2.5">
                <label className="label">טלפון<input name="payer2_phone" type="tel" dir="ltr" className="input text-right" /></label>
                <label className="label">אימייל<input name="payer2_email" type="email" dir="ltr" className="input text-right" /></label>
              </div>
            </div>
          </details>
        </fieldset>

        <EnrollFields m={m} />

        <div className="flex gap-2.5">
          <SubmitButton pending="שומרת… פותחת כרטיס לקוח ב-Morning" className="btn-primary flex-1" title="אשמור את הילד/ה ואצור לקוח ב-Morning">שמירה ויצירת לקוח</SubmitButton>
          <Link href="/children" className="btn-secondary no-underline">ביטול</Link>
        </div>
      </form>
    </>
  );
}
