import { CommerceRisksView } from "@/features/commerce/commerce-risks-view";

export const metadata = {
  title: "Commerce Risks | Daily Command Center",
  description: "Ranked operational risk matrix across inventory stockouts, late POs, and dormant capital.",
};

export default function RisksPage() {
  return <CommerceRisksView />;
}
