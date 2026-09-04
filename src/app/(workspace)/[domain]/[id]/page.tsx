import type { Metadata } from "next";
import { DetailPage } from "@/features/domains/detail-page";
import { DecisionWorkspace } from "@/features/v2/decision-workspace";
import { PromptWorkspace } from "@/features/v2/prompt-workspace";
import { ContentWorkspace } from "@/features/v2/content-workspace";
export const metadata:Metadata={title:"Detail"};
export default async function Page({params}:{params:Promise<{domain:string;id:string}>}){const{domain,id}=await params;if(domain==="prompts")return <PromptWorkspace id={id}/>;if(domain==="decisions")return <DecisionWorkspace id={id}/>;if(domain==="content")return <ContentWorkspace id={id}/>;return <DetailPage domain={domain} id={id}/>}
