import { ResourceWorkspace } from "@/features/founder-os/resource-workspace";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Forecast Journal — Daily Command Center",
  description: "Track calibrated business predictions, test estimation heuristics, and expose bias over time.",
};

export default function ForecastsPage() {
  return <ResourceWorkspace resource="forecasts" />;
}
