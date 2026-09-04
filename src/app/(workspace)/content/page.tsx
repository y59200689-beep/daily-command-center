import type { Metadata } from "next";
import { ContentCommandCenter } from "@/features/v2/content-command-center";

export const metadata:Metadata={title:"Content — Daily Command Center"};
const views=["kanban","list","calendar"] as const;

export default async function Page({searchParams}:{searchParams:Promise<{view?:string}>}){
  const {view}=await searchParams;
  return <ContentCommandCenter initialView={views.includes(view as (typeof views)[number])?view:"kanban"}/>;
}
