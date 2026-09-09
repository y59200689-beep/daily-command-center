import type { Metadata } from "next";
import { RunDetail } from "@/features/operations/run-detail";

export const metadata: Metadata = {
  title: "Operations · Process Run Cockpit",
  description: "Live step execution and quality checklist verification",
};

export default async function OperationsRunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RunDetail id={id} />;
}
