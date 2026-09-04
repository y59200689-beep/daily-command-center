import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { getTodayInsights } from "@/lib/intelligence";
import { requireUser } from "@/lib/supabase/server";
export async function GET(){try{const{supabase,userId}=await requireUser();return NextResponse.json({insights:await getTodayInsights(supabase,userId)})}catch(error){return apiError(error,"Insights could not be generated.")}}
