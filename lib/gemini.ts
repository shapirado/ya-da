// Reads a payment screenshot (Bit / PayBox / bank transfer) with Gemini.
// One image may hold several payments (e.g. a Bit history screen), so it returns a list.
// To use your own implementation, replace the body of extractPayments — the rest
// of the app only depends on the ExtractedPayment shape.

import { GoogleGenAI, Type } from '@google/genai';
import type { PaymentMethod } from './types.ts';

export type ExtractedPayment = {
  amount: number | null;
  date: string | null; // YYYY-MM-DD
  payerName: string | null; // the sender line as shown, e.g. "ספיר אמא עימרי ואלה"
  payerOwnName: string | null; // the sender's own name only: "ספיר"
  payerChildren: string[]; // children's first names in the sender line: ["עימרי", "אלה"]
  method: PaymentMethod;
  note: string | null;
  reference: string | null;
  childName: string | null; // child's first name, when the note says who the payment is for
  activity: string | null; // what the payment is for, as written: "קייטנת אומנות…", "חוג ראשון"…
};

const METHODS = ['bit', 'paybox', 'bank', 'cash', 'credit', 'other'] as const;

// The studio owner's first name(s): parents write "עבור דליה …" because the money is sent to her,
// so it must never be read as the child's name. Override with STUDIO_OWNER_NAMES="דליה,…".
const OWNER_NAMES = (process.env.STUDIO_OWNER_NAMES || 'דליה').split(',').map((n) => n.trim()).filter(Boolean);

const PROMPT = `זהו צילום מסך של אישור תשלום (ביט, פייבוקס, העברה בנקאית או אחר) שהורה שלח לסטודיו לאומנות לילדים.
ייתכן שבתמונה יש יותר מתשלום אחד (למשל מסך היסטוריה) — החזירי כל תשלום נכנס כפריט נפרד ברשימה payments.
אל תכללי תשלומים יוצאים (כגון "שלחת", סכום שלילי, או מסך היסטוריה שמסומן כיוצא). שימי לב: צילום פייבוקס עם כותרת "העברה מ..." ושורה "הועבר אל: Dalia Harari" הוא תשלום נכנס תקין — תמיד כללי אותו. אם שדה לא מופיע, החזירי null.

לכל תשלום נכנס:
- amount: הסכום ששולם, מספר בלבד (בשקלים, חיובי)
- date: תאריך התשלום בפורמט YYYY-MM-DD. שימי לב: בצילומים ישראליים התאריך כתוב בפורמט DD/MM/YYYY או DD.MM.YYYY (יום לפני חודש!). למשל: 02.11.2026 → "2026-11-02", 06/11/2026 → "2026-11-06". לעולם אל תחליפי בין יום לחודש. אם השנה חסרה, השתמשי בשנה הנוכחית: ${new Date().getFullYear()}
- תעתוק מאנגלית לעברית: אם שם השולח/ת או שם ילד/ה כתוב באנגלית, תעתקי אותו לכתיב עברי תקני (למשל "Rami Meiron" → "רמי מירון"). אם שם המשפחה מופיע גם בעברית וגם באנגלית באותה שורה ("צפי ברנר אמא עמליה Brenner"), אין לכפול אותו ("צפי ברנר").
- payerName: היכן לחפש את שם השולח/ת:
  1. בשורת הכותרת בראש המסך מעל הסכום (₪), אחרי "העברה מ" / "התקבל מ" / "מאת " — הסירי רק את מילת היחס ("העברה מ") והחזירי את כל השם שאחריה (גם אם יש בו 2–4 מילים ובלי "אמא"):
     * "העברה מעידית ברבי שני" → "עידית ברבי שני"
     * "העברה מספיר אמא עימרי ואלה" → "ספיר אמא עימרי ואלה"
     * "העברה ממיכל" → "מיכל" (לא להסיר מ' ששייכת לשם)
     * "העברה מצפי ברנר אמא עמליה Brenner" → "צפי ברנר אמא עמליה Brenner"
  2. או בשורה "הועבר על ידי" (למשל "הועבר על ידי: Rami Meiron" → "רמי מירון").
  אם הכותרת מתחילה ב-"העברה מ...", payerName לעולם אינו null! השדות "הועבר אל" ו-"עבור <טלפון>" הם המקבל/הסטודיו (${OWNER_NAMES.join(' / ')}) — לא להחזיר אותם כ-payerName.
- payerOwnName: השם של המשלם/ת עצמו/ה בלבד בעברית. אם בשם השולח אין "אמא" או "אבא", החזירי את payerName כפי שהוא (בלי לחתוך מילים מהשם!):
  * "עידית ברבי שני" → "עידית ברבי שני"
  * "רמי מירון" → "רמי מירון"
  * "דנה לוי" → "דנה לוי"
  אם מופיע תיאור הורות ("אמא", "אבא", "אמא של..."), הסירי אותו, את שמות הילדים, ושם משפחה כפול באנגלית אחרי שם הילד:
  * "ספיר אמא עימרי ואלה" → "ספיר"
  * "צפי ברנר אמא עמליה Brenner" → "צפי ברנר"
  * "מיכל - אמא של איתי" → "מיכל"
  * "אמא של נועה" → null (אין שם עצמי)
- payerChildren: רשימת השמות הפרטיים של הילדים שמופיעים בשם השולח אחרי "אמא" / "אבא" (עם או בלי "של"), בעברית. כל ילד/ה כפריט נפרד, בלי ו' החיבור ובלי שם משפחה:
  * "ספיר אמא עימרי ואלה" → ["עימרי", "אלה"]
  * "צפי ברנר אמא עמליה Brenner" → ["עמליה"]
  * "עידית ברבי שני" → []
  * "רמי מירון" → []
- method: זיהוי אמצעי התשלום — paybox (לוגו PayBox / "יותר טוב מבנק" או ממשק פייבוקס), bit (לוגו/ממשק ביט), bank (העברה בנקאית), cash, credit, other
- note: הטקסט המלא והמדויק בשדה "הערה" / "הודעה" / "תיאור", אם יש. שורה כמו "עבור 972-545901045" (מספר טלפון של המקבל) אינה הערה — במקרה כזה החזירי null
- reference: מספר אישור / אסמכתא / מספר עסקה / מזהה העברה (כולל מחרוזות אלפא-נומריות כמו "294fd0141e971ff38d8"), אם יש
- childName: אך ורק אם טקסט ההערה (note) מציין במפורש עבור איזה ילד/ה התשלום — השם הפרטי של הילד/ה בלבד (בעברית). בעלת הסטודיו היא ${OWNER_NAMES.join(' / ')} — לעולם לא להחזיר את שמה או מספר טלפון כ-childName. אל תעתיקי לכאן שמות מתוך payerChildren אם הם לא הופיעו בהערה עצמה, ואל תנחשי — אם אין שם ילד/ה בהערה, החזירי null
- activity: עבור איזו פעילות/חוג/קייטנה התשלום מתוך ההערה, כולל יום/שעה/חודש אם מופיעים, ובלי שם הילד/ה או בעלת הסטודיו. לא לקצר שם של חוג:
  * "חוג חמישי נובמבר" → "חוג חמישי נובמבר"
  * "דמי הרשמה קייטנת חנוכה" → "קייטנת חנוכה"
  * "הרשמה קייטנת חנוכה" → "קייטנת חנוכה"
  * "קייטנת אומנות של מעיין 2026" → "קייטנת אומנות 2026"
  אם לא כתובה פעילות בהערה — null`;

