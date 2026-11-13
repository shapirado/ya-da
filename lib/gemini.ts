// Reads a payment screenshot (Bit / PayBox / bank transfer) with Gemini.
// One image may hold several payments (e.g. a Bit history screen), so it returns a list.
// To use your own implementation, replace the body of extractPayments — the rest
// of the app only depends on the ExtractedPayment shape.

import { GoogleGenAI, Type } from '@google/genai';
import type { PaymentMethod } from './types.ts';

export type ExtractedPayment = {
  amount: number | null;
  date: string | null; // YYYY-MM-DD
  payerName: string | null;
  method: PaymentMethod;
  note: string | null;
  reference: string | null;
};

const METHODS = ['bit', 'paybox', 'bank', 'cash', 'credit', 'other'] as const;

const PROMPT = `זהו צילום מסך של אישור תשלום (ביט, פייבוקס, העברה בנקאית או אחר) שהורה שלח לסטודיו לאומנות לילדים.
ייתכן שבתמונה יש יותר מתשלום אחד (למשל מסך היסטוריה) — החזירי כל תשלום נכנס כפריט נפרד ברשימה payments.
לכל תשלום:
- amount: הסכום ששולם, מספר בלבד (בשקלים)
- date: תאריך התשלום בפורמט YYYY-MM-DD (אם השנה חסרה, השתמשי בשנה הנוכחית: ${new Date().getFullYear()})
- payerName: שם מי ששילם / השולח, בדיוק כפי שהוא מופיע
- method: אחד מ- bit, paybox, bank, cash, credit, other
- note: טקסט ההערה/הודעה שצורפה לתשלום, אם יש
- reference: מספר אסמכתא, אם יש
אל תכללי תשלומים יוצאים. אם שדה לא מופיע, החזירי null.`;

export async function extractPayments(base64: string, mimeType: string): Promise<ExtractedPayment[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('חסר GEMINI_API_KEY');
  const ai = new GoogleGenAI({ apiKey });
  const res = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    contents: [{ role: 'user', parts: [{ inlineData: { mimeType, data: base64 } }, { text: PROMPT }] }],
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          payments: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                amount: { type: Type.NUMBER, nullable: true },
                date: { type: Type.STRING, nullable: true },
                payerName: { type: Type.STRING, nullable: true },
                method: { type: Type.STRING, enum: [...METHODS] },
                note: { type: Type.STRING, nullable: true },
                reference: { type: Type.STRING, nullable: true },
              },
              required: ['amount', 'payerName', 'method'],
            },
          },
        },
        required: ['payments'],
      },
    },
  });
  const parsed = JSON.parse(res.text || '{}');
  const list: any[] = Array.isArray(parsed.payments) ? parsed.payments : [];
  return list.map((p) => ({
    amount: p.amount != null ? Number(p.amount) : null,
    date: /^\d{4}-\d{2}-\d{2}$/.test(p.date || '') ? p.date : null,
    payerName: p.payerName || null,
    method: (METHODS as readonly string[]).includes(p.method) ? p.method : 'other',
    note: p.note || null,
    reference: p.reference || null,
  }));
}
