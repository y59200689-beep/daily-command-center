import type { Metadata } from "next";
import { RevenueMission } from "@/features/growth/revenue-mission";
export const metadata: Metadata = { title: "Phase 1 — First 10K" };
export default function RevenueMissionPage() { return <RevenueMission />; }
