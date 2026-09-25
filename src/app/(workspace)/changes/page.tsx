import { ExecutiveBriefing } from "@/features/founder-os/executive-briefing";
import { ExecutiveChangesView } from "@/features/executive/executive-changes-view";
import { WorkspaceTabs, selectedView } from "@/components/workspace-tabs";
export default function Page({ searchParams }: { searchParams: Promise<{ view?: string | string[] }> }) { return <WorkspaceContent searchParams={searchParams}/>; }
async function WorkspaceContent({ searchParams }: { searchParams: Promise<{ view?: string | string[] }> }) {
 const view = await selectedView(searchParams, ["baseline","domains"], "baseline");
 return <WorkspaceTabs title="Changes" base="/changes" tabs={[{id:"baseline",label:"Compared with baseline"},{id:"domains",label:"Domain changes"}]} active={view}>{view === "domains" ? <ExecutiveChangesView/> : <ExecutiveBriefing mode="changes"/>}</WorkspaceTabs>;
}
