import type { Metadata } from "next";
import { ExecutiveReportsView } from "@/features/executive/executive-reports-view";

export const metadata: Metadata = { title: "Reports Hub | Executive" };

export default function ExecutiveReportsPage() {
  return <ExecutiveReportsView />;
}
