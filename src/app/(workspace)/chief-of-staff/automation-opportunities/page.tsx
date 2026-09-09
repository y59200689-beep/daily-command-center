import { AutomationOpportunitiesView } from "@/features/chief-of-staff/automation-opportunities-view";

export const metadata = {
  title: "Automation Opportunities | Chief of Staff",
  description: "Recommended automations detected from repeated manual routines",
};

export default function AutomationOpportunitiesPage() {
  return <AutomationOpportunitiesView />;
}
