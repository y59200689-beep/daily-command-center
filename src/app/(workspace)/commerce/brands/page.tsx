import { BrandsCategoriesView } from "@/features/commerce/brands-categories-view";

export const metadata = {
  title: "Brand Performance | Daily Command Center",
  description: "Cross-product brand analytics with separated currency revenue and stock health.",
};

export default function BrandsPage() {
  return <BrandsCategoriesView initialTab="brands" />;
}
