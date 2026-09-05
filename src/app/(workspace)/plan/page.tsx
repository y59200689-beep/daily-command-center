import type { Metadata } from "next";
import { PlannerPage } from "@/features/intelligence/intelligence-pages";
export const metadata: Metadata = { title: "Plan — Daily Command Center" };
export default function Page() { return <PlannerPage/>; }
