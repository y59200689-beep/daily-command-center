import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";
import { getTodayInsights } from "@/lib/intelligence";

export async function GET(){try{const{supabase,userId}=await requireUser();const profile=await supabase.from("profiles").select("display_name,timezone").eq("id",userId).maybeSingle();if(profile.error)throw profile.error;const timezone=profile.data?.timezone??"UTC";const today=dateInTimezone(new Date(),timezone);const {start,end}=dayBounds(today,timezone);
 const [plan,inbox,events,waiting,overdue,projects,followups,notes,insights]=await Promise.all([
  supabase.from("daily_plans").select("id,notes,daily_priorities(position,tasks(*))").eq("user_id",userId).eq("plan_date",today).maybeSingle(),
  supabase.from("inbox_items").select("id",{count:"exact",head:true}).eq("user_id",userId).eq("status","unprocessed").is("deleted_at",null),
  supabase.from("calendar_events").select("*").eq("user_id",userId).gte("starts_at",start).lte("starts_at",end).is("deleted_at",null).neq("status","cancelled").order("starts_at"),
  supabase.from("waiting_items").select("*",{count:"exact"}).eq("user_id",userId).eq("status","waiting").is("deleted_at",null).order("created_at").limit(5),
  supabase.from("tasks").select("id",{count:"exact",head:true}).eq("user_id",userId).lt("due_date",today).neq("status","completed").is("deleted_at",null),
  supabase.from("projects").select("*").eq("user_id",userId).eq("status","active").is("deleted_at",null).order("updated_at",{ascending:false}).limit(5),
  supabase.from("followups").select("*").eq("user_id",userId).eq("status","open").is("deleted_at",null).order("due_at").limit(5),
  supabase.from("notes").select("*").eq("user_id",userId).is("deleted_at",null).order("updated_at",{ascending:false}).limit(3),
  getTodayInsights(supabase,userId)
 ]);const failure=[plan,inbox,events,waiting,overdue,projects,followups,notes].find((result)=>result.error);if(failure?.error)throw failure.error;
 const priorities=((plan.data?.daily_priorities??[]) as unknown as {position:number;tasks:Record<string,unknown>}[]).sort((a,b)=>a.position-b.position).map((item)=>({...item.tasks,position:item.position}));
 const nextEvent=(events.data??[]).find((event)=>new Date(event.ends_at)>=new Date())??null;
 const summary=buildSummary({priorities,inbox:inbox.count??0,waiting:waiting.count??waiting.data?.length??0,overdue:overdue.count??0,nextEvent,followups:followups.data??[]});
 return NextResponse.json({date:today,profile:profile.data,priorities,inboxCount:inbox.count??0,events:events.data??[],nextEvent,waiting:waiting.data??[],waitingCount:waiting.count??0,overdueCount:overdue.count??0,projects:projects.data??[],followups:followups.data??[],notes:notes.data??[],insights,summary});
 }catch(error){return apiError(error,"Today could not be loaded.")}}

const prioritySchema=z.object({taskId:z.uuid(),position:z.number().int().min(1).max(3)});
export async function PUT(request:NextRequest){try{const input=prioritySchema.parse(await request.json());const{supabase,userId}=await requireUser();const profile=await supabase.from("profiles").select("timezone").eq("id",userId).maybeSingle();if(profile.error)throw profile.error;const today=dateInTimezone(new Date(),profile.data?.timezone??"UTC");const task=await supabase.from("tasks").select("id").eq("id",input.taskId).eq("user_id",userId).is("deleted_at",null).maybeSingle();if(!task.data)return NextResponse.json({error:"Task not found."},{status:404});const plan=await supabase.from("daily_plans").upsert({user_id:userId,plan_date:today},{onConflict:"user_id,plan_date"}).select("id").single();if(plan.error)throw plan.error;const saved=await supabase.from("daily_priorities").upsert({user_id:userId,plan_id:plan.data.id,task_id:input.taskId,position:input.position},{onConflict:"plan_id,position"}).select("*").single();if(saved.error)throw saved.error;return NextResponse.json({priority:saved.data});}catch(error){return apiError(error,"Daily priority could not be saved.")}}

function dateInTimezone(date:Date,timezone:string){return new Intl.DateTimeFormat("en-CA",{timeZone:timezone,year:"numeric",month:"2-digit",day:"2-digit"}).format(date)}
function dayBounds(day:string,timezone:string){const noonUtc=new Date(`${day}T12:00:00.000Z`);const parts=new Intl.DateTimeFormat("en-US",{timeZone:timezone,timeZoneName:"longOffset",hour:"2-digit"}).formatToParts(noonUtc);const offset=parts.find((part)=>part.type==="timeZoneName")?.value.replace("GMT","" )||"+00:00";return{start:new Date(`${day}T00:00:00${offset}`).toISOString(),end:new Date(`${day}T23:59:59.999${offset}`).toISOString()}}

function buildSummary(input:{priorities:Record<string,unknown>[];inbox:number;waiting:number;overdue:number;nextEvent:Record<string,unknown>|null;followups:Record<string,unknown>[]}){const parts=[];if(input.priorities.length)parts.push(`${input.priorities.length} win${input.priorities.length===1?" is":"s are"} selected`);else parts.push("Choose up to three wins for today");if(input.overdue)parts.push(`${input.overdue} overdue task${input.overdue===1?" needs":"s need"} attention`);if(input.waiting)parts.push(`${input.waiting} open loop${input.waiting===1?" is":"s are"} waiting`);if(input.inbox)parts.push(`${input.inbox} inbox item${input.inbox===1?" needs":"s need"} triage`);if(input.nextEvent)parts.push(`your next event is ${String(input.nextEvent.title)}`);if(input.followups.length)parts.push(`${input.followups.length} follow-up${input.followups.length===1?" is":"s are"} open`);return `${parts.join("; ")}.`;}
