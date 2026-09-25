import type { Metadata } from "next";
import { TodayDashboard } from "@/features/today/today-dashboard";
import { PlannerPage } from "@/features/intelligence/intelligence-pages";
import { WorkspaceTabs, selectedView } from "@/components/workspace-tabs";
export const metadata: Metadata = { title: "Today" };
export default function Page({ searchParams }: { searchParams: Promise<{ view?: string | string[] }> }) { return <WorkspaceContent searchParams={searchParams}/>; }
async function WorkspaceContent({ searchParams }: { searchParams: Promise<{ view?: string | string[] }> }) {
 const view = await selectedView(searchParams, ["today", "plan"], "today");
 return <WorkspaceTabs title="Today" base="/today" tabs={[{id:"today",label:"Today"},{id:"plan",label:"Plan today"}]} active={view}>{view === "plan" ? <PlannerPage/> : <TodayDashboard/>}</WorkspaceTabs>;
}
