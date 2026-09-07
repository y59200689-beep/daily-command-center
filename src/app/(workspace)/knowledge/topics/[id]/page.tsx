import { TopicDetail } from "@/features/knowledge/topic-detail";
export default async function TopicPage({params}:{params:Promise<{id:string}>}){return <TopicDetail id={(await params).id}/>}
