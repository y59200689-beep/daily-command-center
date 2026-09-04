import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { getContentSummary } from "@/lib/intelligence";
import { requireUser } from "@/lib/supabase/server";
export async function GET(){try{const{supabase,userId}=await requireUser();return NextResponse.json(await getContentSummary(supabase,userId))}catch(error){return apiError(error,"Content pipeline could not be loaded.")}}
