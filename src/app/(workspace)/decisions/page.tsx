import { ResourceWorkspace } from "@/features/founder-os/resource-workspace";
import { ExecutiveDecisionsView } from "@/features/executive/executive-decisions-view";
import { LearningDecisionsView } from "@/features/learning/learning-decisions-view";
import { WorkspaceTabs, selectedView } from "@/components/workspace-tabs";
export default function Page({ searchParams }: { searchParams: Promise<{ view?: string | string[] }> }) { return <WorkspaceContent searchParams={searchParams}/>; }
async function WorkspaceContent({ searchParams }: { searchParams: Promise<{ view?: string | string[] }> }) {
 const view = await selectedView(searchParams, ["journal","queue","outcomes"], "journal");
 return <WorkspaceTabs title="Decisions" base="/decisions" tabs={[{id:"queue",label:"Queue"},{id:"journal",label:"Journal"},{id:"outcomes",label:"Outcomes"}]} active={view}>{view === "queue" ? <ExecutiveDecisionsView/> : view === "outcomes" ? <LearningDecisionsView/> : <ResourceWorkspace resource="decisions"/>}</WorkspaceTabs>;
}
