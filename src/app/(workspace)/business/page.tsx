import type { Metadata } from "next";
import { BusinessWorkspace } from "@/features/business/business-workspace";
import { BusinessPulseWorkspace } from "@/features/founder-os/business-pulse";
import { WorkspaceTabs, selectedView } from "@/components/workspace-tabs";
export const metadata: Metadata = { title: "Business overview" };
export default function Page({ searchParams }: { searchParams: Promise<{ view?: string | string[] }> }) { return <WorkspaceContent searchParams={searchParams}/>; }
async function WorkspaceContent({ searchParams }: { searchParams: Promise<{ view?: string | string[] }> }) {
 const view = await selectedView(searchParams, ["overview","pulse"], "overview");
 if (view === "overview") return <BusinessWorkspace screen="business"/>;
 return <WorkspaceTabs title="Business" base="/business" tabs={[{id:"overview",label:"Overview"},{id:"pulse",label:"Business pulse"}]} active={view}>{<BusinessPulseWorkspace/>}</WorkspaceTabs>;
}
