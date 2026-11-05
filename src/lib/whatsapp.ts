export type ReminderItem = {
  childName: string;
  className: string;
  monthsOwed: string[];
};

export type ReminderMessageInput = {
  parentFirstName: string;
  items: ReminderItem[];
  total: number;
};

// Builds the ready-to-send reminder text per ScreenWhatsApp's tone: polite
// and personal, naming the parent, each child/class, the months owed, and
// the total due.
export function buildReminderMessage(input: ReminderMessageInput): string {
  const { parentFirstName, items, total } = input;

  const lines = items.map(
    (item) => `${item.childName} (${item.className}) - ${item.monthsOwed.join(', ')}`,
  );

  return [
    `היי ${parentFirstName}, שלום וברכה 🙂`,
    `רציתי להזכיר בעדינות שנותר תשלום פתוח עבור:`,
    ...lines,
    ``,
    `סך הכול לתשלום: ${total.toLocaleString('he-IL')} ₪`,
    ``,
    `תודה רבה ויום נעים!`,
  ].join('\n');
}

// Formats an Israeli phone number to international (E.164-ish) digits: strips
// everything but digits, then swaps a leading local trunk "0" for "972".
// A number already given in international form (starting "972") passes
// through unchanged.
function formatIsraeliPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('972')) return digits;
  if (digits.startsWith('0')) return `972${digits.slice(1)}`;
  return digits;
}

// Builds a wa.me deep link that opens WhatsApp with the message pre-filled,
// ready for the user to review and send themselves.
export function buildWhatsAppLink(phone: string, message: string): string {
  const internationalPhone = formatIsraeliPhone(phone);
  return `https://wa.me/${internationalPhone}?text=${encodeURIComponent(message)}`;
}
