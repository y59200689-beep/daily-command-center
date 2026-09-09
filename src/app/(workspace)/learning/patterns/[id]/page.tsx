import { LearningPatternDetailView } from "@/features/learning/learning-pattern-detail-view";

export const metadata = {
  title: "Pattern Detail | Daily Command Center",
  description: "Operating pattern evidence and suggested actions",
};

export default async function LearningPatternDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <LearningPatternDetailView id={id} />;
}
