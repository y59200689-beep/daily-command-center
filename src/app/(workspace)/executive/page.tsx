import { ExecutiveBriefing } from "@/features/founder-os/executive-briefing";
import type { Metadata } from "next";
import { LegacyExecutiveReports } from "@/features/founder-os/legacy-executive-reports";

export const metadata: Metadata = {
  title: "Executive Command Center",
  description: "Cross-domain executive intelligence — what changed, what deserves attention, and what to decide.",
};

export default function ExecutivePage() {
  return <><ExecutiveBriefing /><LegacyExecutiveReports /></>;
}
