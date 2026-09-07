import type { Metadata } from "next";
import { GrowthPipeline } from "@/features/growth/growth-pipeline";
export const metadata: Metadata = { title: "Growth · Pipeline" };
export default function GrowthPipelinePage() { return <GrowthPipeline />; }
