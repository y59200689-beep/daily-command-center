import { KnowledgeLibrary } from "@/features/knowledge/knowledge-library";
export default async function Page({params}:{params:Promise<{id:string}>}){return <KnowledgeLibrary kind="collections" id={(await params).id}/>}
