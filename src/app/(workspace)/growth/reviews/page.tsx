import type { Metadata } from "next";
import { GrowthReviews } from "@/features/growth/growth-reviews";

export const metadata: Metadata = {
  title: "Growth Reviews | Daily Command Center",
};

export default function GrowthReviewsPage() {
  return <GrowthReviews />;
}
