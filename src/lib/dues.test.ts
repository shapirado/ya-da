import { computeDueStatus } from './dues';

test('a fully paid month is status paid', () => {
  const result = computeDueStatus('2026-11-01',
    [{ amount: 300, effectiveFrom: '2026-09-01' }],
    [{ month: '2026-11-01', amount: 300 }], '2026-11-01');
  expect(result).toEqual([{ month: '2026-11-01', due: 300, paid: 300, status: 'paid' }]);
});

test('a partially paid month is status partial', () => {
  const result = computeDueStatus('2026-11-01',
    [{ amount: 300, effectiveFrom: '2026-09-01' }],
    [{ month: '2026-11-01', amount: 150 }], '2026-11-01');
  expect(result[0]).toMatchObject({ due: 300, paid: 150, status: 'partial' });
});

test('two receipt lines in the same month sum together', () => {
  const result = computeDueStatus('2026-11-01',
    [{ amount: 300, effectiveFrom: '2026-09-01' }],
    [{ month: '2026-11-01', amount: 150 }, { month: '2026-11-01', amount: 150 }],
    '2026-11-01');
  expect(result[0]).toMatchObject({ paid: 300, status: 'paid' });
});

test('a price change only applies from its effective month forward', () => {
  const result = computeDueStatus('2026-10-01',
    [{ amount: 300, effectiveFrom: '2026-09-01' }, { amount: 330, effectiveFrom: '2026-11-01' }],
    [], '2026-11-01');
  expect(result).toEqual([
    { month: '2026-10-01', due: 300, paid: 0, status: 'missing' },
    { month: '2026-11-01', due: 330, paid: 0, status: 'missing' },
  ]);
});

test('a month before any price row covers it is skipped, not a phantom due', () => {
  const result = computeDueStatus('2026-09-01',
    [{ amount: 300, effectiveFrom: '2026-11-01' }],
    [], '2026-11-01');
  expect(result).toEqual([{ month: '2026-11-01', due: 300, paid: 0, status: 'missing' }]);
});
