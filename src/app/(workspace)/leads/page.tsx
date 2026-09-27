import type { Metadata } from "next";
import { BusinessWorkspace } from "@/features/business/business-workspace";
export const metadata: Metadata = { title: "Leads" };
export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ preview?: string }> }) {
 const preview = process.env.NODE_ENV === "development" && (await searchParams).preview === "design";
 const rows = preview ? (await import("@/lib/leads-design-preview")).leadsDesignPreview : undefined;
 return <BusinessWorkspace screen="leads" previewLeads={rows}/>;
}
