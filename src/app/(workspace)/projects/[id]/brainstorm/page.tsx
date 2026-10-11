import type { Metadata } from "next";
import { BrainstormWorkspace } from "@/features/brainstorm/workspace";
export const metadata:Metadata={title:'Brainstorm'};
export default async function Page({params}:{params:Promise<{id:string}>}){const{id}=await params;return <BrainstormWorkspace projectId={id}/>;}
