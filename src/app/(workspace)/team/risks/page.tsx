import { TeamRisks } from "@/features/team/team-risks";

export const metadata = {
  title: "Team Risks & Escalations · Team OS",
  description: "Coordination bottlenecks, single-owner dependencies, and escalations",
};

export default function RisksPage() {
  return <TeamRisks />;
}
