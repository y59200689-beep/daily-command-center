import { KnowledgeDetail } from "@/features/knowledge/knowledge-detail";
import { KnowledgeEntityLinksPanel, KnowledgeRelationsPanel } from "@/features/knowledge/knowledge-links";

export default async function SourcePage({params}:{params:Promise<{id:string}>}) {
  const { id } = await params;
  return <><KnowledgeDetail kind="sources" id={id}/><div className="domain-page knowledge-extensions"><KnowledgeRelationsPanel originType="source" originId={id}/><KnowledgeEntityLinksPanel originType="source" originId={id}/></div></>;
}
