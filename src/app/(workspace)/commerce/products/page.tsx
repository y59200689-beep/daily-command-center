import { ProductsPerformanceView } from "@/features/commerce/products-performance-view";

export const metadata = {
  title: "Product Performance | Daily Command Center",
  description: "Sales velocity, product momentum, unit costs, and gross contribution margins.",
};

export default function ProductsPage() {
  return <ProductsPerformanceView />;
}
