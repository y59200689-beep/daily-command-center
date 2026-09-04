import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { parseCapture } from "@/lib/capture";
import { createRecord } from "@/lib/repository";
import { requireUser } from "@/lib/supabase/server";

const inputSchema=z.object({text:z.string().trim().min(1).max(2000)});
export async function POST(request:Request){try{const{ text }=inputSchema.parse(await request.json());const parsed=parseCapture(text);const{supabase,userId}=await requireUser();let record;
  if(parsed.kind==="task")record=await createRecord(supabase,userId,"tasks",{title:parsed.text,status:"inbox",priority:"none",due_date:parsed.due?.slice(0,10)??null,created_by:"user"});
  else if(parsed.kind==="note")record=await createRecord(supabase,userId,"notes",{title:parsed.text.slice(0,120),content:parsed.text,category:"note",created_by:"user"});
  else if(parsed.kind==="idea")record=await createRecord(supabase,userId,"ideas",{title:parsed.text,status:"captured"});
  else if(parsed.kind==="decision")record=await createRecord(supabase,userId,"decisions",{title:parsed.text.slice(0,120),decision:parsed.text,decision_date:new Date().toISOString().slice(0,10)});
  else if(parsed.kind==="followup")record=await createRecord(supabase,userId,"followups",{title:`Follow up with ${parsed.text}`,status:"open",due_at:parsed.due??null});
  else record=await createRecord(supabase,userId,"inbox",{raw_text:parsed.text,detected_type:"inbox",confidence:parsed.confidence,status:"unprocessed"});
  return NextResponse.json({parsed,record},{status:201});
 }catch(error){return apiError(error,"Capture could not be saved.")}}
