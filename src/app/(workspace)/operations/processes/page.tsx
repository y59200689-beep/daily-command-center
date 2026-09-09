import type { Metadata } from "next";
import { ProcessList } from "@/features/operations/process-list";

export const metadata: Metadata = {
  title: "Operations · Process Templates",
  description: "Recurring and repeatable operational process templates",
};

export default function OperationsProcessesPage() {
  return <ProcessList />;
}
