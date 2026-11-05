export type ChildPriceRow = { amount: number; effectiveFrom: string }; // 'YYYY-MM-01'
// month/amount may be null on a receipt line that hasn't been resolved yet
// (an unmatched webhook line has no month; a multi-cell manual payment's
// lines have no per-line amount until someone splits it in the review
// queue). Such lines never count toward any month's paid total.
export type ReceiptLineRow = { month: string | null; amount: number | null }; // 'YYYY-MM-01'
export type MonthStatus = {
  month: string;
  due: number;
  paid: number;
  status: 'paid' | 'partial' | 'missing';
};

export function priceForMonth(prices: ChildPriceRow[], month: string): number | null {
  let current: ChildPriceRow | null = null;
  for (const row of prices) {
    if (row.effectiveFrom <= month && (current === null || row.effectiveFrom > current.effectiveFrom)) {
      current = row;
    }
  }
  return current === null ? null : current.amount;
}

export function computeDueStatus(
  enrollmentStart: string,
  prices: ChildPriceRow[],
  lines: ReceiptLineRow[],
  asOfMonth: string,
): MonthStatus[] {
  const result: MonthStatus[] = [];
  let year = Number(enrollmentStart.slice(0, 4));
  let monthNumber = Number(enrollmentStart.slice(5, 7));

  for (;;) {
    const month = `${year}-${String(monthNumber).padStart(2, '0')}-01`;
    if (month > asOfMonth) break;

    const due = priceForMonth(prices, month);
    if (due !== null) {
      const paid = lines
        .filter((line) => line.month === month)
        // A null (not-yet-split) amount counts as 0, so the month keeps
        // showing as missing until the line is resolved with a real amount.
        .reduce((sum, line) => sum + (line.amount ?? 0), 0);
      const status = paid >= due ? 'paid' : paid > 0 ? 'partial' : 'missing';
      result.push({ month, due, paid, status });
    }

    monthNumber += 1;
    if (monthNumber > 12) {
      monthNumber = 1;
      year += 1;
    }
  }

  return result;
}
