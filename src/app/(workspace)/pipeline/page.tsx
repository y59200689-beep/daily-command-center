import type { Metadata } from "next";
import { BusinessWorkspace } from "@/features/business/business-workspace";
export const metadata: Metadata = { title: "Pipeline" };
export default function PipelinePage() { return <BusinessWorkspace screen="pipeline"/>; }
