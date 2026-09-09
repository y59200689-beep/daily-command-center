import { ClientRisksView } from "@/features/success/client-risks-view";

export const metadata = {
  title: "Client Risks | Daily Command Center",
  description: "View and manage risks across all client accounts.",
};

export default function ClientRisksPage() {
  return <ClientRisksView />;
}
