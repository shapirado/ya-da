import { buildReminderMessage, buildWhatsAppLink, type ReminderItem } from "@/src/lib/whatsapp";

export type WhatsAppReminderProps = {
  parentFirstName: string;
  phone: string | null;
  items: ReminderItem[];
  total: number;
};

// A "ready to send" WhatsApp reminder: shows the recipient, a preview of the
// pre-filled message in a chat-bubble, the (so far untracked) last-sent
// date, and a button that opens wa.me with the message ready to go. Nothing
// is sent automatically - the user still taps send inside their own
// WhatsApp.
export default function WhatsAppReminder({ parentFirstName, phone, items, total }: WhatsAppReminderProps) {
  if (items.length === 0) return null;

  if (!phone) {
    return (
      <div className="yd-card yd-pad yd-stack">
        <span className="small muted">תזכורת WhatsApp</span>
        <p className="small muted">לא הוזן מספר טלפון להורה, לא ניתן לשלוח תזכורת</p>
      </div>
    );
  }

  const message = buildReminderMessage({ parentFirstName, items, total });
  const link = buildWhatsAppLink(phone, message);

  return (
    <div className="yd-card yd-pad yd-stack">
      <span className="small muted">תזכורת WhatsApp</span>

      <div className="yd-row" style={{ justifyContent: "space-between" }}>
        <span>אל {parentFirstName}</span>
        <span className="small muted">{phone}</span>
      </div>

      <div className="yd-bubble">{message}</div>

      <span className="small muted">תזכורת אחרונה: עדיין לא נשלחה</span>

      <a href={link} target="_blank" rel="noopener noreferrer" className="yd-btn whatsapp block">
        פתיחה ב-WhatsApp
      </a>
    </div>
  );
}
