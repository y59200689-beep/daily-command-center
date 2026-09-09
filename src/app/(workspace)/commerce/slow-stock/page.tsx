import { SlowStockView } from "@/features/commerce/slow-stock-view";

export const metadata = {
  title: "Slow-Moving Stock | Daily Command Center",
  description: "Identify dormant items, excess inventory units, and capital exposure.",
};

export default function SlowStockPage() {
  return <SlowStockView />;
}
