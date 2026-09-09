import { LearningRetrospectiveDetailView } from "@/features/learning/learning-retrospective-detail-view";

export const metadata = {
  title: "Retrospective Detail | Daily Command Center",
  description: "Retrospective observations, successes, and follow-ups",
};

export default async function LearningRetrospectiveDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <LearningRetrospectiveDetailView id={id} />;
}
