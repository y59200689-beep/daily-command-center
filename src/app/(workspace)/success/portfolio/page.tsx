import { PortfolioHealthView } from "@/features/success/portfolio-health-view";

export const metadata = {
  title: "Portfolio Health | Daily Command Center",
  description: "Monitor health, churn risk, and engagement state across all client accounts.",
};

export default function PortfolioPage() {
  return <PortfolioHealthView />;
}
