import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";
import { adaptiveModules } from "@/lib/intelligence/overview";
import { getIntelligence } from "@/lib/intelligence/server";
import { calendarConflictDisplayType, nearTermCalendarConflict } from "@/lib/calendar-conflicts";
import {optionalFinancialOverview} from '@/lib/financial-integration';
import { getCommerceContext, loadFullCommerceState } from '@/lib/commerce-server';

export async function GET(){try{const{supabase,userId}=await requireUser();const profile=await supabase.from("profiles").select("display_name,timezone").eq("id",userId).maybeSingle();if(profile.error)throw profile.error;const timezone=profile.data?.timezone??"UTC";const today=dateInTimezone(new Date(),timezone);const {start,end}=dayBounds(today,timezone);
 const [plan,inbox,events,waiting,overdue,projects,followups,notes,intelligenceResult,replyThreads,integrationHealth,calendarConflicts,opportunities,proposals,scopeChanges,lifeDocuments,lifeRenewals,lifeAdmin,lifeTrips]=await Promise.all([
  supabase.from("daily_plans").select("id,notes,daily_priorities(position,tasks(*))").eq("user_id",userId).eq("plan_date",today).maybeSingle(),
  supabase.from("inbox_items").select("id",{count:"exact",head:true}).eq("user_id",userId).eq("status","unprocessed").is("deleted_at",null),
  supabase.from("calendar_events").select("*").eq("user_id",userId).gte("starts_at",start).lte("starts_at",end).is("deleted_at",null).neq("status","cancelled").order("starts_at"),
  supabase.from("waiting_items").select("*",{count:"exact"}).eq("user_id",userId).eq("status","waiting").is("deleted_at",null).order("created_at").limit(5),
  supabase.from("tasks").select("id",{count:"exact",head:true}).eq("user_id",userId).lt("due_date",today).neq("status","completed").is("deleted_at",null),
  supabase.from("projects").select("*").eq("user_id",userId).eq("status","active").is("deleted_at",null).order("updated_at",{ascending:false}).limit(5),
  supabase.from("followups").select("*").eq("user_id",userId).eq("status","open").is("deleted_at",null).order("due_at").limit(5),
  supabase.from("notes").select("*").eq("user_id",userId).is("deleted_at",null).order("updated_at",{ascending:false}).limit(3),
  getIntelligence(supabase,userId),
  supabase.from("email_threads").select("id,subject,last_message_at,linked_client_id").eq("user_id",userId).eq("reply_state","awaiting_user_reply").order("last_message_at",{ascending:false}).limit(3),
  supabase.from("integrations").select("provider,status,sync_status").eq("user_id",userId).in("status",["expired","error"]),
  supabase.from("calendar_event_sync_state").select("id,conflict_type,conflict_detected_at,local_delete_intent,calendar_events(id,title,starts_at,ends_at)").eq("user_id",userId).not("conflict_type","is",null).order("conflict_detected_at",{ascending:false}).limit(10),
  supabase.from("opportunities").select("id,title,estimated_value,currency,next_action,updated_at,stage").eq("user_id",userId).is("archived_at",null).not("stage","in",'(won,lost)').order("updated_at").limit(20),
  supabase.from("proposals").select("id,title,total,currency,valid_until,status").eq("user_id",userId).eq("status","sent").is("archived_at",null).order("valid_until").limit(10),
  supabase.from("scope_change_requests").select("id,title,project_id,estimated_hours,status").eq("user_id",userId).eq("status","approved").order("updated_at",{ascending:false}).limit(5),
  supabase.from("personal_documents").select("id,label,expires_at").eq("user_id",userId).is("archived_at",null).not("expires_at","is",null).order("expires_at").limit(10),
  supabase.from("personal_renewals").select("id,title,due_date,lead_time_days").eq("user_id",userId).not("status","in","(renewed,canceled)").order("due_date").limit(10),
  supabase.from("personal_admin_items").select("id,title,due_date").eq("user_id",userId).not("status","in","(completed,canceled)").order("due_date").limit(10),
  supabase.from("trips").select("id,title,start_date,updated_at").eq("user_id",userId).is("archived_at",null).not("status","in","(completed,canceled)").order("start_date").limit(5)
 ]);const failure=[plan,inbox,events,waiting,overdue,projects,followups,notes,calendarConflicts,opportunities,proposals,scopeChanges,lifeDocuments,lifeRenewals,lifeAdmin,lifeTrips].find((result)=>result.error);if(failure?.error)throw failure.error;
 const priorities=((plan.data?.daily_priorities??[]) as unknown as {position:number;tasks:Record<string,unknown>}[]).sort((a,b)=>a.position-b.position).map((item)=>({...item.tasks,position:item.position}));
 const nextEvent=(events.data??[]).find((event)=>new Date(event.ends_at)>=new Date())??null;
 const summary=buildSummary({priorities,inbox:inbox.count??0,waiting:waiting.count??waiting.data?.length??0,overdue:overdue.count??0,nextEvent,followups:followups.data??[]});
 const intelligence=intelligenceResult.overview;
 const financial=await optionalFinancialOverview(supabase,userId);
 const financialSignals=(financial?.risks??[]).filter(r=>r.score>=80).slice(0,2);
 const existing=intelligence.attentionQueue.filter(item=>!financialSignals.some(r=>r.route===item.route));
 const insights=[...existing.map(item=>({id:item.key,score:item.priority,severity:item.priority>=80?'critical':item.priority>=60?'high':'medium',title:item.label,message:item.reason,action_label:'Act',action_route:item.route})),...financialSignals.map(r=>({id:r.key,score:r.score,severity:r.severity==='critical'?'critical':'high',title:r.title,message:r.evidence,action_label:r.action,action_route:r.route}))].sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id)).slice(0,8);
 const externalSignals=[...(replyThreads.data??[]).map((thread)=>({kind:"email",title:`Reply may be needed: ${thread.subject}`,route:"/communication",occurredAt:thread.last_message_at})),...(integrationHealth.data??[]).map((connection)=>({kind:"integration",title:`${connection.provider} connection needs attention`,route:"/settings/integrations",occurredAt:null}))];
 const nearTermConflict=nearTermCalendarConflict((calendarConflicts.data??[]).map((state)=>({...state,local_event:state.calendar_events as unknown as Record<string,unknown>})),new Date());
 const calendarConflict=nearTermConflict?{id:nearTermConflict.id,title:String(nearTermConflict.local_event?.title??"Calendar event"),conflictType:calendarConflictDisplayType(String(nearTermConflict.conflict_type),Boolean(nearTermConflict.local_delete_intent)),startsAt:nearTermConflict.local_event?.starts_at,route:`/calendar?conflict=${nearTermConflict.id}`}:null;
 const businessSignals=[...(opportunities.data??[]).filter(item=>!item.next_action&&Number(item.estimated_value??0)>0).map(item=>({id:`opportunity:${item.id}`,title:"Opportunity needs follow-up",message:`${item.title} · ${item.estimated_value} ${item.currency??"MAD"} has no next sales action.`,route:`/pipeline?opportunity=${item.id}`,priority:Number(item.estimated_value??0)})),...(proposals.data??[]).filter(item=>item.valid_until&&new Date(String(item.valid_until)).getTime()-Date.now()<7*86400000).map(item=>({id:`proposal:${item.id}`,title:"Proposal expires soon",message:`${item.title} expires ${String(item.valid_until)}.`,route:`/proposals?proposal=${item.id}`,priority:Number(item.total??0)})),...(scopeChanges.data??[]).map(item=>({id:`scope:${item.id}`,title:"Approved scope change",message:`${item.title} is approved and should be reflected in delivery.`,route:`/projects/${item.project_id}`,priority:Number(item.estimated_hours??0)}))].sort((a,b)=>b.priority-a.priority).slice(0,3);
 const lifeSignals=[...(lifeDocuments.data??[]).filter(item=>item.expires_at&&Math.floor((Date.parse(`${item.expires_at}T00:00:00Z`)-Date.parse(`${today}T00:00:00Z`))/86400000)<=60).map(item=>({id:`life-document:${item.id}`,title:"Document expires soon",message:`${item.label} expires ${item.expires_at}.`,route:"/documents",priority:80})),...(lifeRenewals.data??[]).filter(item=>item.due_date&&Math.floor((Date.parse(`${item.due_date}T00:00:00Z`)-Date.parse(`${today}T00:00:00Z`))/86400000)<=Number(item.lead_time_days??30)).map(item=>({id:`life-renewal:${item.id}`,title:"Renewal needs attention",message:`${item.title} is due ${item.due_date}.`,route:"/life",priority:70})),...(lifeAdmin.data??[]).filter(item=>item.due_date&&item.due_date<today).map(item=>({id:`life-admin:${item.id}`,title:"Personal admin is overdue",message:item.title,route:"/life",priority:75})),...(lifeTrips.data??[]).filter(item=>item.start_date&&Math.floor((Date.parse(`${item.start_date}T00:00:00Z`)-Date.parse(`${today}T00:00:00Z`))/86400000)<=14).map(item=>({id:`life-trip:${item.id}`,title:"Trip approaching",message:`${item.title} starts ${item.start_date}.`,route:`/travel/${item.id}`,priority:65}))].sort((a,b)=>b.priority-a.priority).slice(0,3);
 const company=await supabase.from("companies").select("id").eq("user_id",userId).eq("active",true).maybeSingle();if(company.error)throw company.error;let founderSignals:{id:string;title:string;message:string;route:string;priority:number}[]=[];if(company.data){const[deployments,incidents]=await Promise.all([supabase.from("deployment_records").select("id,status,environment,commit_message").eq("user_id",userId).eq("company_id",company.data.id).eq("environment","production").eq("status","failed").limit(2),supabase.from("incidents").select("id,title,severity").eq("user_id",userId).eq("company_id",company.data.id).neq("status","resolved").limit(5)]);const founderFailure=[deployments,incidents].find(result=>result.error);if(founderFailure?.error)throw founderFailure.error;founderSignals=[...(incidents.data??[]).filter(item=>item.severity==="critical").map(item=>({id:`founder-incident:${item.id}`,title:"Critical production incident",message:item.title,route:"/founder",priority:100})),...(deployments.data??[]).map(item=>({id:`founder-deployment:${item.id}`,title:"Production deployment failed",message:item.commit_message??"Review the latest production deployment.",route:"/founder",priority:90}))].sort((a,b)=>b.priority-a.priority).slice(0,2)}
 const [strategicCommitments,strategyGates]=await Promise.all([supabase.from("strategic_commitments").select("id,title,target_date,status").eq("user_id",userId).not("status","in","(completed,dropped)").order("target_date").limit(12),supabase.from("decision_gates").select("id,title,due_date").eq("user_id",userId).eq("status","open").order("due_date").limit(8)]);const strategyFailure=[strategicCommitments,strategyGates].find(result=>result.error);if(strategyFailure?.error)throw strategyFailure.error;const strategicSignals=[...(strategyGates.data??[]).filter(item=>item.due_date&&item.due_date<=today).map(item=>({id:"strategy-gate:"+item.id,title:"Decision due today",message:item.title+" blocks strategic progress.",route:"/control-tower",priority:95})),...(strategicCommitments.data??[]).filter(item=>item.status==="at_risk"&&item.target_date&&item.target_date<=new Date(Date.now()+86400000).toISOString().slice(0,10)).map(item=>({id:"strategy-commitment:"+item.id,title:"Strategic milestone needs attention",message:item.title+" is at risk near its target date.",route:"/control-tower",priority:80}))].sort((a,b)=>b.priority-a.priority).slice(0,2);
 const [topicsDue,staleSources,watchesDue]=await Promise.all([supabase.from("research_topics").select("id,title,next_review_at").eq("user_id",userId).neq("status","archived").not("next_review_at","is",null).lte("next_review_at",today).limit(3),supabase.from("knowledge_sources").select("id,title,freshness_expires_at").eq("user_id",userId).not("freshness_expires_at","is",null).lt("freshness_expires_at",today).limit(3),supabase.from("watch_entities").select("id,name,next_check_at").eq("user_id",userId).eq("status","active").not("next_check_at","is",null).lte("next_check_at",today).limit(3)]);const knowledgeFailure=[topicsDue,staleSources,watchesDue].find(result=>result.error);if(knowledgeFailure?.error)throw knowledgeFailure.error;const knowledgeSignals=[...(topicsDue.data??[]).map(item=>({id:`knowledge-topic:${item.id}`,title:"Topic review due",message:`${item.title} is scheduled for review.`,route:`/knowledge/topics/${item.id}`,priority:70})),...(staleSources.data??[]).map(item=>({id:`knowledge-source:${item.id}`,title:"Source freshness expired",message:`${item.title} needs re-verification.`,route:`/knowledge/sources/${item.id}`,priority:65})),...(watchesDue.data??[]).map(item=>({id:`knowledge-watch:${item.id}`,title:"Watch item check due",message:`${item.name} is due for scheduled check.`,route:`/knowledge/watch`,priority:60}))].sort((a,b)=>b.priority-a.priority).slice(0,2);
 const growthSignals=[...(opportunities.data??[]).filter(item=>(!item.next_action||!String(item.next_action).trim())&&Number(item.estimated_value??0)>=15000).map(item=>({id:`growth-opp:${item.id}`,title:"High-value deal has no next action",message:`${item.title} (${item.estimated_value} ${item.currency??"MAD"}) needs a scheduled sales action.`,route:`/pipeline?opportunity=${item.id}`,priority:Number(item.estimated_value??0)})),...(proposals.data??[]).filter(item=>item.valid_until&&item.valid_until<=new Date(Date.now()+4*86400000).toISOString().slice(0,10)).map(item=>({id:`growth-prop:${item.id}`,title:"Proposal follow-up required",message:`${item.title} expires soon (${item.valid_until}).`,route:`/proposals?proposal=${item.id}`,priority:Number(item.total??0)}))].sort((a,b)=>b.priority-a.priority).slice(0,2);  const [opRuns, opIncidents, opSops] = await Promise.all([supabase.from("process_runs").select("id,title,priority,status,due_at").eq("user_id", userId).in("status", ["failed", "blocked", "in_progress", "ready", "planned"]).limit(10),supabase.from("quality_incidents").select("id,title,severity,status").eq("user_id", userId).eq("severity", "critical").neq("status", "resolved").limit(3),supabase.from("operational_sops").select("id,title,criticality,next_review_at").eq("user_id", userId).eq("criticality", "critical").lte("next_review_at", today).limit(3)]); const operationsSignals = [...(opRuns.data ?? []).filter(r => r.status === "failed").map(r => ({ id: `op-run-failed:${r.id}`, title: "Critical process failed", message: `${r.title} failed and needs operational review.`, route: `/operations/runs/${r.id}`, priority: 100 })),...(opIncidents.data ?? []).map(i => ({ id: `op-incident:${i.id}`, title: "Critical quality incident", message: `${i.title} is open.`, route: "/operations/quality", priority: 95 })),...(opRuns.data ?? []).filter(r => r.status === "blocked").map(r => ({ id: `op-run-blocked:${r.id}`, title: "Process run blocked", message: `${r.title} is blocked.`, route: `/operations/runs/${r.id}`, priority: 90 })),...(opRuns.data ?? []).filter(r => ["planned", "ready", "in_progress"].includes(r.status) && r.due_at && r.due_at.slice(0, 10) < today).map(r => ({ id: `op-run-overdue:${r.id}`, title: "Process run overdue", message: `${r.title} is past due date.`, route: `/operations/runs/${r.id}`, priority: 85 })),...(opSops.data ?? []).map(s => ({ id: `op-sop-review:${s.id}`, title: "Critical SOP review overdue", message: `${s.title} is due for scheduled review.`, route: `/operations/sops/${s.id}`, priority: 80 }))].sort((a, b) => b.priority - a.priority).slice(0, 2);
  const [tDels, tResps, tEscs] = await Promise.all([supabase.from("team_delegations").select("id,title,priority,status,due_at,blocked_reason").eq("user_id", userId).in("status", ["blocked", "assigned", "acknowledged", "in_progress"]).limit(10), supabase.from("team_responsibilities").select("id,name,criticality,primary_owner_id").eq("user_id", userId).eq("criticality", "critical").is("primary_owner_id", null).limit(3), supabase.from("team_escalations").select("id,reason,severity").eq("user_id", userId).eq("status", "open").eq("severity", "critical").limit(3)]);
  const teamSignals = [...(tEscs.data ?? []).map(e => ({ id: `team-esc:${e.id}`, title: "Critical team escalation", message: e.reason, route: "/team/risks", priority: 100 })), ...(tDels.data ?? []).filter(d => d.status === "blocked" && d.priority === "critical").map(d => ({ id: `team-del-blocked:${d.id}`, title: "Critical delegation blocked", message: `${d.title} is blocked: ${d.blocked_reason || "needs unblocking"}`, route: "/team/delegations", priority: 95 })), ...(tResps.data ?? []).map(r => ({ id: `team-resp-unowned:${r.id}`, title: "Critical responsibility has no owner", message: `Area "${r.name}" has no primary owner assigned.`, route: "/team/responsibilities", priority: 90 })), ...(tDels.data ?? []).filter(d => d.priority === "critical" && d.due_at && d.due_at.slice(0, 10) < today).map(d => ({ id: `team-del-overdue:${d.id}`, title: "Critical delegation overdue", message: `${d.title} missed target due date.`, route: "/team/delegations", priority: 85 }))].sort((a, b) => b.priority - a.priority).slice(0, 2);
  const [csRisks, csRenewals, csIssues, csCommitments] = await Promise.all([
    supabase.from("client_risks").select("id, client_id, description, severity").eq("user_id", userId).in("status", ["open", "mitigating"]).eq("severity", "critical").limit(3),
    supabase.from("client_renewals").select("id, client_id, renewal_date, preparation_state").eq("user_id", userId).in("status", ["upcoming", "preparing"]).lte("renewal_date", new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10)).limit(3),
    supabase.from("client_issues").select("id, client_id, title, severity").eq("user_id", userId).in("status", ["open", "investigating", "waiting_on_us"]).eq("severity", "critical").limit(3),
    supabase.from("client_commitments").select("id, client_id, statement, due_at").eq("user_id", userId).eq("status", "open").eq("direction", "we_owe_client").lt("due_at", today).limit(3),
  ]);
  const customerSuccessSignals = [
    ...(csIssues.data ?? []).map(i => ({ id: `cs-issue:${i.id}`, title: "Critical client issue open", message: i.title, route: `/success/clients/${i.client_id}`, priority: 100 })),
    ...(csRisks.data ?? []).map(r => ({ id: `cs-risk:${r.id}`, title: "Critical client risk", message: r.description, route: `/success/clients/${r.client_id}`, priority: 95 })),
    ...(csCommitments.data ?? []).map(c => ({ id: `cs-commit:${c.id}`, title: "Client promise overdue", message: c.statement, route: `/success/clients/${c.client_id}`, priority: 90 })),
    ...(csRenewals.data ?? []).filter(ren => ren.preparation_state === "not_started").map(ren => ({ id: `cs-renewal:${ren.id}`, title: "Client renewal approaching", message: `Renewal due ${ren.renewal_date} has no prep started.`, route: `/success/clients/${ren.client_id}`, priority: 85 })),
  ].sort((a, b) => b.priority - a.priority).slice(0, 2);
  // Commerce signals — max 2 highest-priority (critical stockout, late PO)
  let commerceSignals: {id:string;title:string;message:string;route:string;priority:number}[] = [];
  try {
    const commerceCtx = await getCommerceContext();
    if (commerceCtx.isConfigured && commerceCtx.companyId) {
      const state = await loadFullCommerceState(commerceCtx.supabase, commerceCtx.userId!, commerceCtx.companyId);
      commerceSignals = [
        ...state.products.filter(p => p.stockout.state === "critical").slice(0, 2).map(p => ({ id: `commerce-stockout:${p.id}`, title: "Critical stockout risk", message: `${p.name} may run out of stock${p.stockout.runoutDate ? ` by ${p.stockout.runoutDate.slice(0,10)}` : ""}.`, route: "/commerce/inventory", priority: 100 })),
        ...state.supplierOrders.filter(o => o.health.state === "late").slice(0, 2).map(o => ({ id: `commerce-late-po:${o.id}`, title: "Supplier order is late", message: `PO ${o.reference || o.id} is overdue by ${o.health.daysOverdue ?? 0} day(s).`, route: "/commerce/purchasing", priority: 90 })),
      ].sort((a, b) => b.priority - a.priority).slice(0, 2);
    }
  } catch { /* commerce signals are optional; fail gracefully */ }
  // Chief of Staff signals — max 1 highest-priority (e.g. pending approval or failed execution)
  let chiefOfStaffSignal: {id:string;title:string;message:string;route:string;priority:number} | null = null;
  try {
    const { data: pendingApprovals } = await supabase
      .from("approval_items")
      .select("id, title, risk_level")
      .eq("user_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1);

    if (pendingApprovals && pendingApprovals.length > 0) {
      chiefOfStaffSignal = {
        id: `chief-approval:${pendingApprovals[0].id}`,
        title: "Action approval required",
        message: `${pendingApprovals[0].title} is waiting for your verification.`,
        route: "/chief-of-staff/approvals",
        priority: 95,
      };
    } else {
      const { data: failedExecutions } = await supabase
        .from("action_executions")
        .select("id, title, error_message")
        .eq("user_id", userId)
        .eq("status", "failed")
        .order("created_at", { ascending: false })
        .limit(1);

      if (failedExecutions && failedExecutions.length > 0) {
        chiefOfStaffSignal = {
          id: `chief-failed:${failedExecutions[0].id}`,
          title: "Action execution failed",
          message: failedExecutions[0].error_message || `${failedExecutions[0].title} failed and needs review.`,
          route: "/chief-of-staff/executions",
          priority: 90,
        };
      }
    }
  } catch { /* chief of staff signal optional; fail gracefully */ }
  // V18 Operating Learning signal — max 1 (only shown if actionable, e.g. review needed)
  let learningSignal: { id: string; title: string; message: string; route: string; priority: number } | null = null;
  try {
    const { data: lessonsDue } = await supabase
      .from("operating_lessons")
      .select("id, title, status, domain, review_at")
      .eq("user_id", userId)
      .eq("scope", "business")
      .in("status", ["needs_review", "proposed"])
      .order("created_at", { ascending: false })
      .limit(1);

    if (lessonsDue && lessonsDue.length > 0) {
      learningSignal = {
        id: `learning-review:${lessonsDue[0].id}`,
        title: "Operating lesson needs review",
        message: `${lessonsDue[0].title} (${lessonsDue[0].domain}) requires verification.`,
        route: `/learning/lessons/${lessonsDue[0].id}`,
        priority: 85,
      };
    }
  } catch { /* learning signal optional; fail gracefully */ }
  return NextResponse.json({date:today,profile:profile.data,priorities,inboxCount:inbox.count??0,events:events.data??[],nextEvent,waiting:waiting.data??[],waitingCount:waiting.count??0,overdueCount:overdue.count??0,projects:projects.data??[],followups:followups.data??[],notes:notes.data??[],insights,summary,intelligence,externalSignals,calendarConflict,businessSignals,founderSignals,lifeSignals,strategicSignals,knowledgeSignals,growthSignals,operationsSignals,teamSignals,customerSuccessSignals,commerceSignals,chiefOfStaffSignal,learningSignal,modules:adaptiveModules(intelligence)});
}catch(error){return apiError(error,"Today could not be loaded.")}}

