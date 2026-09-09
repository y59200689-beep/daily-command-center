import type { Metadata } from "next";
import { ExecutiveDailyBriefView } from "@/features/executive/executive-daily-brief-view";

export const metadata: Metadata = { title: "Daily Brief | Executive" };

export default function ExecutiveDailyBriefPage() {
  return <ExecutiveDailyBriefView scope="business" />;
}
