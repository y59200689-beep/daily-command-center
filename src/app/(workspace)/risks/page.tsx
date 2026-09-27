import { RisksDashboard } from "@/features/intelligence/risks-dashboard";
import { ResourceWorkspace } from "@/features/founder-os/resource-workspace";
import { ExecutiveRisksView } from "@/features/executive/executive-risks-view";
import { WorkspaceTabs, selectedView } from "@/components/workspace-tabs";
export default function Page({ searchParams }: { searchParams: Promise<{ view?: string | string[] }> }) { return <WorkspaceContent searchParams={searchParams}/>; }
async function WorkspaceContent({ searchParams }: { searchParams: Promise<{ view?: string | string[] }> }) {
 const view = await selectedView(searchParams, ["signals","register","patterns"], "signals");
 if (view === "signals") return <RisksDashboard/>;
 return <WorkspaceTabs title="Risks" base="/risks" tabs={[{id:"signals",label:"Signals"},{id:"register",label:"Register"},{id:"patterns",label:"Executive patterns"}]} active={view}>{view === "register" ? <ResourceWorkspace resource="risk-register"/> : view === "patterns" ? <ExecutiveRisksView/> : <RisksDashboard/>}</WorkspaceTabs>;
}
