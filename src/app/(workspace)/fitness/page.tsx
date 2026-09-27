import type { Metadata } from "next";
import { FitnessDashboard } from "@/features/v2/fitness-dashboard";
export const metadata:Metadata={title:"Fitness — Daily Command Center"};
export default async function Page({searchParams}:{searchParams:Promise<{preview?:string}>}){const query=await searchParams;return <FitnessDashboard preview={process.env.NODE_ENV!=="production"&&query.preview==="design"}/>}
