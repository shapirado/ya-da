export type ChildPriceRow = { amount: number; effectiveFrom: string }; // 'YYYY-MM-01'
export type ReceiptLineRow = { month: string; amount: number }; // 'YYYY-MM-01'
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
        .reduce((sum, line) => sum + line.amount, 0);
      const status = paid === due ? 'paid' : paid > 0 && paid < due ? 'partial' : 'missing';
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
