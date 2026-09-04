import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { getFinanceSummary } from "@/lib/intelligence";
import { requireUser } from "@/lib/supabase/server";
export async function GET(){try{const{supabase,userId}=await requireUser();return NextResponse.json(await getFinanceSummary(supabase,userId))}catch(error){return apiError(error,"Finance could not be loaded.")}}
