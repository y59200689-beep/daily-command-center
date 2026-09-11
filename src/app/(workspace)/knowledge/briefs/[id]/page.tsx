import { KnowledgeLibrary } from "@/features/knowledge/knowledge-library";

export default async function Page({params}:{params:Promise<{id:string}>}) {
  const { id } = await params;
  return <KnowledgeLibrary kind="briefs" id={id}/>;
}
