import type { Metadata } from "next";
import { ExecutiveDecisionsView } from "@/features/executive/executive-decisions-view";

export const metadata: Metadata = { title: "Decision Queue | Executive" };

export default function ExecutiveDecisionsPage() {
  return <ExecutiveDecisionsView />;
}
