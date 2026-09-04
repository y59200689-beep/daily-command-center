import type { Metadata } from "next";
import { TodayDashboard } from "@/features/today/today-dashboard";
export const metadata: Metadata = { title: "Today" };
export default function TodayPage() { return <TodayDashboard />; }
