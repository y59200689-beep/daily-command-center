import { BrandsCategoriesView } from "@/features/commerce/brands-categories-view";

export const metadata = {
  title: "Category Performance | Daily Command Center",
  description: "Product category distribution, sales velocity, and stockout risk by category.",
};

export default function CategoriesPage() {
  return <BrandsCategoriesView initialTab="categories" />;
}
