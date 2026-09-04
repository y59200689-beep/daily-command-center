import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { getFitnessWeek } from "@/lib/intelligence";
import { requireUser } from "@/lib/supabase/server";
export async function GET(){try{const{supabase,userId}=await requireUser();return NextResponse.json(await getFitnessWeek(supabase,userId))}catch(error){return apiError(error,"Fitness week could not be loaded.")}}
