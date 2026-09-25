import { ExecutiveBriefing } from "@/features/founder-os/executive-briefing";
import type { Metadata } from "next";
import { WeeklyReviewPage } from "@/features/intelligence/intelligence-pages";
export const metadata: Metadata = { title: "Weekly Review — Daily Command Center" };
export default function Page() { return <><ExecutiveBriefing mode="weekly" /><details className="founder-record"><summary>Personal weekly reflection & existing review tools</summary><WeeklyReviewPage/></details></>; }
