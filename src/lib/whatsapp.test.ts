import { buildReminderMessage, buildWhatsAppLink } from './whatsapp';

test('message includes the parent name, child/class, and total', () => {
  const msg = buildReminderMessage({
    parentFirstName: 'רחל',
    items: [{ childName: 'הלל', className: 'שלישי 17:00', monthsOwed: ['אוקטובר', 'נובמבר'] }],
    total: 660,
  });
  expect(msg).toContain('רחל');
  expect(msg).toContain('הלל');
  expect(msg).toContain('660');
});

test('message includes the class name and owed months', () => {
  const msg = buildReminderMessage({
    parentFirstName: 'רחל',
    items: [{ childName: 'הלל', className: 'שלישי 17:00', monthsOwed: ['אוקטובר', 'נובמבר'] }],
    total: 660,
  });
  expect(msg).toContain('שלישי 17:00');
  expect(msg).toContain('אוקטובר');
  expect(msg).toContain('נובמבר');
});

test('message lists every child when there is more than one', () => {
  const msg = buildReminderMessage({
    parentFirstName: 'דנה',
    items: [
      { childName: 'נועה', className: 'שני 16:00', monthsOwed: ['ספטמבר'] },
      { childName: 'איתן', className: 'רביעי 18:00', monthsOwed: ['אוקטובר'] },
    ],
    total: 500,
  });
  expect(msg).toContain('נועה');
  expect(msg).toContain('איתן');
  expect(msg).toContain('500');
});

test('whatsapp link url-encodes the message and formats the phone', () => {
  const link = buildWhatsAppLink('050-1234567', 'שלום');
  expect(link).toBe('https://wa.me/972501234567?text=' + encodeURIComponent('שלום'));
});

test('whatsapp link strips non-digit characters from a phone with spaces/parens', () => {
  const link = buildWhatsAppLink('(052) 987 6543', 'הי');
  expect(link).toBe('https://wa.me/972529876543?text=' + encodeURIComponent('הי'));
});

test('whatsapp link leaves an already-international phone number untouched', () => {
  const link = buildWhatsAppLink('+972501234567', 'הי');
  expect(link).toBe('https://wa.me/972501234567?text=' + encodeURIComponent('הי'));
});
