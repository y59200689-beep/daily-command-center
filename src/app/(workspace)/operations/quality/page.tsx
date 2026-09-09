import type { Metadata } from "next";
import { QualityCenter } from "@/features/operations/quality-center";

export const metadata: Metadata = {
  title: "Operations · Quality Center",
  description: "Incident logs, root causes, defect tracking and corrective actions",
};

export default function OperationsQualityPage() {
  return <QualityCenter />;
}