function modelId(): string {
  // Accept a display name like "Gemini 3.1 Flash Lite" and normalize it to an API id
  return (process.env.GEMINI_MODEL || 'gemini-2.5-flash').trim().replace(/^"|"$/g, '').replace(/\s+/g, '-').toLowerCase();
}

function client(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('חסר GEMINI_API_KEY');
  return new GoogleGenAI({ apiKey });
}

export async function extractPayments(base64: string, mimeType: string): Promise<ExtractedPayment[]> {
  return (await extractPaymentsDebug(base64, mimeType)).payments;
}

/** Same reading, plus Gemini's answer exactly as it came back (shown in the scan card's debug block). */
export async function extractPaymentsDebug(base64: string, mimeType: string): Promise<{ payments: ExtractedPayment[]; raw: string; model: string }> {
  const res = await client().models.generateContent({
    model: modelId(),
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
                payerOwnName: { type: Type.STRING, nullable: true },
                payerChildren: { type: Type.ARRAY, items: { type: Type.STRING } },
                method: { type: Type.STRING, enum: [...METHODS] },
                note: { type: Type.STRING, nullable: true },
                reference: { type: Type.STRING, nullable: true },
                childName: { type: Type.STRING, nullable: true },
                activity: { type: Type.STRING, nullable: true },
              },
              required: ['amount', 'payerName', 'method'],
            },
          },
        },
        required: ['payments'],
      },
    },
  });
  // Raw answer, before any clean-up — shows whether a missing field is Gemini's or ours
  console.log(`[scan debug] gemini (${modelId()}) raw answer:`, res.text);
  const parsed = JSON.parse(res.text || '{}');
  const list: any[] = Array.isArray(parsed.payments) ? parsed.payments : [];
  // Gemini may return numbers where we expect strings (e.g. a numeric reference) — coerce everything
  const str = (v: unknown) => (v == null || v === '' ? null : String(v));
  const payments = list.map((p) => ({
    amount: p.amount != null ? Number(p.amount) : null,
    date: /^\d{4}-\d{2}-\d{2}$/.test(str(p.date) || '') ? str(p.date) : null,
    payerName: str(p.payerName),
    payerOwnName: str(p.payerOwnName),
    payerChildren: (Array.isArray(p.payerChildren) ? p.payerChildren : []).map((n: unknown) => String(n ?? '').trim()).filter((n: string) => n && !OWNER_NAMES.includes(n)),
    method: (METHODS as readonly string[]).includes(p.method) ? p.method : 'other',
    note: str(p.note),
    reference: str(p.reference),
    // belt and braces: drop the owner's name if the model returned it anyway
    childName: OWNER_NAMES.includes((str(p.childName) || '').trim()) ? null : str(p.childName),
    activity: str(p.activity),
  }));
  return { payments, raw: res.text || '', model: modelId() };
}

