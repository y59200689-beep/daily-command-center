import type { loadFinancialControl } from "@/lib/financial-server";
export type FinancialOverview = Awaited<ReturnType<typeof loadFinancialControl>>;
export type FinancialSummary = Pick<FinancialOverview, "cash" | "runway" | "limitations">;
export function financialSummary(financial: FinancialOverview | null): FinancialSummary | null {
  return financial ? { cash: financial.cash, runway: financial.runway, limitations: financial.limitations } : null;
}
