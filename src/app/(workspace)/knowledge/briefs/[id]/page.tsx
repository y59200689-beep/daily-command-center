import { KnowledgeLibrary } from "@/features/knowledge/knowledge-library";
import { KnowledgeEntityLinksPanel, KnowledgeRelationsPanel } from "@/features/knowledge/knowledge-links";

export default async function Page({params}:{params:Promise<{id:string}>}) {
  const { id } = await params;
  return <><KnowledgeLibrary kind="briefs" id={id}/><div className="domain-page knowledge-extensions"><KnowledgeRelationsPanel originType="brief" originId={id}/><KnowledgeEntityLinksPanel originType="brief" originId={id}/></div></>;
}
