import type { Metadata } from "next";
import { ExecutiveOpportunitiesView } from "@/features/executive/executive-opportunities-view";

export const metadata: Metadata = { title: "Opportunity Radar | Executive" };

export default function ExecutiveOpportunitiesPage() {
  return <ExecutiveOpportunitiesView />;
}
