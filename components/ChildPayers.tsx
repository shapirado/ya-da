'use client';

import { useState } from 'react';

export type PayerContact = { id: string; name: string; phone: string; email: string };
/** payer 1's contact in Morning (contactPerson / mobile / emails[1]) */
export type MorningContact = { name: string; phone: string; email: string };

/**
 * Child page "פרטים": payer 1 and the second parent. Phones/emails come from Morning and are saved back to it.
 * The second parent is one of:
 * - an existing payer (morning_customer_id_2)
 * - "יצירת חדש": a new Morning customer, or — with "הוספה כאיש/אשת קשר" — payer 1's contact
 * - payer 1's contact already in Morning (shown with the box ticked and locked)
 * "הסרה" clears it (a contact is cleared in Morning too).
 */
export function ChildPayers({ payers, payer1, payer2, contact }: { payers: PayerContact[]; payer1: string | null; payer2: string | null; contact: MorningContact | null }) {
  const initial: Mode = payer2 ? 'existing' : contact ? 'contact' : 'add';
  const [mode, setMode] = useState<Mode>(initial);
  const [contactRemoved, setContactRemoved] = useState(false);

  const remove = () => {
    if (mode === 'contact') setContactRemoved(true);
    setMode(initial === 'existing' ? 'none' : 'add');
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-6">
      <PayerBlock payers={payers} initial={payer1} />
      {contactRemoved && <input type="hidden" name="contact_remove" value="1" />}
      {mode === 'add' || mode === 'none' ? (
        <div className="flex items-start sm:pt-[26px]">
          {mode === 'none' && <input type="hidden" name="p2_mode" value="none" />}
          <button type="button" onClick={() => setMode('existing')} className="btn-secondary w-full sm:w-auto" title="אוסיף משלם/ת נוסף/ת לילד/ה">
            + הוספת משלם/ת שני/ה
          </button>
        </div>
      ) : (
        <SecondPayer payers={payers} initial={mode === 'existing' ? payer2 : null} contact={mode === 'contact' ? contact : null} onRemove={remove} />
      )}
    </div>
  );
}

type Mode = 'add' | 'none' | 'existing' | 'contact';
const NEW = '__new__';

function PayerBlock({ payers, initial }: { payers: PayerContact[]; initial: string | null }) {
  const find = (id: string) => payers.find((p) => p.id === id);
  const [id, setId] = useState(initial || '');
  const [phone, setPhone] = useState(find(initial || '')?.phone || '');
  const [email, setEmail] = useState(find(initial || '')?.email || '');
  return (
    <div className="flex flex-col gap-2.5 min-w-0">
      <label className="label">משלם/ת
        <select name="payer" value={id} onChange={(e) => { const p = find(e.target.value); setId(e.target.value); setPhone(p?.phone || ''); setEmail(p?.email || ''); }} className="input">
          {!id && <option value="">בחרי משלם/ת</option>}
          {payers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      <Contact k="1" phone={phone} email={email} setPhone={setPhone} setEmail={setEmail} disabled={!id} />
    </div>
  );
}

function SecondPayer({ payers, initial, contact, onRemove }: { payers: PayerContact[]; initial: string | null; contact: MorningContact | null; onRemove: () => void }) {
  const find = (id: string) => payers.find((p) => p.id === id);
  // contact mode: payer 1's Morning contact, edited in place
  const [sel, setSel] = useState(contact ? NEW : initial || NEW);
  const [name, setName] = useState(contact?.name || '');
  const [phone, setPhone] = useState(contact ? contact.phone : find(initial || '')?.phone || '');
  const [email, setEmail] = useState(contact ? contact.email : find(initial || '')?.email || '');
  const [asContact, setAsContact] = useState(false);
  const isNew = sel === NEW;
  const mode = contact ? 'contact' : isNew ? 'new' : 'existing';

  return (
    <div className="flex flex-col gap-2.5 min-w-0">
      <input type="hidden" name="p2_mode" value={mode} />
      <div className="flex items-end gap-2">
        {contact ? (
          <label className="label flex-1 min-w-0">משלם/ת 2 · איש/אשת קשר
            <input name="p2_name" value={name} onChange={(e) => setName(e.target.value)} placeholder="שם" className="input" required />
          </label>
        ) : (
          <label className="label flex-1 min-w-0">משלם/ת 2
            <select name="payer2" value={sel} onChange={(e) => { const p = find(e.target.value); setSel(e.target.value); setPhone(p?.phone || ''); setEmail(p?.email || ''); }} className="input">
              <option value={NEW}>יצירת חדש</option>
              {payers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
        )}
        <button type="button" onClick={onRemove} className="min-h-11 px-2 text-sm text-bad bg-transparent border-0 cursor-pointer underline flex-none"
          title={contact ? 'אסיר את איש/אשת הקשר גם ב-Morning' : 'אסיר את המשלם/ת השני/ה מהילד/ה'}>הסרה</button>
      </div>
      {!contact && isNew && (
        <label className="label">שם
          <input name="p2_name" value={name} onChange={(e) => setName(e.target.value)} placeholder="שם מלא" className="input" required />
        </label>
      )}
      <Contact k="2" phone={phone} email={email} setPhone={setPhone} setEmail={setEmail} />
      {(contact || isNew) && (
        <label className="flex items-center gap-2 text-sm min-h-11">
          <input type="checkbox" name={contact ? undefined : 'payer2_contact'} checked={contact ? true : asContact} disabled={!!contact}
            onChange={(e) => setAsContact(e.target.checked)} className="w-[18px] h-[18px] accent-accent" />
          הוספה כאיש/אשת קשר
          <span className="text-xs text-muted">{contact || asContact ? '· על הלקוח/ה של המשלם/ת הראשון/ה ב-Morning' : '· לקוח/ה חדש/ה ב-Morning'}</span>
        </label>
      )}
    </div>
  );
}

function Contact({ k, phone, email, setPhone, setEmail, disabled = false }: { k: '1' | '2'; phone: string; email: string; setPhone: (v: string) => void; setEmail: (v: string) => void; disabled?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      <label className="label min-w-0">נייד
        <input name={`phone_${k}`} value={phone} onChange={(e) => setPhone(e.target.value)} disabled={disabled} dir="ltr" inputMode="tel" placeholder="חסר" className="input text-right disabled:bg-page" title="נשמר ב-Morning" />
      </label>
      <label className="label min-w-0">אימייל
        <input name={`email_${k}`} value={email} onChange={(e) => setEmail(e.target.value)} disabled={disabled} dir="ltr" type="email" placeholder="חסר" className="input text-right disabled:bg-page" title="נשמר ב-Morning" />
      </label>
    </div>
  );
}
