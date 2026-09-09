import { ActionEscalationsView } from "@/features/chief-of-staff/action-escalations-view";

export const metadata = {
  title: "Escalations | Chief of Staff",
  description: "Critical execution blocks and operational bottlenecks",
};

export default function ActionEscalationsPage() {
  return <ActionEscalationsView />;
}
