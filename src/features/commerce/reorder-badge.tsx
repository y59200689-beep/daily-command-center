import type { ReorderState } from "@/lib/commerce";

export function ReorderBadge({ state }: { state: ReorderState }) {
  const styles: Record<ReorderState, { bg: string; text: string; border: string; label: string }> = {
    reorder_now: { bg: "bg-red-500/10", text: "text-red-600 dark:text-red-400", border: "border-red-500/30", label: "Reorder Now" },
    review_soon: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", border: "border-amber-500/30", label: "Review Soon" },
    sufficient_stock: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-500/30", label: "Sufficient" },
    pause_replenishment: { bg: "bg-zinc-500/10", text: "text-zinc-500 dark:text-zinc-400", border: "border-zinc-500/30", label: "Paused" },
    insufficient_data: { bg: "bg-slate-500/10", text: "text-slate-500 dark:text-slate-400", border: "border-slate-500/30", label: "No Data" },
  };

  const current = styles[state] || styles.insufficient_data;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${current.bg} ${current.text} ${current.border}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {current.label}
    </span>
  );
}
