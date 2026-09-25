import { DocumentsWorkspace } from "@/features/life/documents-workspace";
import { ResourceWorkspace } from "@/features/founder-os/resource-workspace";
import { WorkspaceTabs, selectedView } from "@/components/workspace-tabs";
export default function Page({ searchParams }: { searchParams: Promise<{ view?: string | string[] }> }) { return <WorkspaceContent searchParams={searchParams}/>; }
async function WorkspaceContent({ searchParams }: { searchParams: Promise<{ view?: string | string[] }> }) {
 const view = await selectedView(searchParams, ["vault","metadata"], "vault");
 return <WorkspaceTabs title="Documents" base="/documents" tabs={[{id:"vault",label:"Documents & files"},{id:"metadata",label:"Verification records"}]} active={view}>{view === "metadata" ? <ResourceWorkspace resource="documents"/> : <DocumentsWorkspace/>}</WorkspaceTabs>;
}
