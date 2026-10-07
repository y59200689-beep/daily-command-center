import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createRadiologyReportStore } from "@/lib/integrations/radiology-report-store";
import { hasReportAuthorization, radiologyReportSchema, saveRadiologyReport } from "@/lib/integrations/radiology-reports";
import { radiologyWeek, researchRadiologyWeek } from "@/lib/radiology-weekly";
export const runtime="nodejs";
export const maxDuration=300;
const json=(body:object,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
async function run(request:Request,manual:boolean) {
 const secret=manual ? process.env.RADIOLOGY_REPORTS_INTEGRATION_SECRET : process.env.CRON_SECRET;
 if(!secret || !hasReportAuthorization(request.headers.get("authorization"),secret))return json({error:"Unauthorized"},401);
 const week=radiologyWeek(new Date(),manual);
 if(!week)return json({success:true,skipped:true,reason:"Outside Monday morning in Africa/Casablanca"});
 const userId=process.env.RADIOLOGY_REPORTS_USER_ID,apiKey=process.env.OPENAI_API_KEY;
 if(!z.uuid().safeParse(userId).success||!apiKey){console.error("[radiology-weekly] configuration_error");return json({error:"Reporting account or OpenAI credential is not configured."},503);}
 const client=createAdminClient(),store=createRadiologyReportStore();let jobId:string|undefined;const leaseToken=randomUUID();
 try {
  const existing=await store.find(userId!,week.externalId);
  if(existing)return json({success:true,duplicate:true,reportId:existing,externalId:week.externalId});
  const initialized=await client.from("radiology_report_jobs").upsert({user_id:userId,external_id:week.externalId},{onConflict:"user_id,external_id",ignoreDuplicates:true});if(initialized.error)throw new Error("JOB_INITIALIZATION_FAILED");
  const {data:job,error}=await client.from("radiology_report_jobs").select("*").eq("user_id",userId!).eq("external_id",week.externalId).single();if(error)throw new Error("JOB_READ_FAILED");
  if(job.attempts>=3){console.error("[radiology-weekly] retries_exhausted",{externalId:week.externalId});return json({error:"Weekly reporting retries exhausted. Review server logs and job status."},503);}
  const now=new Date().toISOString();
  const claimed=await client.from("radiology_report_jobs").update({status:"running",attempts:job.attempts+1,lease_token:leaseToken,lease_until:new Date(Date.now()+10*60000).toISOString(),updated_at:now}).eq("id",job.id).eq("attempts",job.attempts).neq("status","completed").or(`and(lease_until.is.null,next_attempt_at.is.null),and(lease_until.lt.${now},next_attempt_at.is.null),and(lease_until.is.null,next_attempt_at.lt.${now}),and(lease_until.lt.${now},next_attempt_at.lt.${now})`).select("id").maybeSingle();
  if(claimed.error)throw new Error("JOB_CLAIM_FAILED");if(!claimed.data)return json({success:true,skipped:true,reason:"Already running or waiting for retry"});jobId=job.id;
  console.info("[radiology-weekly] started",{externalId:week.externalId,attempt:job.attempts+1});
  const draft=job.draft ? radiologyReportSchema.parse(job.draft) : await researchRadiologyWeek(week,apiKey,process.env.RADIOLOGY_REPORTS_MODEL??"gpt-5-mini");
  const cached=await client.from("radiology_report_jobs").update({draft,updated_at:new Date().toISOString()}).eq("id",jobId!).eq("lease_token",leaseToken);if(cached.error)throw new Error("JOB_DRAFT_SAVE_FAILED");
  const saved=await saveRadiologyReport(draft,userId!,store);
  const completed=await client.from("radiology_report_jobs").update({status:"completed",report_id:saved.reportId,lease_until:null,next_attempt_at:null,last_error_code:null,updated_at:new Date().toISOString()}).eq("id",jobId!).eq("lease_token",leaseToken);if(completed.error)throw new Error("JOB_COMPLETION_FAILED");
  console.info("[radiology-weekly] completed",{externalId:week.externalId,reportId:saved.reportId});
  return json({success:true,...saved,externalId:week.externalId});
 }catch(error){
  // Store only whitelisted failure categories, never upstream response bodies or credentials.
  const message=error instanceof Error?error.message:"";const code=/^(AI_HTTP_\d{3}|AI_SEARCH_INCOMPLETE|AI_UNVERIFIED_SOURCES|JOB_[A-Z_]+)$/.test(message)?message:"WEEKLY_REPORT_FAILED";
  console.error("[radiology-weekly] failed",{externalId:week.externalId,code});
  if(jobId){const updated=await client.from("radiology_report_jobs").update({status:"failed",lease_until:null,last_error_code:code,next_attempt_at:new Date(Date.now()+30*60000).toISOString(),updated_at:new Date().toISOString()}).eq("id",jobId).eq("lease_token",leaseToken);if(updated.error)console.error("[radiology-weekly] failure_status_unavailable");}
  return json({error:"Weekly research failed. A bounded retry will use the same externalId.",code},500);
 }
}
export const GET=(request:Request)=>run(request,false);
// Private on-demand recovery/test entry point; never accepts caller-supplied dates or owners.
export const POST=(request:Request)=>run(request,true);
