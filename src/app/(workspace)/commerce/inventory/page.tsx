import { InventoryView } from "@/features/commerce/inventory-view";

export const metadata = {
  title: "Inventory & Coverage | Daily Command Center",
  description: "Track stock on hand, daily sales velocity, coverage days, and stockout projections.",
};

export default function InventoryPage() {
  return <InventoryView />;
}
