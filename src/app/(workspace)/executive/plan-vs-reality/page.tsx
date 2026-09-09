import type { Metadata } from "next";
import { ExecutivePlanVsRealityView } from "@/features/executive/executive-plan-vs-reality-view";

export const metadata: Metadata = { title: "Plan vs. Reality | Executive" };

export default function ExecutivePlanVsRealityPage() {
  return <ExecutivePlanVsRealityView />;
}
