import { BusinessWorkspace } from "@/features/business/business-workspace";
import { GrowthPipeline } from "@/features/growth/growth-pipeline";
import { WorkspaceTabs, selectedView } from "@/components/workspace-tabs";
export default function Page({ searchParams }: { searchParams: Promise<{ view?: string | string[] }> }) { return <WorkspaceContent searchParams={searchParams}/>; }
async function WorkspaceContent({ searchParams }: { searchParams: Promise<{ view?: string | string[] }> }) {
 const view = await selectedView(searchParams, ["opportunities","health"], "opportunities");
 return <WorkspaceTabs title="Pipeline" base="/pipeline" tabs={[{id:"opportunities",label:"Opportunities"},{id:"health",label:"Deal health"}]} active={view}>{view === "health" ? <GrowthPipeline/> : <BusinessWorkspace screen="pipeline"/>}</WorkspaceTabs>;
}
