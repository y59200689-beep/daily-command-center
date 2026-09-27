import { TravelWorkspace } from "@/features/life/travel-workspace";
export const metadata = { title: "Trips" };
export default async function Page({searchParams}:{searchParams:Promise<{preview?:string}>}) { const query=await searchParams; return <TravelWorkspace preview={process.env.NODE_ENV!=="production"&&query.preview==="design"}/>; }
