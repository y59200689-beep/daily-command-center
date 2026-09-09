import type { Metadata } from "next";
import { ExecutiveChangesView } from "@/features/executive/executive-changes-view";

export const metadata: Metadata = { title: "What Changed | Executive" };

export default function ExecutiveChangesPage() {
  return <ExecutiveChangesView />;
}
