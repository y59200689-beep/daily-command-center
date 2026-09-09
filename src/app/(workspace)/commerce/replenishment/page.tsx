import { ReplenishmentView } from "@/features/commerce/replenishment-view";

export const metadata = {
  title: "Replenishment Queue | Daily Command Center",
  description: "Deterministic reorder recommendations, lead time consumption, and supplier PO suggestions.",
};

export default function ReplenishmentPage() {
  return <ReplenishmentView />;
}
