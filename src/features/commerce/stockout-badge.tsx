import type { StockoutRiskState } from "@/lib/commerce";

export function StockoutBadge({ state, coverageDays }: { state: StockoutRiskState; coverageDays?: number | null }) {
  const styles: Record<StockoutRiskState, { bg: string; text: string; border: string; label: string }> = {
    critical: { bg: "bg-red-500/10", text: "text-red-600 dark:text-red-400", border: "border-red-500/30", label: "Critical Stockout" },
    high: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", border: "border-amber-500/30", label: "High Risk" },
    watch: { bg: "bg-yellow-500/10", text: "text-yellow-600 dark:text-yellow-400", border: "border-yellow-500/30", label: "Watch" },
    safe: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-500/30", label: "Safe" },
    unknown: { bg: "bg-zinc-500/10", text: "text-zinc-500 dark:text-zinc-400", border: "border-zinc-500/30", label: "No Velocity" },
  };

  const current = styles[state] || styles.unknown;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${current.bg} ${current.text} ${current.border}`}
      title={coverageDays !== null && coverageDays !== undefined ? `${coverageDays} days coverage` : undefined}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {current.label}
      {coverageDays !== null && coverageDays !== undefined ? ` (${coverageDays}d)` : ""}
    </span>
  );
}
