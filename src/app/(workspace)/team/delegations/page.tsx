import { DelegationsView } from "@/features/team/delegations-view";

export const metadata = {
  title: "Delegations · Team OS",
  description: "Delegation inbox and outbox across outcomes and people",
};

export default function DelegationsPage() {
  return <DelegationsView />;
}
