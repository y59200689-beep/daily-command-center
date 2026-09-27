import { LifeDashboard } from "@/features/life/life-dashboard";
export default async function Page({searchParams}:{searchParams:Promise<{preview?:string}>}) { const query=await searchParams; return <LifeDashboard preview={process.env.NODE_ENV!=="production"&&query.preview==="design"}/>; }
