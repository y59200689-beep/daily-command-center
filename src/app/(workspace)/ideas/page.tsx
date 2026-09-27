import { IdeasDashboard } from "@/features/ideas/ideas-dashboard";
export default async function Page({searchParams}:{searchParams:Promise<{preview?:string}>}) { const query=await searchParams; return <IdeasDashboard preview={process.env.NODE_ENV !== "production" && query.preview === "design"}/>; }
