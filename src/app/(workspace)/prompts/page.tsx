import { PromptsDashboard } from "@/features/prompts/prompts-dashboard";
export default async function Page({searchParams}:{searchParams:Promise<{preview?:string}>}) { const query=await searchParams; return <PromptsDashboard preview={process.env.NODE_ENV !== "production" && query.preview === "design"}/>; }
