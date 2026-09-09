import { MovementsView } from "@/features/commerce/movements-view";

export const metadata = {
  title: "Stock Movements | Daily Command Center",
  description: "Chronological audit trail of sales deductions, supplier receipts, and manual adjustments.",
};

export default function MovementsPage() {
  return <MovementsView />;
}
