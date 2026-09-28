import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BusinessWorkspace } from "@/features/business/business-workspace";
export const metadata: Metadata = { title: "Leads" };
export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ preview?: string }> }) {
  const { preview } = await searchParams;
  if (preview === "design") redirect("/leads");
  return <BusinessWorkspace screen="leads"/>;
}
