import type { Metadata } from "next";
import { DecisionBriefView } from "@/features/executive/decision-brief-view";

export const metadata: Metadata = { title: "Decision Brief | Executive" };

export default async function DecisionBriefPage({
  params,
}: {
  params: Promise<{ decisionId: string }>;
}) {
  const { decisionId } = await params;
  return <DecisionBriefView decisionId={decisionId} />;
}
