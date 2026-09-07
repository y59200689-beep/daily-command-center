import type { Metadata } from "next";
import { GrowthPlaybooks } from "@/features/growth/growth-playbooks";
export const metadata: Metadata = { title: "Growth · Playbooks" };
export default function GrowthPlaybooksPage() { return <GrowthPlaybooks />; }
