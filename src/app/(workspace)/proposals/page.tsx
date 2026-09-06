import type { Metadata } from "next";
import { BusinessWorkspace } from "@/features/business/business-workspace";
export const metadata: Metadata = { title: "Proposals" };
export default function ProposalsPage() { return <BusinessWorkspace screen="proposals"/>; }
