import { PurchaseReviewView } from "@/features/commerce/purchase-review-view";

export const metadata = {
  title: "Purchase Review | Daily Command Center",
  description: "Triage late supplier shipments, partial order receipts, and delivery bottlenecks.",
};

export default function PurchaseReviewPage() {
  return <PurchaseReviewView />;
}
