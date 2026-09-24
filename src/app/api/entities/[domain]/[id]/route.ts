import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { isPersistedDomain, parseDomainInput } from "@/lib/domains";
import { archiveRecord, deleteRecord, getRecord, updateRecord } from "@/lib/repository";
import { requireUser } from "@/lib/supabase/server";
import { deleteGoogleEvent, pushGoogleEvent } from "@/lib/integrations/google-calendar";
import { setDailyPriority } from "@/lib/today";
import { promptVariables } from "@/lib/v2";

type Context = { params: Promise<{ domain: string; id: string }> };
export async function GET(_: NextRequest, context: Context) {
  try { const { domain, id } = await context.params; if (!isPersistedDomain(domain)) return NextResponse.json({ error: "Unknown collection." }, { status: 404 }); const { supabase, userId } = await requireUser(); const record = await getRecord(supabase, userId, domain, id); return record ? NextResponse.json({ record }) : NextResponse.json({ error: "Record not found." }, { status: 404 }); } catch (error) { return apiError(error, "Record could not be loaded."); }
}
export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { domain, id } = await context.params;
    if (!isPersistedDomain(domain)) return NextResponse.json({ error: "Unknown collection." }, { status: 404 });
    if(domain==="payments")return NextResponse.json({error:"Recorded payments are immutable. Correct the invoice ledger with a separate adjustment."},{status:405});
    const parsed = parseDomainInput(domain, await request.json(), true);
    if (!parsed.success) throw parsed.error;
    const { supabase, userId } = await requireUser();
    const values={...(parsed.data as Record<string,unknown>)};
    const hasDailyPosition=domain==="tasks"&&Object.hasOwn(values,"daily_position");
    const dailyPosition=hasDailyPosition?values.daily_position as number|null:undefined;
    delete values.daily_position;
    if(domain==="prompts"&&values.prompt_text!==undefined){const current=await getRecord(supabase,userId,"prompts",id);if(current&&String(current.prompt_text??current.prompt)!==String(values.prompt_text)){const latest=await supabase.from("prompt_versions").select("version_number").eq("prompt_id",id).eq("user_id",userId).order("version_number",{ascending:false}).limit(1).maybeSingle();if(latest.error)throw latest.error;const version=await supabase.from("prompt_versions").insert({user_id:userId,prompt_id:id,version_number:Number(latest.data?.version_number??0)+1,prompt_text:String(current.prompt_text??current.prompt),change_note:"Saved before edit"});if(version.error)throw version.error}}
    let record = await updateRecord(supabase, userId, domain, id, values);
    if(record&&domain==="prompts"&&values.prompt_text!==undefined){const names=promptVariables(String(values.prompt_text));if(names.length){const synced=await supabase.from("prompt_variables").upsert(names.map((name)=>({user_id:userId,prompt_id:id,name,label:name.replaceAll("_"," "),required:true})),{onConflict:"prompt_id,name"});if(synced.error)throw synced.error}}
    if(record&&domain==="tasks"&&hasDailyPosition)await setDailyPriority(supabase,userId,id,dailyPosition??null);
    if(record&&domain==="calendar")record=await pushGoogleEvent(supabase,userId,record);

    // Spawn next occurrence when a recurring task is completed
    let next_occurrence = null;
    if (record && domain === "tasks" && values.status === "completed") {
      const freq = String(record.recurrence_frequency ?? "");
      if (freq) {
        const baseDue = record.due_date ? new Date(`${String(record.due_date)}T12:00:00`) : new Date();
        const nextDue = computeNextDueDate(baseDue, freq);
        const spawn: Record<string, unknown> = {
          user_id: userId,
          title: record.title,
          description: record.description ?? null,
          status: "inbox",
          priority: record.priority ?? "none",
          project_id: record.project_id ?? null,
          client_id: record.client_id ?? null,
          goal_id: record.goal_id ?? null,
          recurrence_frequency: freq,
          ...(record.work_classification ? { work_classification: record.work_classification } : {}),
          due_date: `${nextDue.getFullYear()}-${String(nextDue.getMonth()+1).padStart(2,"0")}-${String(nextDue.getDate()).padStart(2,"0")}`,
          estimated_minutes: record.estimated_minutes ?? null,
          // For goal-type recurring tasks, reset progress
          target_count: record.target_count ?? null,
          current_count: 0,
          daily_target: record.daily_target ?? null,
        };
        const { data: spawned, error: spawnErr } = await supabase.from("tasks").insert(spawn).select("*").maybeSingle();
        if (spawnErr) console.error("Failed to spawn next occurrence:", spawnErr.message);
        next_occurrence = spawned ?? null;
      }
    }

    if (!record) return NextResponse.json({ error: "Record not found." }, { status: 404 });
    return NextResponse.json({ record, ...(next_occurrence ? { next_occurrence } : {}) });
  } catch (error) { return apiError(error, "Record could not be updated."); }
}

function computeNextDueDate(from: Date, frequency: string): Date {
  const d = new Date(from);
  const dayMap: Record<string, number> = { sun:0, mon:1, tue:2, wed:3, thu:4, fri:5, sat:6 };
  if (frequency === "daily") {
    d.setDate(d.getDate() + 1);
  } else if (frequency === "weekly") {
    d.setDate(d.getDate() + 7);
  } else if (frequency === "monthly") {
    d.setMonth(d.getMonth() + 1);
  } else if (dayMap[frequency] !== undefined) {
    const targetDay = dayMap[frequency];
    const currentDay = d.getDay();
    let daysUntil = targetDay - currentDay;
    if (daysUntil <= 0) daysUntil += 7;
    d.setDate(d.getDate() + daysUntil);
  }
  return d;
}


export async function DELETE(request: NextRequest, context: Context) {
  try {
    const { domain, id } = await context.params;
    if (!isPersistedDomain(domain)) return NextResponse.json({ error: "Unknown collection." }, { status: 404 });
    if (domain === "payments") return NextResponse.json({ error: "Recorded payments cannot be archived from the generic entity API." }, { status: 405 });
    const { supabase, userId } = await requireUser();
    const record = domain === "calendar" ? await getRecord(supabase, userId, domain, id) : null;
    if (record) {
      const deletion = await deleteGoogleEvent(supabase, userId, record);
      if(deletion.status!=="deleted")return NextResponse.json({error:"Google Calendar changed before this event could be deleted.",sync_result:deletion},{status:409});
    }
    const permanent = request.nextUrl.searchParams.get("permanent") === "true";
    const ok = permanent
      ? await deleteRecord(supabase, userId, domain, id)
      : await archiveRecord(supabase, userId, domain, id);
    return ok ? new NextResponse(null, { status: 204 }) : NextResponse.json({ error: "Record not found." }, { status: 404 });
  } catch (error) {
    return apiError(error, "Record could not be archived.");
  }
}
