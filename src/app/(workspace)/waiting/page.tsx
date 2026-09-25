import { ExecutiveBriefing } from "@/features/founder-os/executive-briefing";
import { DomainPage } from "@/features/domains/domain-page";
import { WorkspaceTabs, selectedView } from "@/components/workspace-tabs";
export default function Page({ searchParams }: { searchParams: Promise<{ view?: string | string[] }> }) { return <WorkspaceContent searchParams={searchParams}/>; }
async function WorkspaceContent({ searchParams }: { searchParams: Promise<{ view?: string | string[] }> }) {
 const view = await selectedView(searchParams, ["records","summary"], "records");
 return <WorkspaceTabs title="Waiting" base="/waiting" tabs={[{id:"records",label:"Waiting records"},{id:"summary",label:"Summary"}]} active={view}>{view === "summary" ? <ExecutiveBriefing mode="waiting"/> : <DomainPage domain="waiting"/>}</WorkspaceTabs>;
}
