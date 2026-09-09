import type { Metadata } from "next";
import { OperationsHome } from "@/features/operations/operations-home";

export const metadata: Metadata = {
  title: "Operations",
  description: "Operations & SOP Operating System - Turn repeatable work into reliable operations",
};

export default function OperationsPage() {
  return <OperationsHome />;
}
