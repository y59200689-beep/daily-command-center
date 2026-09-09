import { z } from "zod";
import { createRecord,updateRecord } from "@/lib/repository";
import { pushGoogleEvent } from "@/lib/integrations/google-calendar";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAnalyticsSummary,getContentSummary,getFinanceSummary,getFitnessWeek,getTodayInsights } from "@/lib/intelligence";
import { renderPrompt } from "@/lib/v2";
import { getIntelligence } from "@/lib/intelligence/server";
import { generateDailyPlan } from "@/lib/intelligence/planning";
import { buildMeetingBrief } from "@/lib/intelligence/meeting";
import { buildWeeklyReview } from "@/lib/intelligence/reviews";
import { groupedRevenueForecast, pricingHistory } from "@/lib/business";
import {
  buildClientWaitingState,
  rankNextCustomerSuccessAction,
  evaluateAccountHealth,
  evaluateChurnRisk,
  evaluateRenewalReadiness,
  buildRetentionReview,
  type ClientRecord,
  type ClientOutcome,
  type ClientRisk,
  type ClientRenewal,
  type ClientIssue,
  type ClientCommitment,
  type ClientSatisfactionSignal,
} from "@/lib/success";

const query=z.object({query:z.string().max(240).default("")}).strict();const id=z.object({id:z.uuid()}).strict();const tool=(name:string,description:string,properties:Record<string,unknown>,required:string[]=[])=>({type:"function",name,description,parameters:{type:"object",properties,required,additionalProperties:false}});
const string={type:"string"};const nullableString={type:["string","null"]};
export const assistantTools=[
 tool("search_tasks","Search the authenticated user's tasks.",{query:string},["query"]),tool("create_task","Create a task after explicit user confirmation.",{title:string,due_date:nullableString,project_id:nullableString,confirmed:{type:"boolean"}},["title","due_date","project_id","confirmed"]),tool("update_task","Update a task after explicit user confirmation.",{id:string,title:nullableString,status:nullableString,due_date:nullableString,confirmed:{type:"boolean"}},["id","title","status","due_date","confirmed"]),tool("complete_task","Complete a task after explicit user confirmation.",{id:string,confirmed:{type:"boolean"}},["id","confirmed"]),
 tool("search_projects","Search projects.",{query:string},["query"]),tool("get_project","Get one project and linked work.",{id:string},["id"]),tool("search_notes","Search notes.",{query:string},["query"]),tool("create_note","Create a note after explicit user confirmation.",{title:string,content:string,project_id:nullableString,confirmed:{type:"boolean"}},["title","content","project_id","confirmed"]),tool("search_clients","Search clients.",{query:string},["query"]),tool("create_followup","Create a follow-up after explicit user confirmation.",{title:string,client_id:nullableString,due_at:nullableString,confirmed:{type:"boolean"}},["title","client_id","due_at","confirmed"]),
 tool("get_calendar","Get calendar events in an ISO date range.",{start:string,end:string},["start","end"]),tool("create_calendar_event","Create and sync a calendar event after explicit user confirmation.",{title:string,starts_at:string,ends_at:string,timezone:string,confirmed:{type:"boolean"}},["title","starts_at","ends_at","timezone","confirmed"]),tool("get_waiting_items","Get open waiting items.",{}),tool("search_decisions","Search decisions.",{query:string},["query"]),tool("get_goals","Get active goals.",{}),
 tool("get_finance_summary","Get current finance totals and overdue invoices.",{}),tool("search_invoices","Search invoices by title or number.",{query:string},["query"]),tool("create_invoice","Create an invoice after explicit confirmation.",{title:string,client_id:nullableString,project_id:nullableString,subtotal:{type:"number"},tax_amount:{type:"number"},discount_amount:{type:"number"},currency:string,due_date:nullableString,confirmed:{type:"boolean"}},["title","client_id","project_id","subtotal","tax_amount","discount_amount","currency","due_date","confirmed"]),tool("record_payment","Record an invoice payment after explicit confirmation.",{invoice_id:string,amount:{type:"number"},payment_date:string,confirmed:{type:"boolean"}},["invoice_id","amount","payment_date","confirmed"]),tool("search_expenses","Search expenses.",{query:string},["query"]),
 tool("search_content","Search content items.",{query:string},["query"]),tool("create_content_item","Create content after explicit confirmation.",{title:string,status:string,client_id:nullableString,project_id:nullableString,due_date:nullableString,confirmed:{type:"boolean"}},["title","status","client_id","project_id","due_date","confirmed"]),tool("update_content_status","Change content workflow status after explicit confirmation.",{id:string,status:string,confirmed:{type:"boolean"}},["id","status","confirmed"]),tool("get_content_pipeline","Get the current content workflow.",{}),
 tool("search_prompts","Search prompts.",{query:string},["query"]),tool("get_prompt","Get a prompt and its template.",{id:string},["id"]),tool("render_prompt_with_variables","Render a prompt with variable values and track usage.",{id:string,variables:{type:"object",additionalProperties:{type:"string"}}},["id","variables"]),tool("create_decision","Create a decision after explicit confirmation.",{title:string,decision:string,project_id:nullableString,impact:string,confidence:string,review_date:nullableString,confirmed:{type:"boolean"}},["title","decision","project_id","impact","confidence","review_date","confirmed"]),tool("get_decisions_due_for_review","Get decisions due for review.",{}),
 tool("get_fitness_week","Get this week's activities and target progress.",{}),tool("log_fitness_activity","Log an activity after explicit confirmation.",{activity_type:string,date:string,duration_minutes:{type:["number","null"]},distance_km:{type:["number","null"]},confirmed:{type:"boolean"}},["activity_type","date","duration_minutes","distance_km","confirmed"]),tool("get_fitness_targets","Get active fitness targets.",{}),tool("get_productivity_summary","Get productivity analytics.",{}),tool("get_business_summary","Get business analytics.",{}),tool("get_project_summary","Get project analytics.",{}),tool("get_content_summary","Get content analytics.",{}),tool("get_fitness_summary","Get fitness analytics.",{}),tool("get_today_insights","Get ranked cross-domain Today insights.",{}),
 tool("get_next_best_action","Get the strongest evidence-based next action.",{}),tool("get_attention_queue","Get ranked next actions with explanations.",{}),tool("get_project_health","Get health, reasons, and next action for an owned project.",{id:string},["id"]),tool("get_client_health","Get health, reasons, and next action for an owned client.",{id:string},["id"]),tool("get_financial_risks","Get current financial risks grounded in owned records.",{}),tool("get_content_risks","Get current content and campaign risks.",{}),tool("get_weekly_review","Generate the current grounded weekly executive review.",{}),tool("generate_daily_plan","Generate a suggested plan without changing priorities.",{}),tool("get_available_focus_windows","Get today's available work windows.",{}),tool("get_meeting_brief","Prepare context for an owned calendar event.",{id:string},["id"]),tool("search_memory","Search sourced active memory.",{query:string},["query"]),tool("get_patterns","Get patterns and conservative predictions with sample sizes.",{}),tool("accept_daily_plan","Accept today's generated plan after explicit confirmation.",{task_ids:{type:"array",items:{type:"string"},maxItems:3},confirmed:{type:"boolean"}},["task_ids","confirmed"]),tool("snooze_insight","Snooze one recommendation after explicit confirmation.",{insight_key:string,insight_type:string,hours:{type:"number"},confirmed:{type:"boolean"}},["insight_key","insight_type","hours","confirmed"]),tool("dismiss_insight","Dismiss one recommendation after explicit confirmation.",{insight_key:string,insight_type:string,confirmed:{type:"boolean"}},["insight_key","insight_type","confirmed"]),tool("get_communication_queue","Get reply, follow-up, and waiting context.",{}),tool("get_approval_queue","Get pending approval actions.",{}),tool("get_automation_status","Get automation status.",{}),tool("draft_email_reply","Prepare an email reply. It never sends.",{thread_id:string,style:string},["thread_id","style"]),tool("draft_invoice_reminder","Prepare a verified invoice reminder.",{invoice_id:string,style:string},["invoice_id","style"]),tool("send_email","Queue an exact message for explicit approval; never send directly.",{to:string,subject:string,body:string,threadId:nullableString,confirmed:{type:"boolean"}},["to","subject","body","threadId","confirmed"]),
 tool("get_pipeline_summary","Get the owned opportunity pipeline.",{}),tool("get_opportunity","Get one owned opportunity.",{id:string},["id"]),tool("get_stale_opportunities","Find owned open opportunities with no scheduled action.",{}),tool("get_proposal","Get one owned proposal and its items.",{id:string},["id"]),tool("get_revenue_forecast","Get a deterministic, currency-separated revenue forecast.",{}),tool("get_scope_status","Get sold scope and changes for one owned project.",{id:string},["id"]),tool("get_pricing_history","Get internal pricing history for an owned service.",{id:string},["id"]),tool("create_lead","Create a lead only after explicit confirmation.",{name:string,company:nullableString,email:nullableString,confirmed:{type:"boolean"}},["name","company","email","confirmed"]),tool("create_opportunity","Create an opportunity only after explicit confirmation.",{title:string,client_id:nullableString,estimated_value:{type:["number","null"]},currency:string,confirmed:{type:"boolean"}},["title","client_id","estimated_value","currency","confirmed"]),tool("update_opportunity_stage","Change an opportunity stage only after explicit confirmation.",{id:string,stage:string,confirmed:{type:"boolean"}},["id","stage","confirmed"]),tool("create_scope_change","Create a scope-change record only after explicit confirmation.",{project_id:string,title:string,description:string,estimated_value:{type:["number","null"]},currency:string,confirmed:{type:"boolean"}},["project_id","title","description","estimated_value","currency","confirmed"]),
 tool("get_company_health","Get the authenticated company and its current founder summary.",{}),tool("get_commerce_summary","Get owned normalized commerce totals.",{}),tool("get_product_performance","Get owned product performance.",{}),tool("get_low_stock_products","Get owned low-stock product snapshots.",{}),tool("get_growth_funnel","Get the most recent normalized growth funnel.",{}),tool("get_marketing_performance","Get owned marketing attribution records.",{}),tool("get_development_health","Get synchronized GitHub repository health.",{}),tool("get_latest_deployment","Get the latest owned production deployment.",{}),tool("get_incidents","Get owned unresolved production incidents.",{}),tool("get_ai_usage","Get owned AI usage and cost records.",{}),tool("get_roadmap_status","Get owned roadmap status.",{}),tool("get_support_summary","Get owned support case summary.",{}),tool("get_founder_attention_queue","Get deterministic founder attention.",{}),tool("get_next_founder_action","Get the top founder action.",{}),
 tool("create_roadmap_item","Create a roadmap item after explicit confirmation.",{title:string,confirmed:{type:"boolean"}},["title","confirmed"]),tool("create_incident","Create an incident after explicit confirmation.",{title:string,severity:string,confirmed:{type:"boolean"}},["title","severity","confirmed"]),tool("create_supplier_order_draft","Create a supplier-order draft after explicit confirmation.",{supplier_id:string,confirmed:{type:"boolean"}},["supplier_id","confirmed"]),
 tool("get_life_overview","Get a private overview of upcoming personal obligations.",{}),tool("get_upcoming_trips","Get owned upcoming trips.",{}),tool("get_trip_readiness","Get preparation status for an owned trip.",{id:string},["id"]),tool("get_travel_documents","Get owned travel and personal documents.",{}),tool("get_visa_status","Get owned visa applications and checklists.",{}),tool("get_upcoming_renewals","Get owned upcoming renewals.",{}),tool("get_expiring_documents","Get owned document expiry status.",{}),tool("get_personal_admin","Get owned open personal admin items.",{}),tool("get_important_dates","Get owned personal dates.",{}),tool("get_personal_goals","Get active owned goals for Life.",{}),tool("get_routines","Get owned active routines.",{}),tool("get_life_attention_queue","Get deterministic private life attention.",{}),tool("get_next_personal_action","Get the strongest private life action.",{}),
 tool("get_control_tower","Get owner-scoped strategic planning context.",{}),tool("get_current_commitments","Get active strategic commitments.",{}),tool("get_capacity","Get conservative strategic capacity.",{}),tool("get_portfolio","Get current strategic portfolio.",{}),tool("get_strategic_risks","Get bounded strategic risks.",{}),tool("get_next_strategic_move","Get the next deterministic strategic move.",{}),tool("get_upcoming_milestones","Get upcoming strategic milestones.",{}),tool("get_blocked_dependencies","Get blocked strategic dependencies.",{}),tool("get_decision_gates","Get unresolved decision gates.",{}),tool("get_30_60_90_plan","Get dated strategic horizons.",{}),tool("get_weekly_plan","Get active weekly planning period.",{}),tool("get_monthly_plan","Get active monthly planning period.",{}),tool("get_quarterly_plan","Get active quarterly planning period.",{}),tool("get_scenarios","Get hypothetical scenarios.",{}),tool("get_slippage_signals","Get deterministic strategic slippage signals.",{}),tool("create_commitment","Create a commitment after explicit confirmation.",{planning_period_id:string,title:string,confirmed:{type:"boolean"}},["planning_period_id","title","confirmed"]),tool("create_milestone","Create a milestone after explicit confirmation.",{title:string,confirmed:{type:"boolean"}},["title","confirmed"]),tool("create_planning_period","Create a planning period after explicit confirmation.",{title:string,type:string,starts_at:string,ends_at:string,confirmed:{type:"boolean"}},["title","type","starts_at","ends_at","confirmed"]),tool("create_scenario","Create a hypothetical scenario after explicit confirmation.",{title:string,confirmed:{type:"boolean"}},["title","confirmed"]),tool("create_decision_gate","Create a decision gate after explicit confirmation.",{title:string,confirmed:{type:"boolean"}},["title","confirmed"]),
 tool("create_trip","Create a trip after explicit confirmation.",{title:string,start_date:nullableString,end_date:nullableString,confirmed:{type:"boolean"}},["title","start_date","end_date","confirmed"]),tool("add_trip_task","Create a task linked to an owned trip after explicit confirmation.",{trip_id:string,title:string,due_date:nullableString,confirmed:{type:"boolean"}},["trip_id","title","due_date","confirmed"]),tool("add_packing_item","Add a packing item to an owned list after explicit confirmation.",{packing_list_id:string,title:string,confirmed:{type:"boolean"}},["packing_list_id","title","confirmed"]),tool("create_visa_application","Create a visa application after explicit confirmation.",{trip_id:nullableString,country:string,confirmed:{type:"boolean"}},["trip_id","country","confirmed"]),tool("create_personal_document","Create a personal document after explicit confirmation.",{label:string,type:string,expires_at:nullableString,confirmed:{type:"boolean"}},["label","type","expires_at","confirmed"]),tool("create_renewal","Create a renewal after explicit confirmation.",{title:string,due_date:nullableString,confirmed:{type:"boolean"}},["title","due_date","confirmed"]),tool("create_personal_admin_item","Create a personal admin item after explicit confirmation.",{title:string,due_date:nullableString,confirmed:{type:"boolean"}},["title","due_date","confirmed"]),tool("create_important_date","Create an important date after explicit confirmation.",{title:string,date:string,confirmed:{type:"boolean"}},["title","date","confirmed"]),tool("create_routine","Create a routine after explicit confirmation.",{title:string,confirmed:{type:"boolean"}},["title","confirmed"]),
 tool("get_fitness_progress","Get the current owned fitness progress for Life.",{}),tool("add_visa_document_requirement","Add a user-defined visa checklist requirement after explicit confirmation.",{visa_application_id:string,title:string,confirmed:{type:"boolean"}},["visa_application_id","title","confirmed"]),
  tool("search_knowledge_topics","Search the user's research topics.",{query:string},["query"]),tool("get_knowledge_topic","Get a research topic and its linked findings, questions, and sources.",{id:string},["id"]),tool("search_knowledge_findings","Search research findings.",{query:string},["query"]),tool("get_knowledge_overview","Get the knowledge library overview: active topics, open questions, stale sources, and watchlist.",{}),tool("create_research_topic","Create a research topic after explicit confirmation.",{title:string,domain:nullableString,priority:nullableString,confirmed:{type:"boolean"}},["title","confirmed"]),tool("create_research_finding","Create a research finding linked to a topic after explicit confirmation.",{topic_id:string,title:string,summary:string,confirmed:{type:"boolean"}},["topic_id","title","summary","confirmed"]),tool("create_research_question","Create a research question linked to a topic after explicit confirmation.",{topic_id:string,question:string,priority:nullableString,confirmed:{type:"boolean"}},["topic_id","question","confirmed"]),
  tool("get_growth_overview","Get overview of sales pipeline health, next growth move, active experiments, and expansion opportunities.",{}),tool("get_growth_experiments","Get active and planned growth experiments.",{}),tool("get_expansion_candidates","Get identified upsell, cross-sell, and renewal candidates.",{}),tool("get_lead_reactivations","Get dormant leads that can be reactivated.",{}),tool("create_growth_experiment","Create a growth experiment after explicit confirmation.",{name:string,hypothesis:string,target_metric:string,channel:nullableString,confirmed:{type:"boolean"}},["name","hypothesis","target_metric","confirmed"]),tool("create_sales_playbook","Create a sales playbook sequence after explicit confirmation.",{name:string,purpose:nullableString,target_type:string,confirmed:{type:"boolean"}},["name","target_type","confirmed"]),tool("create_sales_target","Create a commercial sales target after explicit confirmation.",{metric_type:string,target_value:{type:"number"},period:string,period_start:string,period_end:string,confirmed:{type:"boolean"}},["metric_type","target_value","period","period_start","period_end","confirmed"]),tool("record_deal_review","Record a won or lost deal retrospective review after explicit confirmation.",{opportunity_id:string,review_type:string,reason:nullableString,why_we_won:nullableString,lessons:nullableString,confirmed:{type:"boolean"}},["opportunity_id","review_type","confirmed"]),
   tool("get_operations_overview","Get overview of operations, active runs, failures, blocked items, and next operational move.",{}),tool("get_next_operational_move","Get the single ranked next operational action.",{}),tool("get_sop","Get an SOP detail and its procedure steps.",{id:string},["id"]),tool("search_sops","Search documented operating procedures.",{query:string},["query"]),tool("get_process","Get a process template.",{id:string},["id"]),tool("get_process_run","Get a process run execution detail.",{id:string},["id"]),tool("get_blocked_runs","Get currently blocked operational runs.",{}),tool("get_failed_runs","Get failed operational runs and root causes.",{}),tool("get_quality_incidents","Get active quality incidents.",{}),tool("get_process_health","Get derived health for a process.",{process_id:string},["process_id"]),tool("get_operations_review","Get the operations review summary.",{period:nullableString}),tool("create_sop_draft","Draft a new standard operating procedure after explicit confirmation.",{title:string,purpose:nullableString,category:nullableString,criticality:nullableString,confirmed:{type:"boolean"}},["title","confirmed"]),tool("create_process","Create a repeatable process template after explicit confirmation.",{name:string,sop_id:nullableString,category:nullableString,default_frequency:nullableString,confirmed:{type:"boolean"}},["name","confirmed"]),tool("create_process_run","Start or schedule a process run after explicit confirmation.",{title:string,process_template_id:nullableString,sop_id:nullableString,priority:nullableString,due_at:nullableString,confirmed:{type:"boolean"}},["title","confirmed"]),tool("create_quality_incident","Record an operational quality incident after explicit confirmation.",{title:string,description:string,severity:string,run_id:nullableString,confirmed:{type:"boolean"}},["title","description","severity","confirmed"]),tool("create_process_improvement","Propose a process improvement after explicit confirmation.",{title:string,problem:string,proposed_change:string,process_template_id:nullableString,confirmed:{type:"boolean"}},["title","problem","proposed_change","confirmed"]),tool("create_corrective_task","Create a corrective task for an incident after explicit confirmation.",{incident_id:string,title:string,due_date:nullableString,confirmed:{type:"boolean"}},["incident_id","title","confirmed"]),
   tool("get_team_overview","Get team overview: people, delegation inbox, ownership gaps, capacity signals, and next team action.",{}),tool("get_next_team_action","Get the single highest-priority team action.",{}),tool("list_people","List all team members, contractors, and advisors.",{}),tool("get_person","Get one person profile, responsibilities, and open delegations.",{id:string},["id"]),tool("get_person_workload","Get current commitments and delegation load for one person.",{id:string},["id"]),tool("get_delegations","Get all delegations with status and owner context.",{}),tool("get_waiting_on_team","Get delegations where the owner is waiting for a team member to act.",{}),tool("get_waiting_on_me","Get delegations where the owner must review, decide, or unblock.",{}),tool("get_ownership_gaps","Get responsibilities missing a primary owner or backup.",{}),tool("get_team_capacity","Get team commitments and conservative focus signals without fake utilization.",{}),tool("get_team_risks","Get deterministic team risks: overdue delegations, single-owner dependencies, and escalations.",{}),tool("get_team_review","Get a delegation velocity and collaboration retrospective.",{period:nullableString}),tool("prepare_one_on_one","Prepare suggested talking points and open items for a 1:1 with one person.",{person_id:string},["person_id"]),
   tool("create_person","Add a person (team member, contractor, or advisor) after explicit confirmation.",{name:string,role_title:nullableString,relationship_type:string,confirmed:{type:"boolean"}},["name","relationship_type","confirmed"]),tool("create_delegation","Delegate an outcome or task to a person after explicit confirmation.",{title:string,person_id:string,due_date:nullableString,confirmed:{type:"boolean"}},["title","person_id","confirmed"]),tool("create_responsibility","Define a responsibility with a primary owner after explicit confirmation.",{name:string,owner_person_id:string,criticality:string,confirmed:{type:"boolean"}},["name","owner_person_id","criticality","confirmed"]),tool("create_commitment","Record a commitment made by a person after explicit confirmation.",{person_id:string,statement:string,due_date:nullableString,confirmed:{type:"boolean"}},["person_id","statement","confirmed"]),tool("create_escalation","Record a team escalation after explicit confirmation.",{delegation_id:nullableString,person_id:nullableString,reason:string,severity:string,confirmed:{type:"boolean"}},["reason","severity","confirmed"]),tool("link_person_to_entity","Link a person as owner of an entity (project, client, SOP) after explicit confirmation.",{person_id:string,entity_type:string,entity_id:string,role:string,confirmed:{type:"boolean"}},["person_id","entity_type","entity_id","role","confirmed"]),tool("create_one_on_one_note","Record a 1:1 meeting note for a person after explicit confirmation.",{person_id:string,content:string,action_items:nullableString,confirmed:{type:"boolean"}},["person_id","content","confirmed"]),
   tool("get_success_overview","Get customer success overview: account health, churn risks, renewals, waiting items, and next success action.",{}),tool("get_next_success_action","Get the single highest-priority customer success action across all clients.",{}),tool("get_client_success_profile","Get complete success profile for a client including health state, commitments, renewals, and risks.",{client_id:string},["client_id"]),tool("list_client_outcomes","List documented success outcomes for clients.",{client_id:nullableString}),tool("get_client_outcome","Get details of a specific client outcome.",{id:string},["id"]),tool("list_client_success_plans","List strategic relationship success plans.",{client_id:nullableString}),tool("get_client_success_plan","Get a specific client success plan.",{id:string},["id"]),tool("list_client_commitments","List bidirectional commitments made to or by clients.",{client_id:nullableString,direction:nullableString}),tool("get_client_waiting_state","Get bidirectional client waiting queues: waiting on us vs waiting on client.",{}),tool("list_client_check_ins","List scheduled or completed client review check-ins.",{client_id:nullableString}),tool("list_client_risks","List documented client relationship and delivery risks.",{client_id:nullableString}),tool("list_client_renewals","List upcoming client contract renewals and forecasts.",{client_id:nullableString}),tool("get_retention_review","Get periodic retention review ledger and portfolio metrics.",{period:nullableString}),
   tool("create_client_outcome","Document an explicit success outcome for a client after explicit confirmation.",{client_id:string,title:string,target_date:nullableString,priority:nullableString,confirmed:{type:"boolean"}},["client_id","title","confirmed"]),tool("update_client_outcome","Update client outcome progress or status after explicit confirmation.",{id:string,status:string,notes:nullableString,confirmed:{type:"boolean"}},["id","status","confirmed"]),tool("create_client_success_plan","Create a strategic relationship plan for a client after explicit confirmation.",{client_id:string,title:string,period:string,objective:string,confirmed:{type:"boolean"}},["client_id","title","period","objective","confirmed"]),tool("create_client_commitment","Record a promise owed to or by a client after explicit confirmation.",{client_id:string,direction:string,statement:string,due_at:nullableString,confirmed:{type:"boolean"}},["client_id","direction","statement","confirmed"]),tool("create_client_check_in","Schedule a structured client check-in or review after explicit confirmation.",{client_id:string,purpose:string,check_in_type:string,scheduled_at:nullableString,confirmed:{type:"boolean"}},["client_id","purpose","check_in_type","confirmed"]),tool("record_client_satisfaction_signal","Record a factual client feedback signal after explicit confirmation.",{client_id:string,signal_type:string,summary:string,severity:nullableString,confirmed:{type:"boolean"}},["client_id","signal_type","summary","confirmed"]),tool("create_client_risk","Log a client retention or delivery risk after explicit confirmation.",{client_id:string,risk_type:string,severity:string,description:string,confirmed:{type:"boolean"}},["client_id","risk_type","severity","description","confirmed"]),tool("create_client_renewal","Record a client contract renewal event after explicit confirmation.",{client_id:string,renewal_date:string,renewal_type:string,value:{type:["number","null"]},currency:string,forecast_category:string,confirmed:{type:"boolean"}},["client_id","renewal_date","renewal_type","currency","forecast_category","confirmed"])
];
type Ctx={client:SupabaseClient;userId:string};
const searchSchema=query;const writeGuard=(confirmed:boolean)=>confirmed?null:{confirmation_required:true,message:"Ask the user to confirm this change before executing it."};
async function search(ctx:Ctx,table:string,column:string,value:string,extra="*"){let request=ctx.client.from(table).select(extra).eq("user_id",ctx.userId).is("deleted_at",null);if(value)request=request.ilike(column,`%${value.replaceAll("%","\\%")}%`);const{data,error}=await request.limit(25);if(error)throw error;return data??[]}
export async function executeAssistantTool(ctx:Ctx,name:string,raw:unknown){
 if(name==="get_fitness_progress")return getFitnessWeek(ctx.client,ctx.userId);
 if(name==="add_visa_document_requirement"){const input=z.object({visa_application_id:z.uuid(),title:z.string().trim().min(1).max(240),confirmed:z.boolean()}).strict().parse(raw);const blocked=writeGuard(input.confirmed);if(blocked)return blocked;const visa=await ctx.client.from("visa_applications").select("id").eq("id",input.visa_application_id).eq("user_id",ctx.userId).maybeSingle();if(visa.error)throw visa.error;if(!visa.data)throw new Error("Visa application is not available.");const{data,error}=await ctx.client.from("visa_requirements").insert({user_id:ctx.userId,visa_application_id:input.visa_application_id,title:input.title,completed:false}).select("*").single();if(error)throw error;return data}
 if(["get_life_overview","get_upcoming_trips","get_travel_documents","get_visa_status","get_upcoming_renewals","get_expiring_documents","get_personal_admin","get_important_dates","get_personal_goals","get_routines","get_life_attention_queue","get_next_personal_action","get_trip_readiness"].includes(name)){const trips=await ctx.client.from("trips").select("*").eq("user_id",ctx.userId).is("archived_at",null).not("status","in","(completed,canceled)").order("start_date").limit(30);if(trips.error)throw trips.error;if(name==="get_upcoming_trips")return trips.data??[];if(name==="get_trip_readiness"){const input=id.parse(raw);const trip=(trips.data??[]).find((item)=>item.id===input.id);if(!trip)return null;const[links,visas,reservations,tasks]=await Promise.all([ctx.client.from("trip_document_links").select("*,personal_documents(*)").eq("user_id",ctx.userId).eq("trip_id",input.id),ctx.client.from("visa_applications").select("status").eq("user_id",ctx.userId).eq("trip_id",input.id),ctx.client.from("travel_reservations").select("type,status").eq("user_id",ctx.userId).eq("trip_id",input.id),ctx.client.from("tasks").select("status").eq("user_id",ctx.userId).eq("trip_id",input.id).is("deleted_at",null)]);if(links.error||visas.error||reservations.error||tasks.error)throw links.error??visas.error??reservations.error??tasks.error;const {tripReadiness}=await import("@/lib/life");return{trip,readiness:tripReadiness({trip,documentLinks:(links.data??[]).map((row)=>({required:Boolean(row.required),document:row.personal_documents})),visas:visas.data??[],reservations:reservations.data??[],requiredTasks:tasks.data??[]})}}const table=name==="get_travel_documents"||name==="get_expiring_documents"?"personal_documents":name==="get_visa_status"?"visa_applications":name==="get_upcoming_renewals"?"personal_renewals":name==="get_personal_admin"?"personal_admin_items":name==="get_important_dates"?"important_dates":name==="get_routines"?"personal_routines":name==="get_personal_goals"?"goals":null;if(name==="get_life_overview"||name==="get_life_attention_queue"||name==="get_next_personal_action"){const[today,documents,renewals,admin]=await Promise.all([Promise.resolve(new Date().toISOString().slice(0,10)),ctx.client.from("personal_documents").select("*").eq("user_id",ctx.userId).is("archived_at",null),ctx.client.from("personal_renewals").select("*").eq("user_id",ctx.userId).not("status","in","(renewed,canceled)"),ctx.client.from("personal_admin_items").select("*").eq("user_id",ctx.userId).not("status","in","(completed,canceled)")]);if(documents.error||renewals.error||admin.error)throw documents.error??renewals.error??admin.error;const {documentExpiryStatus,rankLifeSignals}=await import("@/lib/life");const signals=[...(documents.data??[]).filter((row)=>["expired","expires_soon"].includes(documentExpiryStatus(row.expires_at,today))).map((row)=>({id:`document:${row.id}`,title:"Document needs attention",message:row.label,route:"/documents",priority:80,kind:"document"})),...(renewals.data??[]).filter((row)=>row.due_date&&row.due_date<=today).map((row)=>({id:`renewal:${row.id}`,title:"Renewal needs attention",message:row.title,route:"/life",priority:75,kind:"renewal"})),...(admin.data??[]).filter((row)=>row.due_date&&row.due_date<today).map((row)=>({id:`admin:${row.id}`,title:"Personal admin is overdue",message:row.title,route:"/life",priority:70,kind:"admin"}))];const attention=rankLifeSignals(signals,5);return name==="get_next_personal_action"?attention[0]??null:name==="get_life_attention_queue"?attention:{trips:trips.data??[],attention}}if(!table)throw new Error("Unknown life tool.");let request=ctx.client.from(table as "personal_documents").select("*").eq("user_id",ctx.userId).limit(50);if(["personal_documents","goals"].includes(table))request=request.is("archived_at",null);if(table==="personal_admin_items")request=request.not("status","in","(completed,canceled)");const result=await request;if(result.error)throw result.error;return result.data??[]}
 if(["create_trip","add_trip_task","add_packing_item","create_visa_application","create_personal_document","create_renewal","create_personal_admin_item","create_important_date","create_routine"].includes(name)){const confirmed=z.object({confirmed:z.boolean()}).passthrough().parse(raw).confirmed;const blocked=writeGuard(confirmed);if(blocked)return blocked;const input=z.object({confirmed:z.boolean()}).passthrough().parse(raw);let table="";let payload:Record<string,unknown>={user_id:ctx.userId};if(name==="create_trip"){const v=z.object({title:z.string().min(1).max(240),start_date:z.string().nullable(),end_date:z.string().nullable(),confirmed:z.boolean()}).parse(input);table="trips";payload={...payload,title:v.title,start_date:v.start_date,end_date:v.end_date,status:"planning"}}else if(name==="add_trip_task"){const v=z.object({trip_id:z.uuid(),title:z.string().min(1).max(240),due_date:z.string().nullable(),confirmed:z.boolean()}).parse(input);const trip=await ctx.client.from("trips").select("id").eq("id",v.trip_id).eq("user_id",ctx.userId).maybeSingle();if(trip.error)throw trip.error;if(!trip.data)throw new Error("Trip is not available.");table="tasks";payload={...payload,title:v.title,due_date:v.due_date,trip_id:v.trip_id,status:"planned",priority:"medium"}}else if(name==="add_packing_item"){const v=z.object({packing_list_id:z.uuid(),title:z.string().min(1).max(240),confirmed:z.boolean()}).parse(input);table="packing_items";payload={...payload,packing_list_id:v.packing_list_id,title:v.title}}else if(name==="create_visa_application"){const v=z.object({trip_id:z.uuid().nullable(),country:z.string().min(1).max(120),confirmed:z.boolean()}).parse(input);table="visa_applications";payload={...payload,trip_id:v.trip_id,country:v.country,status:"researching"}}else if(name==="create_personal_document"){const v=z.object({label:z.string().min(1).max(240),type:z.string().min(1),expires_at:z.string().nullable(),confirmed:z.boolean()}).parse(input);table="personal_documents";payload={...payload,label:v.label,type:v.type,expires_at:v.expires_at}}else if(name==="create_renewal"){const v=z.object({title:z.string().min(1).max(240),due_date:z.string().nullable(),confirmed:z.boolean()}).parse(input);table="personal_renewals";payload={...payload,title:v.title,due_date:v.due_date}}else if(name==="create_personal_admin_item"){const v=z.object({title:z.string().min(1).max(240),due_date:z.string().nullable(),confirmed:z.boolean()}).parse(input);table="personal_admin_items";payload={...payload,title:v.title,due_date:v.due_date}}else if(name==="create_important_date"){const v=z.object({title:z.string().min(1).max(240),date:z.string(),confirmed:z.boolean()}).parse(input);table="important_dates";payload={...payload,title:v.title,date:v.date}}else {const v=z.object({title:z.string().min(1).max(240),confirmed:z.boolean()}).parse(input);table="personal_routines";payload={...payload,title:v.title,frequency:"weekly",days:[1,2,3,4,5]}}const result=await ctx.client.from(table as "trips").insert(payload as never).select("*").single();if(result.error)throw result.error;return result.data}
 if(["get_company_health","get_commerce_summary","get_product_performance","get_low_stock_products","get_growth_funnel","get_marketing_performance","get_development_health","get_latest_deployment","get_incidents","get_ai_usage","get_roadmap_status","get_support_summary","get_founder_attention_queue","get_next_founder_action"].includes(name)){
  const company=await ctx.client.from("companies").select("id,name,currency").eq("user_id",ctx.userId).eq("active",true).maybeSingle();if(company.error)throw company.error;if(!company.data)return{state:"not_configured",message:"Set up the company before using founder tools."};const companyId=company.data.id;
  const table= name==="get_commerce_summary"?"commerce_orders":name==="get_product_performance"||name==="get_low_stock_products"?"product_catalog_refs":name==="get_growth_funnel"?"company_funnel_snapshots":name==="get_marketing_performance"?"marketing_attribution_records":name==="get_development_health"?"external_references":name==="get_latest_deployment"?"deployment_records":name==="get_incidents"?"incidents":name==="get_ai_usage"?"ai_usage_records":name==="get_roadmap_status"?"product_roadmap_items":name==="get_support_summary"?"support_cases":null;
  if(name==="get_company_health"||name==="get_founder_attention_queue"||name==="get_next_founder_action"){const [deployments,incidents,inventory]=await Promise.all([ctx.client.from("deployment_records").select("status,environment,completed_at").eq("user_id",ctx.userId).eq("company_id",companyId).order("completed_at",{ascending:false}).limit(5),ctx.client.from("incidents").select("title,severity,status").eq("user_id",ctx.userId).eq("company_id",companyId).neq("status","resolved").limit(10),ctx.client.from("inventory_snapshots").select("product_id,available_stock,reorder_level,captured_at").eq("user_id",ctx.userId).eq("company_id",companyId).order("captured_at",{ascending:false}).limit(50)]);if(deployments.error||incidents.error||inventory.error)throw deployments.error??incidents.error??inventory.error;return{company:company.data,deployments:deployments.data??[],incidents:incidents.data??[],inventory:inventory.data??[]}}
  let request=ctx.client.from(table as "commerce_orders").select("*").eq("user_id",ctx.userId).eq("company_id",companyId).limit(100);if(name==="get_development_health")request=request.eq("provider","github").eq("entity_type","repository");if(name==="get_latest_deployment")request=request.eq("environment","production").order("completed_at",{ascending:false}).limit(1);if(name==="get_incidents")request=request.neq("status","resolved");const result=await request;if(result.error)throw result.error;return result.data??[];
 }
 if(["create_roadmap_item","create_incident","create_supplier_order_draft"].includes(name)){const confirmed=z.object({confirmed:z.boolean()}).passthrough().parse(raw).confirmed;const blocked=writeGuard(confirmed);if(blocked)return blocked;const company=await ctx.client.from("companies").select("id").eq("user_id",ctx.userId).eq("active",true).maybeSingle();if(company.error)throw company.error;if(!company.data)throw new Error("Set up the company first.");if(name==="create_roadmap_item"){const input=z.object({title:z.string().min(1).max(240),confirmed:z.boolean()}).strict().parse(raw);const{data,error}=await ctx.client.from("product_roadmap_items").insert({user_id:ctx.userId,company_id:company.data.id,title:input.title,type:"feature",horizon:"later"}).select("*").single();if(error)throw error;return data}if(name==="create_incident"){const input=z.object({title:z.string().min(1).max(240),severity:z.enum(["minor","major","critical"]),confirmed:z.boolean()}).strict().parse(raw);const{data,error}=await ctx.client.from("incidents").insert({user_id:ctx.userId,company_id:company.data.id,title:input.title,severity:input.severity}).select("*").single();if(error)throw error;return data}const input=z.object({supplier_id:z.uuid(),confirmed:z.boolean()}).strict().parse(raw);const supplier=await ctx.client.from("supplier_records").select("id").eq("id",input.supplier_id).eq("user_id",ctx.userId).eq("company_id",company.data.id).maybeSingle();if(supplier.error)throw supplier.error;if(!supplier.data)throw new Error("Supplier is not available in your workspace.");const{data,error}=await ctx.client.from("supplier_orders").insert({user_id:ctx.userId,company_id:company.data.id,supplier_id:input.supplier_id,status:"draft"}).select("*").single();if(error)throw error;return data}
 if(name==="get_pipeline_summary"){const{data,error}=await ctx.client.from("opportunities").select("id,title,stage,estimated_value,currency,probability,next_action,next_action_date").eq("user_id",ctx.userId).is("archived_at",null).order("updated_at",{ascending:false});if(error)throw error;return data??[]}
 if(name==="get_opportunity"){const input=id.parse(raw);const{data,error}=await ctx.client.from("opportunities").select("*").eq("id",input.id).eq("user_id",ctx.userId).is("archived_at",null).maybeSingle();if(error)throw error;return data??null}
 if(name==="get_stale_opportunities"){const{data,error}=await ctx.client.from("opportunities").select("id,title,stage,estimated_value,currency,updated_at").eq("user_id",ctx.userId).is("archived_at",null).not("stage","in",'(won,lost)').is("next_action",null).order("updated_at");if(error)throw error;return data??[]}
 if(name==="get_proposal"){const input=id.parse(raw);const proposal=await ctx.client.from("proposals").select("*").eq("id",input.id).eq("user_id",ctx.userId).is("archived_at",null).maybeSingle();if(proposal.error)throw proposal.error;if(!proposal.data)return null;const items=await ctx.client.from("proposal_items").select("*").eq("proposal_id",input.id).eq("user_id",ctx.userId).order("position");if(items.error)throw items.error;return{...proposal.data,items:items.data??[]}}
 if(name==="get_scope_status"){const input=id.parse(raw);const project=await ctx.client.from("projects").select("id,name").eq("id",input.id).eq("user_id",ctx.userId).is("deleted_at",null).maybeSingle();if(project.error)throw project.error;if(!project.data)return null;const[scope,changes]=await Promise.all([ctx.client.from("scope_items").select("*").eq("project_id",input.id).eq("user_id",ctx.userId),ctx.client.from("scope_change_requests").select("*").eq("project_id",input.id).eq("user_id",ctx.userId)]);if(scope.error||changes.error)throw scope.error??changes.error;return{project:project.data,scope:scope.data??[],changes:changes.data??[]}}
 if(name==="get_pricing_history") {
  const input=id.parse(raw); const service=await ctx.client.from("services").select("id,name").eq("id",input.id).eq("user_id",ctx.userId).is("archived_at",null).maybeSingle();
  if(service.error) throw service.error; if(!service.data) return null;
  const {data,error}=await ctx.client.from("scope_items").select("agreed_value,estimated_hours,status").eq("service_id",input.id).eq("user_id",ctx.userId); if(error) throw error;
  return { service: service.data, history: pricingHistory((data??[]).map((row) => ({ amount:row.agreed_value, trackedSeconds:row.estimated_hours == null ? null : Number(row.estimated_hours) * 3600, status: row.status === "delivered" ? "accepted" : "" }))) };
 }
 if(name==="get_revenue_forecast"){const[invoices,payments,opportunities,proposals]=await Promise.all([ctx.client.from("invoices").select("total_amount,amount_remaining,currency,status").eq("user_id",ctx.userId).is("deleted_at",null),ctx.client.from("payments").select("amount,currency").eq("user_id",ctx.userId).is("deleted_at",null),ctx.client.from("opportunities").select("estimated_value,currency,stage,probability").eq("user_id",ctx.userId).is("archived_at",null),ctx.client.from("proposals").select("total,currency,status").eq("user_id",ctx.userId).is("archived_at",null)]);const failure=[invoices,payments,opportunities,proposals].find((result)=>result.error);if(failure?.error)throw failure.error;return groupedRevenueForecast({invoices:invoices.data??[],payments:payments.data??[],opportunities:(opportunities.data??[]) as never,proposals:proposals.data??[]})}
 if(name==="create_lead"){const input=z.object({name:z.string().min(1).max(240),company:z.string().nullable(),email:z.string().email().nullable(),confirmed:z.boolean()}).strict().parse(raw);const blocked=writeGuard(input.confirmed);if(blocked)return blocked;const{data,error}=await ctx.client.from("leads").insert({user_id:ctx.userId,name:input.name,company:input.company,email:input.email,source:"other",status:"new"} as never).select("*").single();if(error)throw error;return data}
 if(name==="create_opportunity"){const input=z.object({title:z.string().min(1).max(240),client_id:z.uuid().nullable(),estimated_value:z.number().nonnegative().nullable(),currency:z.string().length(3),confirmed:z.boolean()}).strict().parse(raw);const blocked=writeGuard(input.confirmed);if(blocked)return blocked;if(input.client_id){const client=await ctx.client.from("clients").select("id").eq("id",input.client_id).eq("user_id",ctx.userId).is("deleted_at",null).maybeSingle();if(client.error)throw client.error;if(!client.data)throw new Error("Client is not available in your workspace.")}const{data,error}=await ctx.client.from("opportunities").insert({user_id:ctx.userId,title:input.title,client_id:input.client_id,estimated_value:input.estimated_value,currency:input.currency.toUpperCase(),stage:"new"} as never).select("*").single();if(error)throw error;return data}
 if(name==="update_opportunity_stage"){const input=z.object({id:z.uuid(),stage:z.enum(["new","qualified","meeting","proposal","negotiation","won","lost"]),confirmed:z.boolean()}).strict().parse(raw);const blocked=writeGuard(input.confirmed);if(blocked)return blocked;const{data,error}=await ctx.client.from("opportunities").update({stage:input.stage} as never).eq("id",input.id).eq("user_id",ctx.userId).select("*").maybeSingle();if(error)throw error;if(!data)throw new Error("Opportunity is unavailable.");return data}
 if(name==="create_scope_change"){const input=z.object({project_id:z.uuid(),title:z.string().min(1).max(240),description:z.string().min(1).max(5000),estimated_value:z.number().nonnegative().nullable(),currency:z.string().length(3),confirmed:z.boolean()}).strict().parse(raw);const blocked=writeGuard(input.confirmed);if(blocked)return blocked;const project=await ctx.client.from("projects").select("id").eq("id",input.project_id).eq("user_id",ctx.userId).is("deleted_at",null).maybeSingle();if(project.error)throw project.error;if(!project.data)throw new Error("Project is not available in your workspace.");const{data,error}=await ctx.client.from("scope_change_requests").insert({user_id:ctx.userId,project_id:input.project_id,title:input.title,description:input.description,estimated_value:input.estimated_value,currency:input.currency.toUpperCase(),status:"proposed"} as never).select("*").single();if(error)throw error;return data}
 if(name==="send_email"){const input=z.object({to:z.string().email(),subject:z.string().min(1).max(998),body:z.string().min(1).max(10000),threadId:z.string().nullable(),confirmed:z.boolean()}).parse(raw);const blocked=writeGuard(input.confirmed);if(blocked)return blocked;const{data,error}=await ctx.client.from("approval_items").insert({user_id:ctx.userId,action_type:"send_email",title:`Send: ${input.subject}`,summary:"Review and explicitly send this exact Gmail message.",payload:input,risk_level:"high"}).select("*").single();if(error)throw error;return{approval_required:true,item:data}}
 if(["accept_daily_plan","snooze_insight","dismiss_insight"].includes(name)){const preview=z.object({confirmed:z.boolean()}).passthrough().parse(raw);const blocked=writeGuard(preview.confirmed);if(blocked)return blocked}
 if(name==="search_tasks"){const input=searchSchema.parse(raw);return search(ctx,"tasks","title",input.query)}if(name==="search_projects"){const input=searchSchema.parse(raw);return search(ctx,"projects","name",input.query)}if(name==="search_notes"){const input=searchSchema.parse(raw);return search(ctx,"notes","title",input.query)}if(name==="search_clients"){const input=searchSchema.parse(raw);return search(ctx,"clients","name",input.query)}if(name==="search_decisions"){const input=searchSchema.parse(raw);return search(ctx,"decisions","title",input.query)}
 if(name==="get_waiting_items")return search(ctx,"waiting_items","title","");if(name==="get_goals")return search(ctx,"goals","title","");
 if(name==="get_project"){const input=id.parse(raw);const project=await ctx.client.from("projects").select("*,clients(name),goals(title)").eq("id",input.id).eq("user_id",ctx.userId).maybeSingle();if(project.error)throw project.error;if(!project.data)return null;const[tasks,notes,decisions,waiting]=await Promise.all(["tasks","notes","decisions","waiting_items"].map((table)=>ctx.client.from(table).select("*").eq("user_id",ctx.userId).eq("project_id",input.id).limit(50)));return{project:project.data,tasks:tasks.data??[],notes:notes.data??[],decisions:decisions.data??[],waiting:waiting.data??[]}}
 if(name==="get_calendar"){const input=z.object({start:z.iso.datetime({offset:true}),end:z.iso.datetime({offset:true})}).strict().parse(raw);const{data,error}=await ctx.client.from("calendar_events").select("*").eq("user_id",ctx.userId).gte("starts_at",input.start).lte("starts_at",input.end).is("deleted_at",null).order("starts_at");if(error)throw error;return data??[]}
 if(name==="create_task"){const input=z.object({title:z.string().min(1).max(240),due_date:z.iso.date().nullable(),project_id:z.uuid().nullable(),confirmed:z.boolean()}).strict().parse(raw);const blocked=writeGuard(input.confirmed);if(blocked)return blocked;return createRecord(ctx.client,ctx.userId,"tasks",{title:input.title,due_date:input.due_date,project_id:input.project_id,status:"inbox",priority:"none",created_by:"ai"})}
 if(name==="create_note"){const input=z.object({title:z.string().min(1).max(240),content:z.string().max(20000),project_id:z.uuid().nullable(),confirmed:z.boolean()}).strict().parse(raw);const blocked=writeGuard(input.confirmed);if(blocked)return blocked;return createRecord(ctx.client,ctx.userId,"notes",{title:input.title,content:input.content,project_id:input.project_id,category:"note",created_by:"ai"})}
 if(name==="create_followup"){const input=z.object({title:z.string().min(1).max(240),client_id:z.uuid().nullable(),due_at:z.iso.datetime({offset:true}).nullable(),confirmed:z.boolean()}).strict().parse(raw);const blocked=writeGuard(input.confirmed);if(blocked)return blocked;return createRecord(ctx.client,ctx.userId,"followups",{title:input.title,client_id:input.client_id,due_at:input.due_at,status:"open"})}
 if(name==="update_task"){const input=z.object({id:z.uuid(),title:z.string().min(1).max(240).nullable(),status:z.enum(["inbox","planned","in_progress","waiting","blocked","completed","cancelled"]).nullable(),due_date:z.iso.date().nullable(),confirmed:z.boolean()}).strict().parse(raw);const blocked=writeGuard(input.confirmed);if(blocked)return blocked;const changes=Object.fromEntries(Object.entries(input).filter(([key,value])=>key!=="id"&&key!=="confirmed"&&value!==null));return updateRecord(ctx.client,ctx.userId,"tasks",input.id,changes)}
 if(name==="complete_task"){const input=z.object({id:z.uuid(),confirmed:z.boolean()}).strict().parse(raw);const blocked=writeGuard(input.confirmed);if(blocked)return blocked;return updateRecord(ctx.client,ctx.userId,"tasks",input.id,{status:"completed",completed_at:new Date().toISOString()})}
 if(name==="create_calendar_event"){const input=z.object({title:z.string().min(1).max(240),starts_at:z.iso.datetime({offset:true}),ends_at:z.iso.datetime({offset:true}),timezone:z.string().min(1).max(120),confirmed:z.boolean()}).strict().parse(raw);const blocked=writeGuard(input.confirmed);if(blocked)return blocked;let event=await createRecord(ctx.client,ctx.userId,"calendar",{title:input.title,starts_at:input.starts_at,ends_at:input.ends_at,timezone:input.timezone,all_day:false,status:"confirmed"});event=await pushGoogleEvent(ctx.client,ctx.userId,event);return event}
 if(name==="get_finance_summary")return getFinanceSummary(ctx.client,ctx.userId);if(name==="search_invoices"){const input=query.parse(raw);return search(ctx,"invoices","title",input.query)}if(name==="search_expenses"){const input=query.parse(raw);return search(ctx,"expenses","description",input.query)}
 if(name==="create_invoice"){const input=z.object({title:z.string().min(1).max(240),client_id:z.uuid().nullable(),project_id:z.uuid().nullable(),subtotal:z.number().nonnegative(),tax_amount:z.number().nonnegative(),discount_amount:z.number().nonnegative(),currency:z.string().length(3),due_date:z.iso.date().nullable(),confirmed:z.boolean()}).strict().parse(raw);const blocked=writeGuard(input.confirmed);if(blocked)return blocked;const{confirmed,...values}=input;void confirmed;return createRecord(ctx.client,ctx.userId,"invoices",{...values,status:"draft",issue_date:new Date().toISOString().slice(0,10)})}
 if(name==="record_payment"){const input=z.object({invoice_id:z.uuid(),amount:z.number().positive(),payment_date:z.iso.date(),confirmed:z.boolean()}).strict().parse(raw);const blocked=writeGuard(input.confirmed);if(blocked)return blocked;const{data,error}=await ctx.client.rpc("record_invoice_payment",{payment_invoice_id:input.invoice_id,payment_amount:input.amount,payment_date_value:input.payment_date});if(error)throw error;return data}
 if(name==="search_content"){const input=query.parse(raw);return search(ctx,"content_items","title",input.query)}if(name==="get_content_pipeline")return getContentSummary(ctx.client,ctx.userId);
 if(name==="create_content_item"){const input=z.object({title:z.string().min(1).max(240),status:z.enum(["idea","brief","copy","designing","review","approved","scheduled","published","archived"]),client_id:z.uuid().nullable(),project_id:z.uuid().nullable(),due_date:z.iso.date().nullable(),confirmed:z.boolean()}).strict().parse(raw);const blocked=writeGuard(input.confirmed);if(blocked)return blocked;const{confirmed,...values}=input;void confirmed;return createRecord(ctx.client,ctx.userId,"content",values)}
 if(name==="update_content_status"){const input=z.object({id:z.uuid(),status:z.enum(["idea","brief","copy","designing","review","approved","scheduled","published","archived"]),confirmed:z.boolean()}).strict().parse(raw);const blocked=writeGuard(input.confirmed);if(blocked)return blocked;return updateRecord(ctx.client,ctx.userId,"content",input.id,{status:input.status,published_at:input.status==="published"?new Date().toISOString():undefined})}
 if(name==="search_prompts"){const input=query.parse(raw);return search(ctx,"prompts","title",input.query)}if(name==="get_prompt"){const input=id.parse(raw);const{data,error}=await ctx.client.from("prompts").select("*").eq("id",input.id).eq("user_id",ctx.userId).is("deleted_at",null).maybeSingle();if(error)throw error;return data}if(name==="render_prompt_with_variables"){const input=z.object({id:z.uuid(),variables:z.record(z.string(),z.string())}).strict().parse(raw);const{data,error}=await ctx.client.from("prompts").select("prompt_text,prompt,usage_count").eq("id",input.id).eq("user_id",ctx.userId).is("deleted_at",null).maybeSingle();if(error)throw error;if(!data)return null;const rendered=renderPrompt(String(data.prompt_text??data.prompt),input.variables);if(rendered.missing.length)return{error:"Missing variables",missing:rendered.missing};await ctx.client.from("prompts").update({usage_count:Number(data.usage_count??0)+1,last_used_at:new Date().toISOString()}).eq("id",input.id).eq("user_id",ctx.userId);return rendered}
 if(name==="create_decision"){const input=z.object({title:z.string().min(1).max(240),decision:z.string().min(1).max(10000),project_id:z.uuid().nullable(),impact:z.enum(["low","medium","high","critical"]),confidence:z.enum(["low","medium","high"]),review_date:z.iso.date().nullable(),confirmed:z.boolean()}).strict().parse(raw);const blocked=writeGuard(input.confirmed);if(blocked)return blocked;const{confirmed,...values}=input;void confirmed;return createRecord(ctx.client,ctx.userId,"decisions",{...values,status:"active",decision_date:new Date().toISOString().slice(0,10)})}if(name==="get_decisions_due_for_review"){const end=new Date(Date.now()+7*86400000).toISOString().slice(0,10);const{data,error}=await ctx.client.from("decisions").select("*").eq("user_id",ctx.userId).is("deleted_at",null).in("status",["active","review_due"]).lte("review_date",end);if(error)throw error;return data??[]}
 if(name==="get_fitness_week")return getFitnessWeek(ctx.client,ctx.userId);if(name==="get_fitness_targets")return search(ctx,"fitness_targets","activity_type","");if(name==="log_fitness_activity"){const input=z.object({activity_type:z.enum(["Running","Gym","Walking","Swimming","Hiking","Cycling","Other"]),date:z.iso.date(),duration_minutes:z.number().int().positive().nullable(),distance_km:z.number().nonnegative().nullable(),confirmed:z.boolean()}).strict().parse(raw);const blocked=writeGuard(input.confirmed);if(blocked)return blocked;const{confirmed,...values}=input;void confirmed;return createRecord(ctx.client,ctx.userId,"fitness",{...values,source:"ai"})}
 if(["get_next_best_action","get_attention_queue","get_project_health","get_client_health","get_financial_risks","get_content_risks","get_weekly_review","generate_daily_plan","get_available_focus_windows","get_meeting_brief","get_patterns","accept_daily_plan","snooze_insight","dismiss_insight"].includes(name)){const{snapshot,overview}=await getIntelligence(ctx.client,ctx.userId);if(name==="get_next_best_action")return overview.recommendations[0]??null;if(name==="get_attention_queue")return overview.attentionQueue;if(name==="get_project_health"){const input=id.parse(raw);return overview.projectHealth.find((item)=>item.entityId===input.id)??null}if(name==="get_client_health"){const input=id.parse(raw);return overview.clientHealth.find((item)=>item.entityId===input.id)??null}if(name==="get_financial_risks")return{summary:overview.finance,risks:overview.risks.filter((item)=>item.entityType==="invoice"||item.entityType==="client")};if(name==="get_content_risks")return{summary:overview.content,risks:overview.risks.filter((item)=>item.entityType==="content"||item.entityType==="campaign")};if(name==="get_weekly_review")return buildWeeklyReview(snapshot,overview);if(name==="generate_daily_plan")return generateDailyPlan(snapshot,overview.recommendations);if(name==="get_available_focus_windows")return{windows:overview.focusWindows,capacity:overview.capacity};if(name==="get_meeting_brief"){const input=id.parse(raw);return buildMeetingBrief(snapshot,input.id)}if(name==="get_patterns")return{patterns:overview.patterns,predictions:overview.predictions};if(name==="accept_daily_plan"){const input=z.object({task_ids:z.array(z.uuid()).max(3),confirmed:z.boolean()}).strict().parse(raw);const blocked=writeGuard(input.confirmed);if(blocked)return blocked;const available=new Set(overview.recommendations.filter((item)=>item.entityType==="task").map((item)=>item.entityId));if(input.task_ids.some((taskId)=>!available.has(taskId)))throw new Error("A selected task is no longer available.");const plan=generateDailyPlan(snapshot,overview.recommendations);const{data,error}=await ctx.client.rpc("accept_daily_plan",{plan_date_value:snapshot.today,plan_payload:{...plan,wins:plan.wins.filter((item)=>input.task_ids.includes(item.entityId))},priority_task_ids:input.task_ids} as never);if(error)throw error;return data}if(name==="snooze_insight"||name==="dismiss_insight"){const input=z.object({insight_key:z.string().min(1).max(300),insight_type:z.string().min(1).max(120),hours:name==="snooze_insight"?z.number().int().min(1).max(720):z.number().optional(),confirmed:z.boolean()}).strict().parse(raw);const blocked=writeGuard(input.confirmed);if(blocked)return blocked;const{data,error}=await ctx.client.from("insight_feedback").insert({user_id:ctx.userId,insight_key:input.insight_key,insight_type:input.insight_type,action:name==="snooze_insight"?"snoozed":"dismissed",snoozed_until:name==="snooze_insight"?new Date(Date.now()+(input.hours??24)*3600000).toISOString():null} as never).select("*").single();if(error)throw error;return data}}
 if(name==="search_memory"){const input=query.parse(raw);let request=ctx.client.from("memory_items").select("*").eq("user_id",ctx.userId).is("archived_at",null);if(input.query)request=request.or(`title.ilike.%${input.query.replaceAll("%","\\%")}%,summary.ilike.%${input.query.replaceAll("%","\\%")}%`);const{data,error}=await request.limit(25);if(error)throw error;return data??[]}
 if(name==="get_communication_queue"){const[threads,followups,waiting]=await Promise.all([ctx.client.from("email_threads").select("*").eq("user_id",ctx.userId).limit(30),ctx.client.from("followups").select("*").eq("user_id",ctx.userId).eq("status","open"),ctx.client.from("waiting_items").select("*").eq("user_id",ctx.userId).eq("status","waiting")]);return{threads:threads.data??[],followups:followups.data??[],waiting:waiting.data??[]}}if(name==="get_approval_queue"){const{data,error}=await ctx.client.from("approval_items").select("*").eq("user_id",ctx.userId).eq("status","pending");if(error)throw error;return data??[]}if(name==="get_automation_status"){const{data,error}=await ctx.client.from("automations").select("*").eq("user_id",ctx.userId);if(error)throw error;return data??[]}if(name==="draft_email_reply"){const input=z.object({thread_id:z.uuid(),style:z.string().max(40)}).parse(raw);const{data,error}=await ctx.client.from("email_threads").select("subject").eq("id",input.thread_id).eq("user_id",ctx.userId).maybeSingle();if(error)throw error;return data?{draft:`Hi,\n\nThanks for your message about ${data.subject}. I’ll review this and come back to you shortly.\n\nBest,`,style:input.style,requires_confirmation_before_send:true}:null}if(name==="draft_invoice_reminder"){const input=z.object({invoice_id:z.uuid(),style:z.string().max(40)}).parse(raw);const{data,error}=await ctx.client.from("invoices").select("invoice_number,total_amount,currency,due_date,clients(name)").eq("id",input.invoice_id).eq("user_id",ctx.userId).maybeSingle();if(error)throw error;if(!data)return null;return{draft:`Hi ${String((data.clients as {name?:string}|null)?.name??"")},\n\nA reminder that invoice ${data.invoice_number??""} for ${data.total_amount} ${data.currency} was due on ${data.due_date}.\n\nBest,`,style:input.style,requires_confirmation_before_send:true}}
 if(["get_productivity_summary","get_business_summary","get_project_summary","get_content_summary","get_fitness_summary"].includes(name)){const summary=await getAnalyticsSummary(ctx.client,ctx.userId);return name==="get_productivity_summary"?summary.productivity:name==="get_business_summary"?summary.business:name==="get_project_summary"?summary.projects:name==="get_content_summary"?summary.content:summary.fitness}if(name==="get_today_insights")return getTodayInsights(ctx.client,ctx.userId);
 if(["get_control_tower","get_current_commitments","get_capacity","get_portfolio","get_strategic_risks","get_next_strategic_move","get_upcoming_milestones","get_blocked_dependencies","get_decision_gates","get_30_60_90_plan","get_weekly_plan","get_monthly_plan","get_quarterly_plan","get_scenarios","get_slippage_signals"].includes(name)){const[periods,commitments,milestones,dependencies,gates,scenarios]=await Promise.all([ctx.client.from("planning_periods").select("*").eq("user_id",ctx.userId),ctx.client.from("strategic_commitments").select("*").eq("user_id",ctx.userId),ctx.client.from("strategic_milestones").select("*").eq("user_id",ctx.userId),ctx.client.from("strategic_dependencies").select("*").eq("user_id",ctx.userId),ctx.client.from("decision_gates").select("*").eq("user_id",ctx.userId),ctx.client.from("strategic_scenarios").select("*").eq("user_id",ctx.userId)]);const results=[periods,commitments,milestones,dependencies,gates,scenarios];const failure=results.find(result=>result.error);if(failure?.error)throw failure.error;const active=(commitments.data??[]).filter(row=>!["completed","dropped"].includes(row.status));const payload={periods:periods.data??[],commitments:active,milestones:milestones.data??[],dependencies:dependencies.data??[],gates:gates.data??[],scenarios:scenarios.data??[]};if(name==="get_current_commitments")return active;if(name==="get_upcoming_milestones")return payload.milestones.filter(row=>!["reached","canceled"].includes(row.status));if(name==="get_blocked_dependencies")return payload.dependencies.filter(row=>row.status==="blocked");if(name==="get_decision_gates")return payload.gates.filter(row=>row.status==="open");if(name==="get_scenarios")return payload.scenarios;if(name==="get_weekly_plan"||name==="get_monthly_plan"||name==="get_quarterly_plan")return payload.periods.filter(row=>row.type===name.replace("get_","").replace("_plan","")&&row.status==="active");return payload}
 if(["create_commitment","create_milestone","create_planning_period","create_scenario","create_decision_gate"].includes(name)){const input=z.object({confirmed:z.boolean()}).passthrough().parse(raw);const blocked=writeGuard(input.confirmed);if(blocked)return blocked;if(name==="create_commitment"){const values=z.object({planning_period_id:z.uuid(),title:z.string().min(1).max(240),confirmed:z.boolean()}).parse(input);return createRecord(ctx.client,ctx.userId,"strategic_commitments",{planning_period_id:values.planning_period_id,title:values.title,status:"planned",priority:3})}if(name==="create_milestone"){const values=z.object({title:z.string().min(1).max(240),confirmed:z.boolean()}).parse(input);return createRecord(ctx.client,ctx.userId,"strategic_milestones",{title:values.title,status:"upcoming"})}if(name==="create_planning_period"){const values=z.object({title:z.string().min(1).max(240),type:z.enum(["week","month","quarter","custom"]),starts_at:z.iso.date(),ends_at:z.iso.date(),confirmed:z.boolean()}).parse(input);if(values.ends_at<values.starts_at)throw new Error("End date must not be before start date.");return createRecord(ctx.client,ctx.userId,"planning_periods",{...values,status:"draft"})}if(name==="create_scenario"){const values=z.object({title:z.string().min(1).max(240),confirmed:z.boolean()}).parse(input);return createRecord(ctx.client,ctx.userId,"strategic_scenarios",{title:values.title,assumptions:[],impact_summary:{}})}const values=z.object({title:z.string().min(1).max(240),confirmed:z.boolean()}).parse(input);return createRecord(ctx.client,ctx.userId,"decision_gates",{title:values.title,status:"open"})}
 if(name==="search_knowledge_topics"){const input=query.parse(raw);let req=ctx.client.from("research_topics").select("*").eq("user_id",ctx.userId);if(input.query)req=req.ilike("title",`%${input.query.replaceAll("%","\\%")}%`);const{data,error}=await req.limit(25);if(error)throw error;return data??[]}
 if(name==="get_knowledge_topic"){const input=id.parse(raw);const topic=await ctx.client.from("research_topics").select("*").eq("id",input.id).eq("user_id",ctx.userId).maybeSingle();if(topic.error)throw topic.error;if(!topic.data)return null;const[findings,questions,relations]=await Promise.all([ctx.client.from("research_findings").select("*").eq("topic_id",input.id).eq("user_id",ctx.userId),ctx.client.from("research_questions").select("*").eq("topic_id",input.id).eq("user_id",ctx.userId),ctx.client.from("knowledge_relations").select("*,to_id,from_id").eq("user_id",ctx.userId).or(`from_id.eq.${input.id},to_id.eq.${input.id}`)]);if(findings.error||questions.error||relations.error)throw findings.error??questions.error??relations.error;return{topic:topic.data,findings:findings.data??[],questions:questions.data??[],relations:relations.data??[]}}
 if(name==="search_knowledge_findings"){const input=query.parse(raw);let req=ctx.client.from("research_findings").select("*").eq("user_id",ctx.userId);if(input.query)req=req.or(`title.ilike.%${input.query.replaceAll("%","\\%")}%,summary.ilike.%${input.query.replaceAll("%","\\%")}%`);const{data,error}=await req.limit(25);if(error)throw error;return data??[]}
 if(name==="get_knowledge_overview"){const today=new Date().toISOString().slice(0,10);const[topics,questions,findings,sources,watches]=await Promise.all([ctx.client.from("research_topics").select("*").eq("user_id",ctx.userId).neq("status","archived").limit(20),ctx.client.from("research_questions").select("*").eq("user_id",ctx.userId).eq("status","open").limit(20),ctx.client.from("research_findings").select("*").eq("user_id",ctx.userId).order("created_at",{ascending:false}).limit(10),ctx.client.from("knowledge_sources").select("*").eq("user_id",ctx.userId).not("freshness_expires_at","is",null).lt("freshness_expires_at",today).limit(10),ctx.client.from("watch_entities").select("*").eq("user_id",ctx.userId).eq("status","active").limit(10)]);const failure=[topics,questions,findings,sources,watches].find(r=>r.error);if(failure?.error)throw failure.error;return{topics:topics.data??[],questions:questions.data??[],findings:findings.data??[],staleSources:sources.data??[],watches:watches.data??[]}}
 if(name==="create_research_topic"){const input=z.object({title:z.string().min(1).max(240),domain:z.string().nullable().optional(),priority:z.string().nullable().optional(),confirmed:z.boolean()}).strict().parse(raw);const blocked=writeGuard(input.confirmed);if(blocked)return blocked;const{data,error}=await ctx.client.from("research_topics").insert({user_id:ctx.userId,title:input.title,domain:input.domain??"other",priority:input.priority??"medium",status:"active"} as never).select("*").single();if(error)throw error;return data}
 if(name==="create_research_finding"){const input=z.object({topic_id:z.uuid(),title:z.string().min(1).max(400),summary:z.string().max(20000).default(""),confirmed:z.boolean()}).strict().parse(raw);const blocked=writeGuard(input.confirmed);if(blocked)return blocked;const topic=await ctx.client.from("research_topics").select("id").eq("id",input.topic_id).eq("user_id",ctx.userId).maybeSingle();if(topic.error)throw topic.error;if(!topic.data)throw new Error("Topic is not available in your workspace.");const{data,error}=await ctx.client.from("research_findings").insert({user_id:ctx.userId,topic_id:input.topic_id,title:input.title,summary:input.summary,status:"draft"} as never).select("*").single();if(error)throw error;return data}
 if(name==="create_research_question"){const input=z.object({topic_id:z.uuid(),question:z.string().min(1).max(1000),priority:z.string().nullable().optional(),confirmed:z.boolean()}).strict().parse(raw);const blocked=writeGuard(input.confirmed);if(blocked)return blocked;const topic=await ctx.client.from("research_topics").select("id").eq("id",input.topic_id).eq("user_id",ctx.userId).maybeSingle();if(topic.error)throw topic.error;if(!topic.data)throw new Error("Topic is not available in your workspace.");const{data,error}=await ctx.client.from("research_questions").insert({user_id:ctx.userId,topic_id:input.topic_id,question:input.question,priority:input.priority??"medium",status:"open"} as never).select("*").single();if(error)throw error;return data}
  if(name==="get_growth_overview"){
    const today = new Date().toISOString().slice(0, 10);
    const [opps, leads, proposals, experiments] = await Promise.all([
      ctx.client.from("opportunities").select("id,title,stage,estimated_value,currency,next_action,updated_at").eq("user_id", ctx.userId).is("archived_at", null),
      ctx.client.from("leads").select("id,name,company,status,source,potential_value,currency,last_contact_at,next_follow_up_at,created_at,updated_at").eq("user_id", ctx.userId).is("archived_at", null),
      ctx.client.from("proposals").select("id,opportunity_id,title,status,total,valid_until,currency").eq("user_id", ctx.userId).is("archived_at", null),
      ctx.client.from("growth_experiments").select("*").eq("user_id", ctx.userId).eq("status", "running"),
    ]);
    const { rankNextGrowthMove, evaluatePipelineQuality } = await import("@/lib/growth");
    return {
      nextMove: rankNextGrowthMove(opps.data ?? [], leads.data ?? [], proposals.data ?? [], today),
      pipeline: evaluatePipelineQuality(opps.data ?? [], today),
      activeExperiments: experiments.data ?? [],
    };
  }
  if(name==="get_growth_experiments"){
    const { data, error } = await ctx.client.from("growth_experiments").select("*").eq("user_id", ctx.userId).order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  }
  if(name==="get_expansion_candidates"||name==="get_lead_reactivations"){
    const today = new Date().toISOString().slice(0, 10);
    const [clients, projects, invoices, services, leads, opps] = await Promise.all([
      ctx.client.from("clients").select("id,name,status,last_contact_at,updated_at").eq("user_id", ctx.userId).is("deleted_at", null),
      ctx.client.from("projects").select("id,client_id,name,status,updated_at").eq("user_id", ctx.userId).is("deleted_at", null),
      ctx.client.from("invoices").select("id,client_id,total_amount,currency,status,paid_at,updated_at").eq("user_id", ctx.userId).is("deleted_at", null),
      ctx.client.from("services").select("id,name").eq("user_id", ctx.userId).is("archived_at", null),
      ctx.client.from("leads").select("id,name,company,status,potential_value,currency,last_contact_at,notes").eq("user_id", ctx.userId).is("archived_at", null),
      ctx.client.from("opportunities").select("id,lead_id,lost_reason,stage").eq("user_id", ctx.userId).is("archived_at", null),
    ]);
    const { identifyExpansionCandidates, identifyLeadReactivations } = await import("@/lib/growth");
    if (name === "get_expansion_candidates") {
      return identifyExpansionCandidates(clients.data ?? [], projects.data ?? [], invoices.data ?? [], (services.data ?? []).map(s => ({ client_id: "", service_name: s.name })), today);
    }
    return identifyLeadReactivations(leads.data ?? [], opps.data ?? [], today);
  }
  if(name==="create_growth_experiment"){
    const input = z.object({ name: z.string().min(1).max(240), hypothesis: z.string().min(1).max(2000), target_metric: z.string().min(1).max(240), channel: z.string().nullable().optional(), confirmed: z.boolean() }).strict().parse(raw);
    const blocked = writeGuard(input.confirmed);
    if (blocked) return blocked;
    const { data, error } = await ctx.client.from("growth_experiments").insert({ user_id: ctx.userId, name: input.name, hypothesis: input.hypothesis, target_metric: input.target_metric, channel: input.channel ?? null, status: "idea" } as never).select("*").single();
    if (error) throw error;
    return data;
  }
  if(name==="create_sales_playbook"){
    const input = z.object({ name: z.string().min(1).max(240), purpose: z.string().nullable().optional(), target_type: z.enum(["lead", "opportunity", "client"]), confirmed: z.boolean() }).strict().parse(raw);
    const blocked = writeGuard(input.confirmed);
    if (blocked) return blocked;
    const { data, error } = await ctx.client.from("sales_playbooks").insert({ user_id: ctx.userId, name: input.name, purpose: input.purpose ?? null, target_type: input.target_type, steps: [], default_delays: [], status: "active" } as never).select("*").single();
    if (error) throw error;
    return data;
  }
  if(name==="create_sales_target"){
    const input = z.object({ metric_type: z.enum(["monthly_revenue", "new_leads", "qualified_leads", "proposals_sent", "deals_won", "new_clients", "expansion_revenue", "pipeline_generated"]), target_value: z.number().nonnegative(), period: z.enum(["week", "month", "quarter", "year"]), period_start: z.iso.date(), period_end: z.iso.date(), confirmed: z.boolean() }).strict().parse(raw);
    const blocked = writeGuard(input.confirmed);
    if (blocked) return blocked;
    const { data, error } = await ctx.client.from("sales_targets").insert({ user_id: ctx.userId, metric_type: input.metric_type, target_value: input.target_value, current_value: 0, period: input.period, period_start: input.period_start, period_end: input.period_end, currency: "MAD" } as never).select("*").single();
    if (error) throw error;
    return data;
  }
  if(name==="record_deal_review"){
    const input = z.object({ opportunity_id: z.uuid(), review_type: z.enum(["lost", "won"]), reason: z.string().nullable().optional(), why_we_won: z.string().nullable().optional(), lessons: z.string().nullable().optional(), confirmed: z.boolean() }).strict().parse(raw);
    const blocked = writeGuard(input.confirmed);
    if (blocked) return blocked;
    const opp = await ctx.client.from("opportunities").select("id").eq("id", input.opportunity_id).eq("user_id", ctx.userId).maybeSingle();
    if (opp.error) throw opp.error;
    if (!opp.data) throw new Error("Opportunity is not available.");
    const { data, error } = await ctx.client.from("deal_reviews").upsert({ user_id: ctx.userId, opportunity_id: input.opportunity_id, review_type: input.review_type, reason: input.reason ?? null, why_we_won: input.why_we_won ?? null, lessons: input.lessons ?? null, review_date: new Date().toISOString().slice(0, 10) } as never, { onConflict: "user_id,opportunity_id,review_type" }).select("*").single();
    if (error) throw error;
    return data;
  }
  if(name==="get_operations_overview" || name==="get_next_operational_move"){
    const [runs, sops, incidents, blockers] = await Promise.all([
      ctx.client.from("process_runs").select("*,process_templates(name,criticality)").eq("user_id", ctx.userId).order("created_at", { ascending: false }).limit(25),
      ctx.client.from("operational_sops").select("*").eq("user_id", ctx.userId).neq("status", "archived").limit(50),
      ctx.client.from("quality_incidents").select("*").eq("user_id", ctx.userId).neq("status", "resolved").limit(20),
      ctx.client.from("operational_blockers").select("*,process_runs(title,priority)").eq("user_id", ctx.userId).is("resolved_at", null).limit(20),
    ]);
    const { rankNextOperationalMove } = await import("@/lib/operations");
    const nextMove = rankNextOperationalMove(runs.data ?? [], sops.data ?? [], incidents.data ?? [], blockers.data ?? []);
    if(name==="get_next_operational_move") return nextMove;
    return {
      nextMove,
      activeRuns: (runs.data ?? []).filter(r => ["planned", "ready", "in_progress"].includes(r.status)),
      blockedRuns: blockers.data ?? [],
      openIncidents: incidents.data ?? [],
      sopsNeedingReview: (sops.data ?? []).filter(s => s.next_review_at && s.next_review_at <= new Date().toISOString().slice(0, 10)),
    };
  }
  if(name==="get_sop"){
    const input = id.parse(raw);
    const [sop, steps, checklist, versions] = await Promise.all([
      ctx.client.from("operational_sops").select("*").eq("id", input.id).eq("user_id", ctx.userId).maybeSingle(),
      ctx.client.from("sop_steps").select("*").eq("sop_id", input.id).eq("user_id", ctx.userId).order("position"),
      ctx.client.from("sop_checklist_items").select("*").eq("sop_id", input.id).eq("user_id", ctx.userId).order("position"),
      ctx.client.from("sop_versions").select("*").eq("sop_id", input.id).eq("user_id", ctx.userId).order("version_number", { ascending: false }),
    ]);
    if(sop.error) throw sop.error;
    if(!sop.data) throw new Error("SOP is not available.");
    return { sop: sop.data, steps: steps.data ?? [], checklist: checklist.data ?? [], versions: versions.data ?? [] };
  }
  if(name==="search_sops"){
    const input = query.parse(raw);
    return search(ctx, "operational_sops", "title", input.query);
  }
  if(name==="get_process"){
    const input = id.parse(raw);
    const { data, error } = await ctx.client.from("process_templates").select("*,operational_sops(*)").eq("id", input.id).eq("user_id", ctx.userId).maybeSingle();
    if(error) throw error;
    if(!data) throw new Error("Process is not available.");
    return data;
  }
  if(name==="get_process_run"){
    const input = id.parse(raw);
    const [run, checklist, blockers, failures, timeline] = await Promise.all([
      ctx.client.from("process_runs").select("*,process_templates(*),operational_sops(*)").eq("id", input.id).eq("user_id", ctx.userId).maybeSingle(),
      ctx.client.from("run_checklist_items").select("*").eq("run_id", input.id).eq("user_id", ctx.userId).order("position"),
      ctx.client.from("operational_blockers").select("*").eq("run_id", input.id).eq("user_id", ctx.userId),
      ctx.client.from("process_failures").select("*").eq("run_id", input.id).eq("user_id", ctx.userId),
      ctx.client.from("operational_timeline").select("*").eq("run_id", input.id).eq("user_id", ctx.userId).order("created_at"),
    ]);
    if(run.error) throw run.error;
    if(!run.data) throw new Error("Process run is not available.");
    return { run: run.data, checklist: checklist.data ?? [], blockers: blockers.data ?? [], failures: failures.data ?? [], timeline: timeline.data ?? [] };
  }
  if(name==="get_blocked_runs"){
    const { data, error } = await ctx.client.from("process_runs").select("*,operational_blockers(*)").eq("user_id", ctx.userId).eq("status", "blocked");
    if(error) throw error;
    return data ?? [];
  }
  if(name==="get_failed_runs"){
    const { data, error } = await ctx.client.from("process_runs").select("*,process_failures(*)").eq("user_id", ctx.userId).eq("status", "failed");
    if(error) throw error;
    return data ?? [];
  }
  if(name==="get_quality_incidents"){
    const { data, error } = await ctx.client.from("quality_incidents").select("*").eq("user_id", ctx.userId).neq("status", "resolved").order("detected_at", { ascending: false });
    if(error) throw error;
    return data ?? [];
  }
  if(name==="get_process_health"){
    const input = z.object({ process_id: z.uuid() }).strict().parse(raw);
    const [runs, failures, incidents] = await Promise.all([
      ctx.client.from("process_runs").select("*").eq("process_template_id", input.process_id).eq("user_id", ctx.userId),
      ctx.client.from("process_failures").select("*").eq("user_id", ctx.userId),
      ctx.client.from("quality_incidents").select("*").eq("process_template_id", input.process_id).eq("user_id", ctx.userId),
    ]);
    const { evaluateProcessHealth } = await import("@/lib/operations");
    return evaluateProcessHealth(runs.data ?? [], failures.data ?? [], incidents.data ?? []);
  }
  if(name==="get_operations_review"){
    const today = new Date().toISOString().slice(0, 10);
    const [runs, sops, incidents, improvements] = await Promise.all([
      ctx.client.from("process_runs").select("*").eq("user_id", ctx.userId),
      ctx.client.from("operational_sops").select("*").eq("user_id", ctx.userId),
      ctx.client.from("quality_incidents").select("*").eq("user_id", ctx.userId),
      ctx.client.from("process_improvements").select("*").eq("user_id", ctx.userId),
    ]);
    const { buildOperationsReview } = await import("@/lib/operations");
    const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
    return buildOperationsReview(runs.data ?? [], sops.data ?? [], incidents.data ?? [], improvements.data ?? [], weekAgo, today);
  }
  if(name==="create_sop_draft"){
    const input = z.object({ title: z.string().min(1).max(240), purpose: z.string().nullable().optional(), category: z.string().nullable().optional(), criticality: z.enum(["low", "medium", "high", "critical"]).nullable().optional(), confirmed: z.boolean() }).strict().parse(raw);
    const blocked = writeGuard(input.confirmed);
    if(blocked) return blocked;
    const { data, error } = await ctx.client.from("operational_sops").insert({
      user_id: ctx.userId,
      title: input.title,
      purpose: input.purpose ?? null,
      category: input.category ?? "other",
      criticality: input.criticality ?? "medium",
      status: "draft",
    } as never).select("*").single();
    if(error) throw error;
    await ctx.client.from("sop_versions").insert({ user_id: ctx.userId, sop_id: data.id, version_number: 1, change_summary: "Initial draft", status: "draft" } as never);
    return data;
  }
  if(name==="create_process"){
    const input = z.object({ name: z.string().min(1).max(240), sop_id: z.uuid().nullable().optional(), category: z.string().nullable().optional(), default_frequency: z.enum(["daily", "weekly", "monthly", "quarterly", "custom"]).nullable().optional(), confirmed: z.boolean() }).strict().parse(raw);
    const blocked = writeGuard(input.confirmed);
    if(blocked) return blocked;
    const { data, error } = await ctx.client.from("process_templates").insert({
      user_id: ctx.userId,
      name: input.name,
      sop_id: input.sop_id ?? null,
      category: input.category ?? "other",
      default_frequency: input.default_frequency ?? null,
      status: "active",
    } as never).select("*").single();
    if(error) throw error;
    return data;
  }
  if(name==="create_process_run"){
    const input = z.object({ title: z.string().min(1).max(240), process_template_id: z.uuid().nullable().optional(), sop_id: z.uuid().nullable().optional(), priority: z.enum(["low", "medium", "high", "critical"]).nullable().optional(), due_at: z.string().nullable().optional(), confirmed: z.boolean() }).strict().parse(raw);
    const blocked = writeGuard(input.confirmed);
    if(blocked) return blocked;
    const { data, error } = await ctx.client.from("process_runs").insert({
      user_id: ctx.userId,
      title: input.title,
      process_template_id: input.process_template_id ?? null,
      sop_id: input.sop_id ?? null,
      priority: input.priority ?? "medium",
      due_at: input.due_at ?? null,
      status: "planned",
    } as never).select("*").single();
    if(error) throw error;
    return data;
  }
  if(name==="create_quality_incident"){
    const input = z.object({ title: z.string().min(1).max(240), description: z.string().min(1), severity: z.enum(["low", "medium", "high", "critical"]), run_id: z.uuid().nullable().optional(), confirmed: z.boolean() }).strict().parse(raw);
    const blocked = writeGuard(input.confirmed);
    if(blocked) return blocked;
    const { data, error } = await ctx.client.from("quality_incidents").insert({
      user_id: ctx.userId,
      title: input.title,
      description: input.description,
      severity: input.severity,
      run_id: input.run_id ?? null,
      status: "open",
    } as never).select("*").single();
    if(error) throw error;
    return data;
  }
  if(name==="create_process_improvement"){
    const input = z.object({ title: z.string().min(1).max(240), problem: z.string().min(1), proposed_change: z.string().min(1), process_template_id: z.uuid().nullable().optional(), confirmed: z.boolean() }).strict().parse(raw);
    const blocked = writeGuard(input.confirmed);
    if(blocked) return blocked;
    const { data, error } = await ctx.client.from("process_improvements").insert({
      user_id: ctx.userId,
      title: input.title,
      problem: input.problem,
      proposed_change: input.proposed_change,
      process_template_id: input.process_template_id ?? null,
      status: "idea",
    } as never).select("*").single();
    if(error) throw error;
    return data;
  }
  if(name==="create_corrective_task"){
    const input = z.object({ incident_id: z.uuid(), title: z.string().min(1).max(240), due_date: z.string().nullable().optional(), confirmed: z.boolean() }).strict().parse(raw);
    const blocked = writeGuard(input.confirmed);
    if(blocked) return blocked;
    const incident = await ctx.client.from("quality_incidents").select("id").eq("id", input.incident_id).eq("user_id", ctx.userId).maybeSingle();
    if(incident.error) throw incident.error;
    if(!incident.data) throw new Error("Incident is not available.");
    const task = await ctx.client.from("tasks").insert({
      user_id: ctx.userId,
      title: input.title,
      due_date: input.due_date ?? null,
      priority: "high",
      status: "planned",
    } as never).select("*").single();
    if(task.error) throw task.error;
    await ctx.client.from("quality_incidents").update({ corrective_task_id: task.data.id, status: "corrective_action" } as never).eq("id", input.incident_id).eq("user_id", ctx.userId);
    return task.data;
  }
  // --- V12 Team read tools ---
  if(["get_team_overview","get_next_team_action","list_people","get_person","get_person_workload","get_delegations","get_waiting_on_team","get_waiting_on_me","get_ownership_gaps","get_team_capacity","get_team_risks","get_team_review","prepare_one_on_one"].includes(name)){
    const [people,delegations,responsibilities,commitments,escalations]=await Promise.all([
      ctx.client.from("team_people").select("id,name,role_title,relationship_type,status,timezone").eq("user_id",ctx.userId).eq("status","active").limit(100),
      ctx.client.from("team_delegations").select("id,title,status,delegated_to_person_id,due_at,blocked_reason,priority,created_at,updated_at").eq("user_id",ctx.userId).not("status","in","(completed,cancelled)").limit(100),
      ctx.client.from("team_responsibilities").select("id,name,primary_owner_id,backup_owner_id,criticality,status").eq("user_id",ctx.userId).neq("status","archived").limit(100),
      ctx.client.from("team_commitments").select("id,statement,from_person_id,to_person_id,due_at,status").eq("user_id",ctx.userId).not("status","in","(done,cancelled)").limit(100),
      ctx.client.from("team_escalations").select("id,reason,severity,status,person_id,created_at").eq("user_id",ctx.userId).neq("status","resolved").limit(50),
    ]);
    if(people.error||delegations.error||responsibilities.error||commitments.error||escalations.error)
      throw people.error??delegations.error??responsibilities.error??commitments.error??escalations.error;
    const today=new Date().toISOString().slice(0,10);
    const allPeople=people.data??[];
    const allDels=delegations.data??[];
    const allResps=responsibilities.data??[];
    const allCommits=commitments.data??[];
    const allEscs=escalations.data??[];
    if(name==="list_people")return allPeople;
    if(name==="get_person"||name==="get_person_workload"){
      const input=id.parse(raw);
      const person=allPeople.find((p)=>p.id===input.id);
      if(!person)return null;
      const personDels=allDels.filter((d)=>d.delegated_to_person_id===input.id);
      const personCommits=allCommits.filter((c)=>c.from_person_id===input.id||c.to_person_id===input.id);
      const personResps=allResps.filter((r)=>r.primary_owner_id===input.id||r.backup_owner_id===input.id);
      const overdue=personDels.filter((d)=>d.due_at&&d.due_at.slice(0,10)<today).length;
      const blocked=personDels.filter((d)=>d.status==="blocked").length;
      if(name==="get_person_workload")return{person,active_delegations:personDels.length,overdue_delegations:overdue,blocked_delegations:blocked,open_commitments:personCommits.length,responsibilities_owned:personResps.filter(r=>r.primary_owner_id===input.id).length};
      return{person,responsibilities:personResps,delegations:personDels,commitments:personCommits};
    }
    if(name==="get_delegations")return allDels.map((d)=>({...d,is_overdue:Boolean(d.due_at&&d.due_at.slice(0,10)<today)}));
    if(name==="get_waiting_on_team")return allDels.filter((d)=>["assigned","acknowledged","in_progress"].includes(d.status));
    if(name==="get_waiting_on_me")return allDels.filter((d)=>["needs_review","blocked"].includes(d.status));
    if(name==="get_ownership_gaps"){
      const missing_owner=allResps.filter((r)=>!r.primary_owner_id||r.status==="needs_owner").map((r)=>({id:r.id,name:r.name,criticality:r.criticality}));
      const missing_backup=allResps.filter((r)=>["critical","high"].includes(r.criticality)&&!r.backup_owner_id&&r.primary_owner_id).map((r)=>({id:r.id,name:r.name,criticality:r.criticality}));
      return{missing_owner,missing_backup};
    }
    if(name==="get_team_capacity")return allPeople.map((p)=>{const pDels=allDels.filter((d)=>d.delegated_to_person_id===p.id);const pCommits=allCommits.filter((c)=>c.from_person_id===p.id||c.to_person_id===p.id);return{person:p,active_delegations:pDels.length,overdue_delegations:pDels.filter((d)=>d.due_at&&d.due_at.slice(0,10)<today).length,blocked_delegations:pDels.filter((d)=>d.status==="blocked").length,open_commitments:pCommits.length};});
    if(name==="get_team_risks"){
      const risks=[];
      for(const d of allDels.filter((d)=>d.due_at&&d.due_at.slice(0,10)<today)){risks.push({type:"overdue_delegation",severity:d.priority==="critical"?"critical":"high",title:d.title,due_at:d.due_at,status:d.status});}
      for(const r of allResps.filter((r)=>!r.primary_owner_id)){risks.push({type:"unowned_responsibility",severity:r.criticality,title:r.name});}
      for(const r of allResps.filter((r)=>["critical","high"].includes(r.criticality)&&!r.backup_owner_id&&r.primary_owner_id)){risks.push({type:"no_backup",severity:"medium",title:r.name});}
      for(const e of allEscs){risks.push({type:"open_escalation",severity:e.severity,reason:e.reason});}
      return risks;
    }
    if(name==="get_team_review"){
      const completed=allDels.filter((d)=>d.status==="completed").length;
      const overdue=allDels.filter((d)=>d.due_at&&d.due_at.slice(0,10)<today).length;
      const blocked=allDels.filter((d)=>d.status==="blocked").length;
      return{active_delegations:allDels.length,completed_delegations:completed,overdue_delegations:overdue,blocked_delegations:blocked,open_escalations:allEscs.length,open_commitments:allCommits.length,people_count:allPeople.length};
    }
    if(name==="prepare_one_on_one"){
      const input=z.object({person_id:z.uuid()}).parse(raw);
      const person=allPeople.find((p)=>p.id===input.person_id);
      if(!person)return null;
      const personDels=allDels.filter((d)=>d.delegated_to_person_id===input.person_id);
      const personCommits=allCommits.filter((c)=>c.from_person_id===input.person_id||c.to_person_id===input.person_id);
      const overdue=personDels.filter((d)=>d.due_at&&d.due_at.slice(0,10)<today);
      const blocked=personDels.filter((d)=>d.status==="blocked");
      const notes=await ctx.client.from("team_one_on_one_notes").select("id,content,action_items,created_at").eq("user_id",ctx.userId).eq("person_id",input.person_id).order("created_at",{ascending:false}).limit(5);
      return{person,suggested_topics:[...overdue.map((d)=>`Follow-up on: ${d.title}`),...blocked.map((d)=>`Unblock: ${d.title}`),...(personCommits.length?[`Review commitments (${personCommits.length} open)`]:[])],open_delegations:personDels,open_commitments:personCommits,past_notes:notes.data??[]};
    }
    // get_team_overview and get_next_team_action
    const ownershipGaps=allResps.filter((r)=>!r.primary_owner_id).length;
    const overdueDels=allDels.filter((d)=>d.due_at&&d.due_at.slice(0,10)<today);
    const blockedDels=allDels.filter((d)=>d.status==="blocked");
    let nextAction=null;
    if(allEscs.filter((e)=>e.severity==="critical").length>0){nextAction={action:"Resolve a critical team escalation",why:"Critical escalation is open and blocking progress",route:"/team/risks"};}
    else if(overdueDels.length>0){nextAction={action:`Follow up on overdue delegation: ${overdueDels[0].title}`,why:`${overdueDels.length} delegation(s) are overdue`,route:"/team/delegations"};}
    else if(blockedDels.length>0){nextAction={action:`Unblock: ${blockedDels[0].title}`,why:"A delegation is blocked and needs owner action",route:"/team/delegations"};}
    else if(ownershipGaps>0){nextAction={action:"Assign a primary owner to an unowned responsibility",why:`${ownershipGaps} responsibility(ies) have no owner`,route:"/team/responsibilities"};}
    if(name==="get_next_team_action")return nextAction;
    return{people_count:allPeople.length,active_delegations:allDels.length,overdue_delegations:overdueDels.length,blocked_delegations:blockedDels.length,ownership_gaps:ownershipGaps,open_escalations:allEscs.length,open_commitments:allCommits.length,next_action:nextAction};
  }
  // --- V12 Team write tools ---
  if(["create_person","create_delegation","create_responsibility","create_commitment","create_escalation","link_person_to_entity","create_one_on_one_note"].includes(name)){
    const confirmed=z.object({confirmed:z.boolean()}).passthrough().parse(raw).confirmed;
    const blocked=writeGuard(confirmed);
    if(blocked)return blocked;
    if(name==="create_person"){
      const input=z.object({name:z.string().min(1).max(240),role_title:z.string().nullable().optional(),relationship_type:z.enum(["employee","contractor","advisor","partner","other"]),confirmed:z.boolean()}).strict().parse(raw);
      const{data,error}=await ctx.client.from("team_people").insert({user_id:ctx.userId,name:input.name,role_title:input.role_title??null,relationship_type:input.relationship_type,status:"active"} as never).select("*").single();
      if(error)throw error;return data;
    }
    if(name==="create_delegation"){
      const input=z.object({title:z.string().min(1).max(240),person_id:z.uuid(),due_date:z.string().nullable().optional(),confirmed:z.boolean()}).strict().parse(raw);
      const person=await ctx.client.from("team_people").select("id").eq("id",input.person_id).eq("user_id",ctx.userId).maybeSingle();
      if(person.error)throw person.error;if(!person.data)throw new Error("Person is not available.");
      const{data,error}=await ctx.client.from("team_delegations").insert({user_id:ctx.userId,title:input.title,delegated_to_person_id:input.person_id,expected_outcome:input.title,due_at:input.due_date??null,status:"assigned"} as never).select("*").single();
      if(error)throw error;return data;
    }
    if(name==="create_responsibility"){
      const input=z.object({name:z.string().min(1).max(240),owner_person_id:z.uuid(),criticality:z.enum(["low","medium","high","critical"]),confirmed:z.boolean()}).strict().parse(raw);
      const owner=await ctx.client.from("team_people").select("id").eq("id",input.owner_person_id).eq("user_id",ctx.userId).maybeSingle();
      if(owner.error)throw owner.error;if(!owner.data)throw new Error("Person is not available.");
      const{data,error}=await ctx.client.from("team_responsibilities").insert({user_id:ctx.userId,name:input.name,primary_owner_id:input.owner_person_id,criticality:input.criticality} as never).select("*").single();
      if(error)throw error;return data;
    }
    if(name==="create_commitment"){
      const input=z.object({person_id:z.uuid(),statement:z.string().min(1).max(500),due_date:z.string().nullable().optional(),confirmed:z.boolean()}).strict().parse(raw);
      const person=await ctx.client.from("team_people").select("id").eq("id",input.person_id).eq("user_id",ctx.userId).maybeSingle();
      if(person.error)throw person.error;if(!person.data)throw new Error("Person is not available.");
      const{data,error}=await ctx.client.from("team_commitments").insert({user_id:ctx.userId,from_person_id:input.person_id,statement:input.statement,due_at:input.due_date??null,status:"open"} as never).select("*").single();
      if(error)throw error;return data;
    }
    if(name==="create_escalation"){
      const input=z.object({delegation_id:z.uuid().nullable().optional(),person_id:z.uuid().nullable().optional(),reason:z.string().min(1).max(500),severity:z.enum(["low","medium","high","critical"]),confirmed:z.boolean()}).strict().parse(raw);
      const{data,error}=await ctx.client.from("team_escalations").insert({user_id:ctx.userId,source_entity_type:input.delegation_id?"delegation":null,source_entity_id:input.delegation_id??null,person_id:input.person_id??null,reason:input.reason,severity:input.severity,status:"open"} as never).select("*").single();
      if(error)throw error;return data;
    }
    if(name==="link_person_to_entity"){
      const input=z.object({person_id:z.uuid(),entity_type:z.string().min(1).max(80),entity_id:z.uuid(),role:z.string().min(1).max(80),confirmed:z.boolean()}).strict().parse(raw);
      const person=await ctx.client.from("team_people").select("id").eq("id",input.person_id).eq("user_id",ctx.userId).maybeSingle();
      if(person.error)throw person.error;if(!person.data)throw new Error("Person is not available.");
      const{data,error}=await ctx.client.from("team_entity_ownership").upsert({user_id:ctx.userId,person_id:input.person_id,entity_type:input.entity_type,entity_id:input.entity_id,ownership_role:input.role} as never,{onConflict:"user_id,entity_type,entity_id,person_id,ownership_role"}).select("*").single();
      if(error)throw error;return data;
    }
    if(name==="create_one_on_one_note"){
      const input=z.object({person_id:z.uuid(),content:z.string().min(1).max(4000),action_items:z.string().nullable().optional(),confirmed:z.boolean()}).strict().parse(raw);
      const person=await ctx.client.from("team_people").select("id").eq("id",input.person_id).eq("user_id",ctx.userId).maybeSingle();
      if(person.error)throw person.error;if(!person.data)throw new Error("Person is not available.");
      const{data,error}=await ctx.client.from("team_one_on_one_notes").insert({user_id:ctx.userId,person_id:input.person_id,topics_discussed:input.content,action_items:input.action_items??null} as never).select("*").single();
      if(error)throw error;return data;
    }
  }
  // --- V13 Customer Success read tools ---
  if([
    "get_success_overview",
    "get_next_success_action",
    "get_client_success_profile",
    "list_client_outcomes",
    "get_client_outcome",
    "list_client_success_plans",
    "get_client_success_plan",
    "list_client_commitments",
    "get_client_waiting_state",
    "list_client_check_ins",
    "list_client_risks",
    "list_client_renewals",
    "get_retention_review"
  ].includes(name)){
    if(name==="get_success_overview" || name==="get_next_success_action"){
      const [
        clientsRes, outcomesRes, risksRes, renewalsRes, issuesRes, commitmentsRes, signalsRes,
        projectsRes, runsRes, waitingItemsRes, approvalsRes
      ] = await Promise.all([
        ctx.client.from("clients").select("*").eq("user_id", ctx.userId).is("deleted_at", null),
        ctx.client.from("client_outcomes").select("*").eq("user_id", ctx.userId),
        ctx.client.from("client_risks").select("*").eq("user_id", ctx.userId).order("created_at", { ascending: false }),
        ctx.client.from("client_renewals").select("*").eq("user_id", ctx.userId).order("renewal_date"),
        ctx.client.from("client_issues").select("*").eq("user_id", ctx.userId).order("created_at", { ascending: false }),
        ctx.client.from("client_commitments").select("*").eq("user_id", ctx.userId),
        ctx.client.from("client_satisfaction_signals").select("*").eq("user_id", ctx.userId).order("recorded_at", { ascending: false }).limit(30),
        ctx.client.from("projects").select("id,client_id,name,status").eq("user_id", ctx.userId).is("deleted_at", null),
        ctx.client.from("process_runs").select("id,client_id,title,status").eq("user_id", ctx.userId),
        ctx.client.from("waiting_items").select("id,client_id,title,status,requested_at,expected_by").eq("user_id", ctx.userId).eq("status", "waiting"),
        ctx.client.from("approvals").select("id,client_id,title,status,created_at").eq("user_id", ctx.userId).eq("status", "pending"),
      ]);

      const clients = (clientsRes.data ?? []) as ClientRecord[];
      const outcomes = (outcomesRes.data ?? []) as ClientOutcome[];
      const risks = (risksRes.data ?? []) as ClientRisk[];
      const renewals = (renewalsRes.data ?? []) as ClientRenewal[];
      const issues = (issuesRes.data ?? []) as ClientIssue[];
      const commitments = (commitmentsRes.data ?? []) as ClientCommitment[];
      const signals = (signalsRes.data ?? []) as ClientSatisfactionSignal[];
      const projects = projectsRes.data ?? [];
      const runs = runsRes.data ?? [];
      const waitingItems = waitingItemsRes.data ?? [];
      const approvals = approvalsRes.data ?? [];

      const { waitingOnUs, waitingOnClient } = buildClientWaitingState(
        clients, commitments, [], waitingItems, approvals
      );

      const nextAction = rankNextCustomerSuccessAction(
        clients, outcomes, risks, renewals, issues, commitments, waitingOnUs
      );

      if (name === "get_next_success_action") return nextAction;

      const healthCounts = { healthy: 0, attention: 0, critical: 0, off_track: 0 };
      for (const client of clients) {
        const cOutcomes = outcomes.filter((o) => o.client_id === client.id);
        const cRisks = risks.filter((r) => r.client_id === client.id);
        const cRenewals = renewals.filter((r) => r.client_id === client.id);
        const cIssues = issues.filter((i) => i.client_id === client.id);
        const cCommits = commitments.filter((c) => c.client_id === client.id);
        const cProjs = projects.filter((p) => p.client_id === client.id);
        const cRuns = runs.filter((r) => r.client_id === client.id);
        const cSignals = signals.filter((s) => s.client_id === client.id);
        const evaluated = evaluateAccountHealth(client, cOutcomes, cRisks, cRenewals, cIssues, cCommits, cProjs, cRuns, cSignals);
        if (evaluated.state === "healthy") healthCounts.healthy++;
        else if (evaluated.state === "needs_attention") healthCounts.attention++;
        else if (evaluated.state === "critical") healthCounts.critical++;
        else healthCounts.off_track++;
      }

      return {
        total_clients: clients.length,
        health_distribution: healthCounts,
        open_risks_count: risks.filter((r) => r.status === "open").length,
        upcoming_renewals_count: renewals.filter((r) => !["renewed", "churned"].includes(r.status)).length,
        waiting_on_us_count: waitingOnUs.length,
        waiting_on_client_count: waitingOnClient.length,
        next_action: nextAction
      };
    }

    if (name === "get_client_success_profile") {
      const input = z.object({ client_id: z.uuid() }).parse(raw);
      const [
        clientRes, outcomesRes, plansRes, commitmentsRes, checkInsRes, risksRes, renewalsRes, issuesRes, signalsRes, projectsRes, runsRes
      ] = await Promise.all([
        ctx.client.from("clients").select("*").eq("id", input.client_id).eq("user_id", ctx.userId).is("deleted_at", null).maybeSingle(),
        ctx.client.from("client_outcomes").select("*").eq("client_id", input.client_id).eq("user_id", ctx.userId),
        ctx.client.from("client_success_plans").select("*").eq("client_id", input.client_id).eq("user_id", ctx.userId),
        ctx.client.from("client_commitments").select("*").eq("client_id", input.client_id).eq("user_id", ctx.userId),
        ctx.client.from("client_check_ins").select("*").eq("client_id", input.client_id).eq("user_id", ctx.userId).order("scheduled_at", { ascending: false }),
        ctx.client.from("client_risks").select("*").eq("client_id", input.client_id).eq("user_id", ctx.userId),
        ctx.client.from("client_renewals").select("*").eq("client_id", input.client_id).eq("user_id", ctx.userId),
        ctx.client.from("client_issues").select("*").eq("client_id", input.client_id).eq("user_id", ctx.userId),
        ctx.client.from("client_satisfaction_signals").select("*").eq("client_id", input.client_id).eq("user_id", ctx.userId).order("recorded_at", { ascending: false }),
        ctx.client.from("projects").select("id,client_id,name,status").eq("client_id", input.client_id).eq("user_id", ctx.userId).is("deleted_at", null),
        ctx.client.from("process_runs").select("id,client_id,title,status").eq("client_id", input.client_id).eq("user_id", ctx.userId),
      ]);
      if (clientRes.error) throw clientRes.error;
      if (!clientRes.data) return null;

      const client = clientRes.data as ClientRecord;
      const outcomes = (outcomesRes.data ?? []) as ClientOutcome[];
      const risks = (risksRes.data ?? []) as ClientRisk[];
      const renewals = (renewalsRes.data ?? []) as ClientRenewal[];
      const issues = (issuesRes.data ?? []) as ClientIssue[];
      const commits = (commitmentsRes.data ?? []) as ClientCommitment[];
      const projs = projectsRes.data ?? [];
      const runs = runsRes.data ?? [];
      const signals = (signalsRes.data ?? []) as ClientSatisfactionSignal[];

      const health = evaluateAccountHealth(client, outcomes, risks, renewals, issues, commits, projs, runs, signals);
      const churn = evaluateChurnRisk(client, health.state, risks, issues, renewals, signals);
      const renewalEval = renewals.length > 0 ? evaluateRenewalReadiness(renewals[0], health.state, outcomes.length) : null;

      return {
        client,
        health,
        churn_risk: churn,
        renewal_evaluation: renewalEval,
        outcomes,
        plans: plansRes.data ?? [],
        commitments: commits,
        check_ins: checkInsRes.data ?? [],
        risks,
        renewals,
        issues,
        signals
      };
    }

    if (name === "list_client_outcomes") {
      const input = z.object({ client_id: z.uuid().nullable().optional() }).parse(raw);
      let q = ctx.client.from("client_outcomes").select("*").eq("user_id", ctx.userId);
      if (input.client_id) q = q.eq("client_id", input.client_id);
      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    }

    if (name === "get_client_outcome") {
      const input = id.parse(raw);
      const { data, error } = await ctx.client.from("client_outcomes").select("*, client_outcome_milestones(*)").eq("id", input.id).eq("user_id", ctx.userId).maybeSingle();
      if (error) throw error;
      return data ?? null;
    }

    if (name === "list_client_success_plans") {
      const input = z.object({ client_id: z.uuid().nullable().optional() }).parse(raw);
      let q = ctx.client.from("client_success_plans").select("*").eq("user_id", ctx.userId);
      if (input.client_id) q = q.eq("client_id", input.client_id);
      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    }

    if (name === "get_client_success_plan") {
      const input = id.parse(raw);
      const { data, error } = await ctx.client.from("client_success_plans").select("*, client_success_objectives(*)").eq("id", input.id).eq("user_id", ctx.userId).maybeSingle();
      if (error) throw error;
      return data ?? null;
    }

    if (name === "list_client_commitments") {
      const input = z.object({ client_id: z.uuid().nullable().optional(), direction: z.string().nullable().optional() }).parse(raw);
      let q = ctx.client.from("client_commitments").select("*").eq("user_id", ctx.userId);
      if (input.client_id) q = q.eq("client_id", input.client_id);
      if (input.direction) q = q.eq("direction", input.direction);
      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    }

    if (name === "get_client_waiting_state") {
      const [clientsRes, commitmentsRes, waitingItemsRes, approvalsRes] = await Promise.all([
        ctx.client.from("clients").select("*").eq("user_id", ctx.userId).is("deleted_at", null),
        ctx.client.from("client_commitments").select("*").eq("user_id", ctx.userId),
        ctx.client.from("waiting_items").select("id,client_id,title,status,requested_at,expected_by").eq("user_id", ctx.userId).eq("status", "waiting"),
        ctx.client.from("approvals").select("id,client_id,title,status,created_at").eq("user_id", ctx.userId).eq("status", "pending"),
      ]);
      return buildClientWaitingState(
        (clientsRes.data ?? []) as ClientRecord[],
        (commitmentsRes.data ?? []) as ClientCommitment[],
        [],
        waitingItemsRes.data ?? [],
        approvalsRes.data ?? []
      );
    }

    if (name === "list_client_check_ins") {
      const input = z.object({ client_id: z.uuid().nullable().optional() }).parse(raw);
      let q = ctx.client.from("client_check_ins").select("*").eq("user_id", ctx.userId);
      if (input.client_id) q = q.eq("client_id", input.client_id);
      const { data, error } = await q.order("scheduled_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    }

    if (name === "list_client_risks") {
      const input = z.object({ client_id: z.uuid().nullable().optional() }).parse(raw);
      let q = ctx.client.from("client_risks").select("*").eq("user_id", ctx.userId);
      if (input.client_id) q = q.eq("client_id", input.client_id);
      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    }

    if (name === "list_client_renewals") {
      const input = z.object({ client_id: z.uuid().nullable().optional() }).parse(raw);
      let q = ctx.client.from("client_renewals").select("*").eq("user_id", ctx.userId);
      if (input.client_id) q = q.eq("client_id", input.client_id);
      const { data, error } = await q.order("renewal_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    }

    if (name === "get_retention_review") {
      const input = z.object({ period: z.enum(["week", "month"]).nullable().optional() }).parse(raw);
      const [clientsRes, renewalsRes, risksRes, outcomesRes, issuesRes, commitmentsRes] = await Promise.all([
        ctx.client.from("clients").select("*").eq("user_id", ctx.userId).is("deleted_at", null),
        ctx.client.from("client_renewals").select("*").eq("user_id", ctx.userId),
        ctx.client.from("client_risks").select("*").eq("user_id", ctx.userId),
        ctx.client.from("client_outcomes").select("*").eq("user_id", ctx.userId),
        ctx.client.from("client_issues").select("*").eq("user_id", ctx.userId),
        ctx.client.from("client_commitments").select("*").eq("user_id", ctx.userId),
      ]);
      return buildRetentionReview(
        (clientsRes.data ?? []) as ClientRecord[],
        (renewalsRes.data ?? []) as ClientRenewal[],
        (risksRes.data ?? []) as ClientRisk[],
        (outcomesRes.data ?? []) as ClientOutcome[],
        (issuesRes.data ?? []) as ClientIssue[],
        (commitmentsRes.data ?? []) as ClientCommitment[],
        input.period === "month" ? "month" : "week"
      );
    }
  }

  // --- V13 Customer Success write tools ---
  if([
    "create_client_outcome",
    "update_client_outcome",
    "create_client_success_plan",
    "create_client_commitment",
    "create_client_check_in",
    "record_client_satisfaction_signal",
    "create_client_risk",
    "create_client_renewal"
  ].includes(name)){
    const confirmed = z.object({ confirmed: z.boolean() }).passthrough().parse(raw).confirmed;
    const blocked = writeGuard(confirmed);
    if (blocked) return blocked;

    if (name === "create_client_outcome") {
      const input = z.object({
        client_id: z.uuid(),
        title: z.string().min(1).max(240),
        target_date: z.string().nullable().optional(),
        priority: z.enum(["low", "medium", "high", "critical"]).nullable().optional(),
        confirmed: z.boolean()
      }).strict().parse(raw);
      const client = await ctx.client.from("clients").select("id").eq("id", input.client_id).eq("user_id", ctx.userId).is("deleted_at", null).maybeSingle();
      if (client.error) throw client.error;
      if (!client.data) throw new Error("Client is not available.");
      const { data, error } = await ctx.client.from("client_outcomes").insert({
        user_id: ctx.userId,
        client_id: input.client_id,
        title: input.title,
        target_date: input.target_date ?? null,
        priority: input.priority ?? "medium",
        status: "draft"
      } as never).select("*").single();
      if (error) throw error;
      return data;
    }

    if (name === "update_client_outcome") {
      const input = z.object({
        id: z.uuid(),
        status: z.enum(["draft", "in_progress", "achieved", "missed", "blocked"]),
        notes: z.string().nullable().optional(),
        confirmed: z.boolean()
      }).strict().parse(raw);
      const updateData: Record<string, unknown> = {
        status: input.status,
        updated_at: new Date().toISOString()
      };
      if (input.status === "achieved") updateData.achieved_at = new Date().toISOString();
      if (input.notes !== undefined) updateData.notes = input.notes;
      const { data, error } = await ctx.client.from("client_outcomes").update(updateData as never).eq("id", input.id).eq("user_id", ctx.userId).select("*").single();
      if (error) throw error;
      return data;
    }

    if (name === "create_client_success_plan") {
      const input = z.object({
        client_id: z.uuid(),
        title: z.string().min(1).max(240),
        period: z.string().min(1).max(50),
        objective: z.string().min(1).max(500),
        confirmed: z.boolean()
      }).strict().parse(raw);
      const client = await ctx.client.from("clients").select("id").eq("id", input.client_id).eq("user_id", ctx.userId).is("deleted_at", null).maybeSingle();
      if (client.error) throw client.error;
      if (!client.data) throw new Error("Client is not available.");
      const { data, error } = await ctx.client.from("client_success_plans").insert({
        user_id: ctx.userId,
        client_id: input.client_id,
        title: input.title,
        period: input.period,
        notes: input.objective,
        status: "draft"
      } as never).select("*").single();
      if (error) throw error;
      return data;
    }

    if (name === "create_client_commitment") {
      const input = z.object({
        client_id: z.uuid(),
        direction: z.enum(["we_committed_to_client", "client_committed_to_us"]),
        statement: z.string().min(1).max(500),
        due_at: z.string().nullable().optional(),
        confirmed: z.boolean()
      }).strict().parse(raw);
      const client = await ctx.client.from("clients").select("id").eq("id", input.client_id).eq("user_id", ctx.userId).is("deleted_at", null).maybeSingle();
      if (client.error) throw client.error;
      if (!client.data) throw new Error("Client is not available.");
      const { data, error } = await ctx.client.from("client_commitments").insert({
        user_id: ctx.userId,
        client_id: input.client_id,
        direction: input.direction,
        statement: input.statement,
        due_at: input.due_at ?? null,
        status: "open"
      } as never).select("*").single();
      if (error) throw error;
      return data;
    }

    if (name === "create_client_check_in") {
      const input = z.object({
        client_id: z.uuid(),
        purpose: z.string().min(1).max(240),
        check_in_type: z.enum(["weekly_pulse", "monthly_review", "executive_qbr", "ad_hoc", "onboarding_sync", "renewal_discussion"]),
        scheduled_at: z.string().nullable().optional(),
        confirmed: z.boolean()
      }).strict().parse(raw);
      const client = await ctx.client.from("clients").select("id").eq("id", input.client_id).eq("user_id", ctx.userId).is("deleted_at", null).maybeSingle();
      if (client.error) throw client.error;
      if (!client.data) throw new Error("Client is not available.");
      const { data, error } = await ctx.client.from("client_check_ins").insert({
        user_id: ctx.userId,
        client_id: input.client_id,
        purpose: input.purpose,
        check_in_type: input.check_in_type,
        scheduled_at: input.scheduled_at ?? null,
        status: "scheduled"
      } as never).select("*").single();
      if (error) throw error;
      return data;
    }

    if (name === "record_client_satisfaction_signal") {
      const input = z.object({
        client_id: z.uuid(),
        signal_type: z.enum(["csat", "nps", "sentiment", "direct_feedback", "unsolicited_praise", "complaint", "executive_escalation"]),
        summary: z.string().min(1).max(500),
        severity: z.enum(["low", "medium", "high", "critical"]).nullable().optional(),
        confirmed: z.boolean()
      }).strict().parse(raw);
      const client = await ctx.client.from("clients").select("id").eq("id", input.client_id).eq("user_id", ctx.userId).is("deleted_at", null).maybeSingle();
      if (client.error) throw client.error;
      if (!client.data) throw new Error("Client is not available.");
      const { data, error } = await ctx.client.from("client_satisfaction_signals").insert({
        user_id: ctx.userId,
        client_id: input.client_id,
        signal_type: input.signal_type,
        summary: input.summary,
        sentiment: input.severity === "critical" || input.severity === "high" ? "negative" : "neutral",
        recorded_at: new Date().toISOString()
      } as never).select("*").single();
      if (error) throw error;
      return data;
    }

    if (name === "create_client_risk") {
      const input = z.object({
        client_id: z.uuid(),
        risk_type: z.enum(["delivery_delay", "scope_creep", "champion_left", "budget_cut", "poor_adoption", "unmet_expectations", "competitor_threat", "executive_disconnect"]),
        severity: z.enum(["low", "medium", "high", "critical"]),
        description: z.string().min(1).max(1000),
        confirmed: z.boolean()
      }).strict().parse(raw);
      const client = await ctx.client.from("clients").select("id").eq("id", input.client_id).eq("user_id", ctx.userId).is("deleted_at", null).maybeSingle();
      if (client.error) throw client.error;
      if (!client.data) throw new Error("Client is not available.");
      const { data, error } = await ctx.client.from("client_risks").insert({
        user_id: ctx.userId,
        client_id: input.client_id,
        risk_type: input.risk_type,
        severity: input.severity,
        description: input.description,
        status: "open"
      } as never).select("*").single();
      if (error) throw error;
      return data;
    }

    if (name === "create_client_renewal") {
      const input = z.object({
        client_id: z.uuid(),
        renewal_date: z.string().min(10).max(10),
        renewal_type: z.enum(["contract_renewal", "subscription_renewal", "retainer_renewal", "service_expansion", "pilot_to_annual"]),
        value: z.number().nullable(),
        currency: z.string().min(3).max(3),
        forecast_category: z.enum(["committed", "best_case", "pipeline", "at_risk", "lost"]),
        confirmed: z.boolean()
      }).strict().parse(raw);
      const client = await ctx.client.from("clients").select("id").eq("id", input.client_id).eq("user_id", ctx.userId).is("deleted_at", null).maybeSingle();
      if (client.error) throw client.error;
      if (!client.data) throw new Error("Client is not available.");
      const { data, error } = await ctx.client.from("client_renewals").insert({
        user_id: ctx.userId,
        client_id: input.client_id,
        renewal_date: input.renewal_date,
        renewal_type: input.renewal_type,
        target_value: input.value,
        currency: input.currency.toUpperCase(),
        forecast_category: input.forecast_category,
        status: "upcoming"
      } as never).select("*").single();
      if (error) throw error;
      return data;
    }
  }
  throw new Error("Unknown assistant tool.");
}
