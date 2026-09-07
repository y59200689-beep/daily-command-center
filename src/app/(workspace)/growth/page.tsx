import type { Metadata } from "next";
import { GrowthHome } from "@/features/growth/growth-home";
export const metadata: Metadata = { title: "Growth" };
export default function GrowthPage() { return <GrowthHome />; }
