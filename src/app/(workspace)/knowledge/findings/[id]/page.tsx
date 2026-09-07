import { KnowledgeDetail } from "@/features/knowledge/knowledge-detail";
import { KnowledgeEntityLinksPanel, KnowledgeRelationsPanel } from "@/features/knowledge/knowledge-links";

export default async function FindingPage({params}:{params:Promise<{id:string}>}) {
  const { id } = await params;
  return <><KnowledgeDetail kind="findings" id={id}/><div className="domain-page knowledge-extensions"><KnowledgeRelationsPanel originType="finding" originId={id}/><KnowledgeEntityLinksPanel originType="finding" originId={id}/></div></>;
}
