import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { isPersistedDomain, parseDomainInput } from "@/lib/domains";
import { createRecord, listRecords } from "@/lib/repository";
import { requireUser } from "@/lib/supabase/server";
import { pushGoogleEvent } from "@/lib/integrations/google-calendar";
import { setDailyPriority } from "@/lib/today";
import { promptVariables } from "@/lib/v2";

export async function GET(request: NextRequest, context: { params: Promise<{ domain: string }> }) {
  try {
    const { domain } = await context.params;
    if (!isPersistedDomain(domain)) return NextResponse.json({ error: "Unknown collection." }, { status: 404 });
    const { supabase, userId } = await requireUser();
    const page=Number(request.nextUrl.searchParams.get("page")??1);const pageSize=Number(request.nextUrl.searchParams.get("pageSize")??50);
    return NextResponse.json(await listRecords(supabase, userId, domain, request.nextUrl.searchParams.get("q") ?? undefined,page,pageSize));
  } catch (error) { return apiError(error, "Records could not be loaded."); }
}

export async function POST(request: NextRequest, context: { params: Promise<{ domain: string }> }) {
  try {
    const { domain } = await context.params;
    if (!isPersistedDomain(domain)) return NextResponse.json({ error: "Unknown collection." }, { status: 404 });
    if (domain === "payments") return NextResponse.json({ error: "Payments must be recorded against an invoice." }, { status: 405 });
    const parsed = parseDomainInput(domain, await request.json());
    if (!parsed.success) throw parsed.error;
    const { supabase, userId } = await requireUser();
    const values={...(parsed.data as Record<string,unknown>)};const dailyPosition=domain==="tasks"?Number(values.daily_position)||null:null;delete values.daily_position;
    let record = await createRecord(supabase, userId, domain, values);
    if(domain==="prompts")await syncPromptVariables(supabase,userId,record.id,String(record.prompt_text??record.prompt??""));
    if(domain==="tasks"&&dailyPosition)await setDailyPriority(supabase,userId,record.id,dailyPosition);
    if (domain === "calendar") record = await pushGoogleEvent(supabase, userId, record);
    return NextResponse.json({ record }, { status: 201 });
  } catch (error) { return apiError(error, "Record could not be saved."); }
}

async function syncPromptVariables(client:Awaited<ReturnType<typeof requireUser>>["supabase"],userId:string,promptId:string,text:string){const names=promptVariables(text);if(!names.length)return;const{error}=await client.from("prompt_variables").upsert(names.map((name)=>({user_id:userId,prompt_id:promptId,name,label:name.replaceAll("_"," "),required:true})),{onConflict:"prompt_id,name"});if(error)throw error}
