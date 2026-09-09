import { LearningRuleDetailView } from "@/features/learning/learning-rule-detail-view";

export const metadata = {
  title: "Rule Proposal Detail | Daily Command Center",
  description: "Rule impact preview and parameter details",
};

export default async function LearningRuleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <LearningRuleDetailView id={id} />;
}