const prioritySchema=z.object({taskId:z.uuid(),position:z.number().int().min(1).max(3)});
export async function PUT(request:NextRequest){try{const input=prioritySchema.parse(await request.json());const{supabase,userId}=await requireUser();const profile=await supabase.from("profiles").select("timezone").eq("id",userId).maybeSingle();if(profile.error)throw profile.error;const today=dateInTimezone(new Date(),profile.data?.timezone??"UTC");const task=await supabase.from("tasks").select("id").eq("id",input.taskId).eq("user_id",userId).is("deleted_at",null).maybeSingle();if(!task.data)return NextResponse.json({error:"Task not found."},{status:404});const plan=await supabase.from("daily_plans").upsert({user_id:userId,plan_date:today},{onConflict:"user_id,plan_date"}).select("id").single();if(plan.error)throw plan.error;const saved=await supabase.from("daily_priorities").upsert({user_id:userId,plan_id:plan.data.id,task_id:input.taskId,position:input.position},{onConflict:"plan_id,position"}).select("*").single();if(saved.error)throw saved.error;return NextResponse.json({priority:saved.data});}catch(error){return apiError(error,"Daily priority could not be saved.")}}

function dateInTimezone(date:Date,timezone:string){return new Intl.DateTimeFormat("en-CA",{timeZone:timezone,year:"numeric",month:"2-digit",day:"2-digit"}).format(date)}
function dayBounds(day:string,timezone:string){const noonUtc=new Date(`${day}T12:00:00.000Z`);const parts=new Intl.DateTimeFormat("en-US",{timeZone:timezone,timeZoneName:"longOffset",hour:"2-digit"}).formatToParts(noonUtc);const offset=parts.find((part)=>part.type==="timeZoneName")?.value.replace("GMT","" )||"+00:00";return{start:new Date(`${day}T00:00:00${offset}`).toISOString(),end:new Date(`${day}T23:59:59.999${offset}`).toISOString()}}

function buildSummary(input:{priorities:Record<string,unknown>[];inbox:number;waiting:number;overdue:number;nextEvent:Record<string,unknown>|null;followups:Record<string,unknown>[]}){const parts=[];if(input.priorities.length)parts.push(`${input.priorities.length} win${input.priorities.length===1?" is":"s are"} selected`);else parts.push("Choose up to three wins for today");if(input.overdue)parts.push(`${input.overdue} overdue task${input.overdue===1?" needs":"s need"} attention`);if(input.waiting)parts.push(`${input.waiting} open loop${input.waiting===1?" is":"s are"} waiting`);if(input.inbox)parts.push(`${input.inbox} inbox item${input.inbox===1?" needs":"s need"} triage`);if(input.nextEvent)parts.push(`your next event is ${String(input.nextEvent.title)}`);if(input.followups.length)parts.push(`${input.followups.length} follow-up${input.followups.length===1?" is":"s are"} open`);return `${parts.join("; ")}.`;}
