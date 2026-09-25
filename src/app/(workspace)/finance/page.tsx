import { FinanceDashboard } from "@/features/v2/finance-dashboard";
import { FinancialWorkspace } from "@/features/financial-control/financial-workspace";
import { WorkspaceTabs, selectedView } from "@/components/workspace-tabs";
import "@/features/financial-control/financial-control.css";
export default function Page({ searchParams }: { searchParams: Promise<{ view?: string | string[] }> }) { return <WorkspaceContent searchParams={searchParams}/>; }
async function WorkspaceContent({ searchParams }: { searchParams: Promise<{ view?: string | string[] }> }) {
 const view = await selectedView(searchParams, ["records","planning"], "records");
 return <WorkspaceTabs title="Finance" base="/finance" tabs={[{id:"records",label:"Records"},{id:"planning",label:"Cash & planning"}]} active={view}>{view === "planning" ? <FinancialWorkspace view="home"/> : <FinanceDashboard/>}</WorkspaceTabs>;
}
