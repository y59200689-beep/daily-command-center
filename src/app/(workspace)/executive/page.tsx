import type { Metadata } from "next";
import { ExecutiveHome } from "@/features/executive/executive-home";

export const metadata: Metadata = {
  title: "Executive Command Center",
  description: "Cross-domain executive intelligence — what changed, what deserves attention, and what to decide.",
};

export default function ExecutivePage() {
  return <ExecutiveHome />;
}
