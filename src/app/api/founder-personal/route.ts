import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { apiError } from "@/lib/api";
import { wealthSummary } from "@/lib/founder-os/intelligence";
import { wealthTimeline } from "@/lib/founder-os/personal";
export async function GET(){try{
 const {supabase,userId}=await requireUser();
 const [entries,history]=await Promise.all([supabase.from("personal_balance_entries").select("*").eq("user_id",userId).order("valued_on",{ascending:false}).limit(1001),supabase.from("personal_balance_history").select("*").eq("user_id",userId).order("valued_on",{ascending:false}).limit(5001)]);
 if(entries.error)throw entries.error;if(history.error)throw history.error;
 return NextResponse.json({totals:wealthSummary(entries.data.slice(0,1000)),history:wealthTimeline(history.data.slice(0,5000)),partial:entries.data.length>1000||history.data.length>5000});
}catch(e){return apiError(e,"Personal balance evidence could not be loaded.");}}
