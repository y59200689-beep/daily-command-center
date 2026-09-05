import type { Metadata } from "next";
import { WeeklyReviewPage } from "@/features/intelligence/intelligence-pages";
export const metadata: Metadata = { title: "Weekly Review — Daily Command Center" };
export default function Page() { return <WeeklyReviewPage/>; }
