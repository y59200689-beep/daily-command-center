import type { Metadata } from "next";
import { KnowledgeReview } from "@/features/knowledge/knowledge-review";

export const metadata: Metadata = {
  title: "Knowledge Review",
  description: "Periodic review of research topics, stale sources, draft findings, open questions, and watchlist items.",
};

export default function KnowledgeReviewPage() {
  return <KnowledgeReview />;
}
