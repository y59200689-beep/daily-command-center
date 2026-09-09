import type { Metadata } from "next";
import { RunbooksView } from "@/features/operations/runbooks-view";

export const metadata: Metadata = {
  title: "Operations · Emergency Runbooks",
  description: "Standard operating guides for emergency mitigation and recovery",
};

export default function OperationsRunbooksPage() {
  return <RunbooksView />;
}
