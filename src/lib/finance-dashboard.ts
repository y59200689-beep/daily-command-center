import { effectiveInvoiceStatus } from "@/lib/v2";
export type FinanceRow = Record<string, unknown> & { id: string };
export type FinanceRecords = Record<"invoices" | "payments" | "expenses" | "subscriptions" | "clients", FinanceRow[]>;
export const financeCurrency = (row: FinanceRow) => String(row.currency || "USD");
export const financeAmount = (row: FinanceRow, field = "amount") => Number(row[field] ?? 0);
export function financeMonth(offset = 0, now = new Date()) { return new Date(Date.UTC(now.getFullYear(), now.getMonth() + offset, 1)).toISOString().slice(0, 7); }
export function financeSnapshot(records: FinanceRecords, currency: string, month: string, today: string) {
  const invoices = records.invoices.filter(row => financeCurrency(row) === currency).map<FinanceRow & { effective_status: string }>(row => ({ ...row, effective_status: row.status === "draft" ? "draft" : effectiveInvoiceStatus({ status: String(row.status), due_date: row.due_date as string | null, amount_remaining: Number(row.amount_remaining ?? 0) }, today) }));
  const open = invoices.filter(row => !["paid", "cancelled", "draft"].includes(row.effective_status));
  const expected = open.filter(row => String(row.due_date ?? "").startsWith(month));
  const overdue = open.filter(row => row.effective_status === "overdue");
  const payments = records.payments.filter(row => financeCurrency(row) === currency && String(row.payment_date ?? "").startsWith(month));
  const expenses = records.expenses.filter(row => financeCurrency(row) === currency && String(row.expense_date ?? "").startsWith(month));
  const sum = (rows: FinanceRow[], field = "amount") => rows.reduce((total, row) => total + financeAmount(row, field), 0);
  const received = sum(payments), spent = sum(expenses);
  return { invoices, open, expected, overdue, payments, expenses, metrics: { expected: sum(expected, "amount_remaining"), received, outstanding: sum(open, "amount_remaining"), overdue: sum(overdue, "amount_remaining"), expenses: spent, net: received - spent } };
}
export function financeHistory(records: FinanceRecords, currency: string, month: string, count: number) {
  const [year, index] = month.split("-").map(Number);
  return Array.from({ length: count }, (_, i) => { const date = new Date(Date.UTC(year, index - count + i, 1)); const key = date.toISOString().slice(0, 7); const total = (rows: FinanceRow[], field: string) => rows.filter(row => financeCurrency(row) === currency && String(row[field] ?? "").startsWith(key)).reduce((sum, row) => sum + financeAmount(row), 0); return { month: key, label: date.toLocaleDateString("en", { month: "short", timeZone: "UTC" }), received: total(records.payments, "payment_date"), expenses: total(records.expenses, "expense_date") }; });
}
export function renewingSubscriptions(records: FinanceRecords, currency: string, today: string) { const end = new Date(`${today}T12:00:00Z`); end.setUTCDate(end.getUTCDate() + 30); return records.subscriptions.filter(row => financeCurrency(row) === currency && row.status === "active" && String(row.next_billing_date ?? "") >= today && String(row.next_billing_date ?? "") <= end.toISOString().slice(0, 10)).sort((a,b) => String(a.next_billing_date).localeCompare(String(b.next_billing_date))); }
export async function loadFinanceRecords(signal: AbortSignal): Promise<FinanceRecords> {
  const entries = await Promise.all((["invoices", "payments", "expenses", "subscriptions", "clients"] as const).map(async domain => { const rows: FinanceRow[] = []; let page = 1, total = 0; do { const response = await fetch(`/api/entities/${domain}?pageSize=100&page=${page}`, { cache: "no-store", signal }); const body = await response.json(); if (!response.ok || !Array.isArray(body.records)) throw new Error(body.error || `Could not load ${domain}.`); rows.push(...body.records); total = body.total ?? rows.length; if (!body.records.length) break; page++; } while (rows.length < total); return [domain, rows] as const; }));
  return Object.fromEntries(entries) as FinanceRecords;
}
