import type { Metadata } from "next";
import { ExecutiveRisksView } from "@/features/executive/executive-risks-view";

export const metadata: Metadata = { title: "Risk Radar | Executive" };

export default function ExecutiveRisksPage() {
  return <ExecutiveRisksView />;
}
