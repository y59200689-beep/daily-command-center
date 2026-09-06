import type { Metadata } from "next";
import { BusinessWorkspace } from "@/features/business/business-workspace";
export const metadata: Metadata = { title: "Services" };
export default function ServicesPage() { return <BusinessWorkspace screen="services"/>; }