// ---------- registration text (new customer) ----------

export type ExtractedRegistration = {
  childFirst: string | null;
  childFamily: string | null;
  gender: string | null; // "בן" | "בת"
  payerName: string | null;
  payerPhone: string | null;
  payerEmail: string | null;
  payer2Name: string | null;
  payer2Phone: string | null;
  payer2Email: string | null;
  activity: string | null; // free-text hint: camp name or class day/time
  paidAmount: number | null;
  method: PaymentMethod | null;
  paidDate: string | null; // YYYY-MM-DD
};

const REG_PROMPT = `זהו טקסט הרשמה שהורה שלח לסטודיו לאומנות לילדים (למשל הודעת וואטסאפ). חלצי ממנו:
- childFirst / childFamily: שם פרטי ושם משפחה של הילד/ה
- gender: "בן" או "בת" אם אפשר להסיק (משם או ניסוח), אחרת null
- payerName: שם ההורה המשלם/ת (שם מלא); payerPhone: טלפון נייד; payerEmail: אימייל לקבלות
- payer2Name / payer2Phone / payer2Email: הורה שני אם מופיע
- activity: לאיזו פעילות נרשמים — שם קייטנה (למשל "קייטנת חנוכה") או יום ושעה של חוג (למשל "ראשון 16:00"), כפי שמופיע בטקסט
- paidAmount: סכום ששולם כבר (מקדמה/דמי הרשמה), מספר בלבד; method: אחד מ- bit, paybox, bank, cash, credit, other; paidDate: תאריך התשלום YYYY-MM-DD (שנה נוכחית: ${new Date().getFullYear()})
אם שדה לא מופיע — null. אל תמציאי פרטים.`;

export async function extractRegistration(text: string): Promise<ExtractedRegistration> {
  const nullable = (t: Type) => ({ type: t, nullable: true });
  const res = await client().models.generateContent({
    model: modelId(),
    contents: [{ role: 'user', parts: [{ text: REG_PROMPT }, { text }] }],
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          childFirst: nullable(Type.STRING), childFamily: nullable(Type.STRING), gender: nullable(Type.STRING),
          payerName: nullable(Type.STRING), payerPhone: nullable(Type.STRING), payerEmail: nullable(Type.STRING),
          payer2Name: nullable(Type.STRING), payer2Phone: nullable(Type.STRING), payer2Email: nullable(Type.STRING),
          activity: nullable(Type.STRING), paidAmount: nullable(Type.NUMBER),
          method: { type: Type.STRING, enum: [...METHODS], nullable: true }, paidDate: nullable(Type.STRING),
        },
      },
    },
  });
  const p = JSON.parse(res.text || '{}');
  const str = (v: unknown) => (v == null || v === '' ? null : String(v));
  return {
    childFirst: str(p.childFirst), childFamily: str(p.childFamily),
    gender: ['בן', 'בת'].includes(p.gender) ? p.gender : null,
    payerName: str(p.payerName), payerPhone: str(p.payerPhone), payerEmail: str(p.payerEmail),
    payer2Name: str(p.payer2Name), payer2Phone: str(p.payer2Phone), payer2Email: str(p.payer2Email),
    activity: str(p.activity),
    paidAmount: p.paidAmount != null ? Number(p.paidAmount) : null,
    method: (METHODS as readonly string[]).includes(p.method) ? p.method : null,
    paidDate: /^\d{4}-\d{2}-\d{2}$/.test(str(p.paidDate) || '') ? str(p.paidDate) : null,
  };
}
