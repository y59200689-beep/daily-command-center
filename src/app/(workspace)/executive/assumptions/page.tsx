import type { Metadata } from "next";
import { ExecutiveAssumptionsView } from "@/features/executive/executive-assumptions-view";

export const metadata: Metadata = { title: "Assumptions Register | Executive" };

export default function ExecutiveAssumptionsPage() {
  return <ExecutiveAssumptionsView />;
}
