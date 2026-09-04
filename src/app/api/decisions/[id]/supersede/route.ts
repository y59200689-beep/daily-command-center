import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";
const schema=z.object({title:z.string().trim().min(1).max(240),decision:z.string().trim().min(1).max(10000),reasoning:z.string().max(5000).optional().nullable(),impact:z.enum(["low","medium","high","critical"]),confidence:z.enum(["low","medium","high"]),review_date:z.iso.date().optional().nullable()}).strict();
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){try{const{id}=await params;const input=schema.parse(await request.json());const{supabase}=await requireUser();const result=await supabase.rpc("supersede_decision",{previous_decision_id:id,replacement_title:input.title,replacement_decision:input.decision,replacement_reasoning:input.reasoning??null,replacement_impact:input.impact,replacement_confidence:input.confidence,replacement_review_date:input.review_date??null});if(result.error)throw result.error;return NextResponse.json({decision:result.data},{status:201})}catch(error){return apiError(error,"Decision could not be superseded.")}}
