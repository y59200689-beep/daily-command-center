import type { Metadata } from "next";
import { OperationsReview } from "@/features/operations/operations-review";

export const metadata: Metadata = {
  title: "Operations · Cadence Review",
  description: "Weekly & monthly operations review and continuous improvements",
};

export default function OperationsReviewPage() {
  return <OperationsReview />;
}
