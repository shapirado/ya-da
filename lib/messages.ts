import type { FamilyDebt } from './billing.ts';
import { fmtMoney } from './billing.ts';
import { monthName } from './dates.ts';

export function firstName(full: string | null | undefined): string {
  return (full || '').trim().split(/\s+/)[0] || '';
}

/** One personal message per family, listing every open charge and the total. */
export function reminderMessage(d: FamilyDebt, signature = process.env.STUDIO_SIGNATURE || 'גליה', studioPhone = process.env.STUDIO_PHONE || ''): string {
  // "עמית - אוקטובר 330₪" for a class month, "עמית - קייטנת חנוכה 450₪" for a camp
  const amount = (n: number) => `${fmtMoney(n).replace('₪', '')}₪`;
  const lines = d.charges.map((c) => `• ${c.childFirst} - ${c.isClass ? monthName(c.month) : c.shortLabel} ${amount(c.due)}`);
  const pay =`אפשר לשלם בפייבוקס או בהעברה בנקאית לדליה .`;
  return [
    `היי ${firstName(d.payer?.name)}, 🙋‍♀️`,
      '🌈תזכורת תשלום לחוג אומנות, סטודיו ידיים:',
        '',
    ...lines,
    `*סה״כ לתשלום: ${fmtMoney(d.total)}*`, 
     
    `${pay} \n תודה🙂`,
  ].join('\n');
}

/** Israeli phone → wa.me link (opens WhatsApp Web or the app). */
export function waLink(phone: string | null | undefined, text: string): string | null {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits) return null;
  const intl = digits.startsWith('972') ? digits : '972' + digits.replace(/^0/, '');
  return `https://wa.me/${intl}?text=${encodeURIComponent(text)}`;
}
