import type { Metadata } from "next";
import { BusinessWorkspace } from "@/features/business/business-workspace";
export const metadata: Metadata = { title: "Business" };
export default function BusinessPage() { return <BusinessWorkspace screen="business"/>; }
