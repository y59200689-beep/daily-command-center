import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { getAnalyticsSummary } from "@/lib/intelligence";
import { requireUser } from "@/lib/supabase/server";
export async function GET(){try{const{supabase,userId}=await requireUser();return NextResponse.json(await getAnalyticsSummary(supabase,userId))}catch(error){return apiError(error,"Analytics could not be loaded.")}}
