import { WorkflowPanel } from "@/features/founder-os/workflow-panel";
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <WorkflowPanel kind="issue" id={id} />; }
