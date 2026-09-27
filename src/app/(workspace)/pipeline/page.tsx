import { BusinessWorkspace } from "@/features/business/business-workspace";
import { selectedView } from "@/components/workspace-tabs";
export const metadata = { title: "Pipeline", description: "Move qualified work forward with clear sales actions and deal health." };
export default async function Page({ searchParams }: { searchParams: Promise<{ view?: string | string[] }> }) {
  const view = await selectedView(searchParams,["opportunities","health"],"opportunities");
  return <BusinessWorkspace screen="pipeline" pipelineView={view as "opportunities"|"health"}/>;
}
