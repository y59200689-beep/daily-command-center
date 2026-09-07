import type { Metadata } from "next";
import { GrowthExperiments } from "@/features/growth/growth-experiments";
export const metadata: Metadata = { title: "Growth · Experiments" };
export default function GrowthExperimentsPage() { return <GrowthExperiments />; }
