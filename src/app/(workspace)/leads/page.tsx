import type { Metadata } from "next";
import { BusinessWorkspace } from "@/features/business/business-workspace";
export const metadata: Metadata = { title: "Leads" };
export default function LeadsPage() { return <BusinessWorkspace screen="leads"/>; }
