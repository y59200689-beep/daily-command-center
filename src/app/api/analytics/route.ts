import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { getAnalyticsSummary } from "@/lib/intelligence";
import { requireUser } from "@/lib/supabase/server";
import { getIntelligence } from "@/lib/intelligence/server";
export async function GET(){try{const{supabase,userId}=await requireUser();const[summary,v3]=await Promise.all([getAnalyticsSummary(supabase,userId),getIntelligence(supabase,userId)]);return NextResponse.json({...summary,intelligence:{capacity:v3.overview.capacity,patterns:v3.overview.patterns,predictions:v3.overview.predictions,risks:v3.overview.risks.slice(0,5)}})}catch(error){return apiError(error,"Analytics could not be loaded.")}}
