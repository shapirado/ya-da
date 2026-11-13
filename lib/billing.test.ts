import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allocate, effectivePrice, familyDebts, openCharges, type Model } from './billing.ts';
import { rankPayers, normName } from './matching.ts';
import { fmtDate, monthsBetween, seasonFor, todayISO } from './dates.ts';

const model: Model = {
  today: '2026-11-13',
  groups: [{ id: 'g1', day: 'שני', time: '17:00', color: '#3446C4' }],
  activities: [
    { id: 1, name: null, start_date: '2026-10-01', end_date: '2026-10-31', color: null, default_price: 280, morning_item_id: null, activity_type: 'חוג', class_group_id: 'g1' },
    { id: 2, name: null, start_date: '2026-11-01', end_date: '2026-11-30', color: null, default_price: 280, morning_item_id: null, activity_type: 'חוג', class_group_id: 'g1' },
    { id: 3, name: null, start_date: '2026-12-01', end_date: '2026-12-31', color: null, default_price: 280, morning_item_id: null, activity_type: 'חוג', class_group_id: 'g1' },
    { id: 4, name: 'קייטנת חנוכה', start_date: '2026-12-06', end_date: '2026-12-10', color: '#8E5BD9', default_price: 650, morning_item_id: null, activity_type: 'קייטנה', class_group_id: null },
  ],
  children: [
    { id: 'c1', first_name: 'איתי', family_name: 'כהן', gender: 'בן', morning_customer_id: 'p1', morning_customer_id_2: null },
    { id: 'c2', first_name: 'שירה', family_name: 'כהן', gender: 'בת', morning_customer_id: 'p1', morning_customer_id_2: null },
  ],
  links: [
    { id: 11, child_id: 'c1', activity_id: 1, price: 260, payment_status: 'paid', invoices: null, paid_amount: 260 },
    { id: 12, child_id: 'c1', activity_id: 2, price: 260, payment_status: 'unpaid', invoices: null, paid_amount: 0 },
    { id: 13, child_id: 'c1', activity_id: 3, price: 260, payment_status: 'unpaid', invoices: null, paid_amount: 0 },
    { id: 22, child_id: 'c2', activity_id: 2, price: 260, payment_status: 'unpaid', invoices: null, paid_amount: 0 },
    { id: 24, child_id: 'c2', activity_id: 4, price: null, payment_status: 'unpaid', invoices: null, paid_amount: 0 },
  ],
  payers: [{ morning_customer_id: 'p1', name: 'רון כהן', phone: '0520000002', email: null }],
  settings: { default_full_price: 280, default_discount_price: 260 },
};

test('price falls back activity → settings', () => {
  assert.equal(effectivePrice({ price: null }, { default_price: null }, model.settings), 280);
  assert.equal(effectivePrice({ price: 240 }, { default_price: 280 }, model.settings), 240);
});

test('only started, unpaid months are open', () => {
  const open = openCharges(model).map((c) => c.linkId);
  assert.deepEqual(open.sort(), [12, 22]); // Dec class + Dec camp not started yet
  const fam = familyDebts(model);
  assert.equal(fam.length, 1);
  assert.equal(fam[0].total, 520);
});

test('exact subset allocation', () => {
  const r = allocate(520, openCharges(model));
  assert.equal(r.leftover, 0);
  assert.deepEqual(r.allocations.map((a) => a.linkId).sort(), [12, 22]);
});

test('partial allocation pays named child first', () => {
  const r = allocate(100, openCharges(model), ['c2']);
  assert.deepEqual(r.allocations, [{ linkId: 22, amount: 100 }]);
});

test('alias and name matching', () => {
  const debt = new Map([['p1', 520]]);
  const base = { note: 'חוג נובמבר איתי ושירה', amount: 520, payers: model.payers, children: model.children, debtByPayer: debt };
  const byAlias = rankPayers({ ...base, rawName: 'ענת כהן', aliases: [{ id: 'a', payer_id: 'p1', raw_name: 'ענת  כהן' }] });
  assert.equal(byAlias[0].reason, 'alias');
  const byFamily = rankPayers({ ...base, rawName: 'ענת כהן', aliases: [] });
  assert.equal(byFamily[0].payerId, 'p1');
  assert.deepEqual(byFamily[0].matchedChildIds.sort(), ['c1', 'c2']);
  assert.equal(normName('כֹּהֵן'), 'כהנ');
});

test('dates', () => {
  assert.equal(fmtDate('2026-11-05'), '05/11/2026');
  assert.equal(monthsBetween('2026-10-01', '2027-06-30').length, 9);
  assert.deepEqual(seasonFor('2027-02-10'), { start: '2026-10-01', end: '2027-06-30' });
  assert.match(todayISO(), /^\d{4}-\d{2}-\d{2}$/);
});
