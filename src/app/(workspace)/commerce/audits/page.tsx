import { DiscrepanciesAuditsView } from "@/features/commerce/discrepancies-audits-view";

export const metadata = {
  title: "Audits & Discrepancies | Daily Command Center",
  description: "Cycle counts, physical audits, count variance investigation, and stock adjustments.",
};

export default function AuditsPage() {
  return <DiscrepanciesAuditsView />;
}
