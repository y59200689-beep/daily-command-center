import type { Metadata } from "next";
import { RunsList } from "@/features/operations/runs-list";

export const metadata: Metadata = {
  title: "Operations · Process Runs",
  description: "Track live operational executions and checklists",
};

export default function OperationsRunsPage() {
  return <RunsList />;
}
