import type { Metadata } from "next";
import { MeetingBriefPage } from "@/features/intelligence/intelligence-pages";
export const metadata: Metadata = { title: "Meeting Brief — Daily Command Center" };
export default async function Page({ params }: { params: Promise<{ id: string }> }) { return <MeetingBriefPage id={(await params).id}/>; }
