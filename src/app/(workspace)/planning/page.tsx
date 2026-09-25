import { WorkspaceTabs, selectedView } from "@/components/workspace-tabs";
import { WeeklyPlanningPage, PeriodPlanningPage, NinetyDayPlanPage } from "@/features/strategy/strategy-pages";
export const metadata = { title: "Planning" };
export default function Page({ searchParams }: { searchParams: Promise<{ view?: string | string[] }> }) { return <WorkspaceContent searchParams={searchParams}/>; }
async function WorkspaceContent({ searchParams }: { searchParams: Promise<{ view?: string | string[] }> }) {
 const view = await selectedView(searchParams, ["week","month","quarter","90-days"], "week");
 return <WorkspaceTabs title="Planning" base="/planning" tabs={[{id:"week",label:"Week"},{id:"month",label:"Month"},{id:"quarter",label:"Quarter"},{id:"90-days",label:"90 days"}]} active={view}>{view === "week" ? <WeeklyPlanningPage/> : view === "month" ? <PeriodPlanningPage type="month"/> : view === "quarter" ? <PeriodPlanningPage type="quarter"/> : <NinetyDayPlanPage/>}</WorkspaceTabs>;
}
