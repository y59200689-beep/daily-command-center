import { KnowledgeDetail } from "@/features/knowledge/knowledge-detail";

export default async function FindingPage({params}:{params:Promise<{id:string}>}) {
  const { id } = await params;
  return <KnowledgeDetail kind="findings" id={id}/>;
}
