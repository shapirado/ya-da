import type { FamilyDebt } from './billing.ts';
import { fmtMoney } from './billing.ts';

export function firstName(full: string | null | undefined): string {
  return (full || '').trim().split(/\s+/)[0] || '';
}

/** One personal message per family, listing every open charge and the total. */
export function reminderMessage(d: FamilyDebt, signature = process.env.STUDIO_SIGNATURE || 'גליה', studioPhone = process.env.STUDIO_PHONE || ''): string {
  const lines = d.charges.map((c) => `• ${c.childFirst} – ${c.label}: ${fmtMoney(c.due)}`);
  const pay = studioPhone ? `אפשר לשלם בביט או בפייבוקס למספר ${studioPhone} ולשלוח לי צילום מסך.` : 'אפשר לשלם בביט או בפייבוקס ולשלוח לי צילום מסך.';
  return [
    `היי ${firstName(d.payer?.name)}, כאן ${signature} מסטודיו ידיים.`,
    'ריכזתי עבורך את התשלומים הפתוחים:',
    ...lines,
    `סה״כ לתשלום: ${fmtMoney(d.total)}`,
    `${pay} תודה!`,
  ].join('\n');
}

/** Israeli phone → wa.me link (opens WhatsApp Web or the app). */
export function waLink(phone: string | null | undefined, text: string): string | null {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits) return null;
  const intl = digits.startsWith('972') ? digits : '972' + digits.replace(/^0/, '');
  return `https://wa.me/${intl}?text=${encodeURIComponent(text)}`;
}
