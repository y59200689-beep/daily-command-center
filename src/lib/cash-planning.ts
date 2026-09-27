import type { FinancialRow } from './financial-control';

/** Actual recorded cash movements, grouped by calendar month and currency. */
export function cashMovementHistory(
  payments: FinancialRow[],
  obligations: FinancialRow[],
  currency: string,
  today: string,
  count: number,
) {
  const [year, month] = today.split('-').map(Number);
  const settled = obligations.filter(row => row.status === 'paid');
  return Array.from({ length: count }, (_, index) => {
    const start = new Date(Date.UTC(year, month - count + index, 1));
    const key = start.toISOString().slice(0, 7);
    const sum = (rows: FinancialRow[], field: string) => rows
      .filter(row => String(row.currency ?? '').trim() === currency
        && String(row[field] ?? '').startsWith(key)
        && String(row[field]).slice(0, 10) <= today)
      .reduce((total, row) => total + Number(row.amount ?? 0), 0);
    return {
      month: key,
      label: start.toLocaleDateString('en', { month: 'short', timeZone: 'UTC' }),
      inflow: sum(payments, 'payment_date'),
      outflow: sum(settled, 'paid_at'),
    };
  });
}

export function reserveCoverage(balance: number | null, target: number | null) {
  return balance === null || target === null || target <= 0
    ? null
    : Math.max(0, Math.round(balance / target * 100));
}
