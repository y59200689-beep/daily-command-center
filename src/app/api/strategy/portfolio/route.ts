import { NextResponse } from "next/server";
import { apiError, isMissingOptionalSchema } from "@/lib/api";
import { capacityState } from "@/lib/strategy";
import { goalHealth, portfolioHealth, rankPortfolio, strategicRisks, tradeoffPreview } from "@/lib/strategy-extended";
import { requireUser } from "@/lib/supabase/server";

export async function GET() { try {
  const { supabase,userId }=await requireUser(); const today=new Date().toISOString().slice(0,10);
  const [projects,opportunities,campaigns,roadmap,trips,commitments,milestones,goals,events,dependencies]=await Promise.all([
    supabase.from("projects").select("id,name,status,target_date,priority").eq("user_id",userId).eq("status","active").is("deleted_at",null).limit(40),
    supabase.from("opportunities").select("id,title,stage,expected_close_date,estimated_value").eq("user_id",userId).is("archived_at",null).not("stage","in","(won,lost)").limit(40),
    supabase.from("campaigns").select("id,name,status,end_date").eq("user_id",userId).is("deleted_at",null).neq("status","archived").limit(40),
    supabase.from("product_roadmap_items").select("id,title,status,target_date,priority").eq("user_id",userId).not("status","in","(shipped,paused)").limit(40),
    supabase.from("trips").select("id,title,status,start_date").eq("user_id",userId).is("archived_at",null).not("status","in","(completed,canceled)").limit(20),
    supabase.from("strategic_commitments").select("id,title,status,target_date,priority,source_type,source_id").eq("user_id",userId).not("status","in","(completed,dropped)").limit(40),
    supabase.from("strategic_milestones").select("id,title,status,milestone_date,source_type,source_id").eq("user_id",userId).not("status","in","(reached,canceled)").limit(40),
    supabase.from("goals").select("id,title,progress,target_date,updated_at").eq("user_id",userId).eq("status","active").is("deleted_at",null).limit(30),
    supabase.from("calendar_events").select("starts_at,ends_at").eq("user_id",userId).gte("starts_at",`${today}T00:00:00Z`).lt("starts_at",`${today}T23:59:59Z`).is("deleted_at",null),
    supabase.from("strategic_dependencies").select("commitment_id,depends_on_type,depends_on_id,relation_type").eq("user_id",userId),
  ]);const failed=[projects,opportunities,campaigns,roadmap,trips,commitments,milestones,goals,events,dependencies].find(result=>result.error);if(failed?.error)throw failed.error;
  const activeCommitments=commitments.data??[], allMilestones=milestones.data??[];
  const nextMilestone=(type:string,id:string)=>allMilestones.find(row=>row.source_type===type&&row.source_id===id)?.title??null;
  const mapped=[...(projects.data??[]).map(row=>({id:row.id,title:row.name,domain:"work" as const,status:row.status,targetDate:row.target_date,priority:row.priority==="high"?5:3,route:`/projects/${row.id}`})),...(opportunities.data??[]).map(row=>({id:row.id,title:row.title,domain:"business" as const,status:row.stage,targetDate:row.expected_close_date,value:Number(row.estimated_value??0),route:`/pipeline?opportunity=${row.id}`})),...(campaigns.data??[]).map(row=>({id:row.id,title:row.name,domain:"business" as const,status:row.status,targetDate:row.end_date,route:"/campaigns"})),...(roadmap.data??[]).map(row=>({id:row.id,title:row.title,domain:"founder" as const,status:row.status,targetDate:row.target_date,priority:row.priority==="critical"?5:3,route:"/founder"})),...(trips.data??[]).map(row=>({id:row.id,title:row.title,domain:"life" as const,status:row.status,targetDate:row.start_date,route:`/travel/${row.id}`}))].map(row=>{const related=activeCommitments.find(commitment=>commitment.source_id===row.id);const blocked=Boolean(related&&(dependencies.data??[]).some(dependency=>dependency.commitment_id===related.id&&dependency.relation_type!=="related"));return {...row,blocked,health:portfolioHealth({blocked,status:related?.status,deadline:row.targetDate,today}),nextMilestone:nextMilestone(row.domain==="founder"?"roadmap":row.domain==="life"?"trip":row.domain==="work"?"project":"opportunity",row.id)}});
  const goalRows=(goals.data??[]).map(row=>goalHealth({id:row.id,title:row.title,progress:Number(row.progress??0),targetDate:row.target_date,commitments:activeCommitments.filter(c=>c.source_type==="goal"&&c.source_id===row.id).length,milestones:allMilestones.filter(m=>m.source_type==="goal"&&m.source_id===row.id).length,recentActivity:Date.parse(row.updated_at)>Date.now()-30*86400000},today));
  const meetingHours=(events.data??[]).reduce((sum,row)=>sum+(Date.parse(row.ends_at)-Date.parse(row.starts_at))/3600000,0);const capacity=capacityState({commitments:activeCommitments.length,deadlines:activeCommitments.filter(row=>row.target_date&&row.target_date<=new Date(Date.now()+7*86400000).toISOString().slice(0,10)).length,meetingHours,availableHours:20});const items=rankPortfolio(mapped,today);
  return NextResponse.json({items,goals:goalRows,risks:strategicRisks({portfolio:items,goals:goalRows,capacity}),capacity,tradeoff:tradeoffPreview({commitments:activeCommitments.length,deadlines:0,meetingHours,availableHours:20})},{headers:{"Cache-Control":"private, no-store"}});
}catch(error){
  if(isMissingOptionalSchema(error))return NextResponse.json({items:[],goals:[],risks:[],capacity:{state:"unknown",reason:"Planning capacity is unavailable."},tradeoff:{next:{state:"unknown"},suggestReview:false},schemaStatus:"unavailable",schemaDependency:"V8 strategic planning schema"},{headers:{"Cache-Control":"private, no-store"}});
  return apiError(error,"Portfolio could not be loaded.");
}}
