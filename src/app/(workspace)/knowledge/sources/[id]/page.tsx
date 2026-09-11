import { KnowledgeDetail } from "@/features/knowledge/knowledge-detail";

export default async function SourcePage({params}:{params:Promise<{id:string}>}) {
  const { id } = await params;
  return <KnowledgeDetail kind="sources" id={id}/>;
}
