import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { capacityState, horizonFor, rankStrategicItems } from "@/lib/strategy";
import { requireUser } from "@/lib/supabase/server";

export async function GET() { try {
  const { supabase, userId } = await requireUser(); const today = new Date().toISOString().slice(0, 10);
  const [periods, commitments, milestones, dependencies, gates, events] = await Promise.all([
    supabase.from("planning_periods").select("*").eq("user_id", userId).neq("status", "archived").order("starts_at"),
    supabase.from("strategic_commitments").select("*").eq("user_id", userId).not("status", "in", "(completed,dropped)").order("target_date"),
    supabase.from("strategic_milestones").select("*").eq("user_id", userId).not("status", "in", "(reached,canceled)").order("milestone_date").limit(12),
    supabase.from("strategic_dependencies").select("*").eq("user_id", userId).neq("status", "resolved"),
    supabase.from("decision_gates").select("*").eq("user_id", userId).eq("status", "open").order("due_date").limit(6),
    supabase.from("calendar_events").select("starts_at,ends_at").eq("user_id", userId).gte("starts_at", `${today}T00:00:00Z`).lt("starts_at", `${today}T23:59:59Z`).is("deleted_at", null),
  ]); const failed=[periods,commitments,milestones,dependencies,gates,events].find(row=>row.error); if(failed?.error) throw failed.error;
  const activePeriod=(periods.data??[]).find(row=>row.status==="active"&&row.type==="week")??(periods.data??[]).find(row=>row.status==="active")??null;
  const rows=(commitments.data??[]).map(row=>({...row,targetDate:row.target_date,blocked:(dependencies.data??[]).some(dep=>dep.commitment_id===row.id&&dep.relation_type!=="related")})); const ranked=rankStrategicItems(rows,today); const atRisk=ranked.filter(row=>row.status==="at_risk"||row.blocked).slice(0,5);
  const meetingHours=(events.data??[]).reduce((total,event)=>total+(Date.parse(event.ends_at)-Date.parse(event.starts_at))/3_600_000,0); const deadlines=rows.filter(row=>row.targetDate&&row.targetDate<=new Date(Date.now()+7*86400000).toISOString().slice(0,10)).length;
  const capacity=capacityState({commitments:rows.length,deadlines,meetingHours,availableHours:20}); const horizons={30:ranked.filter(row=>horizonFor(row.targetDate,today)===30),60:ranked.filter(row=>horizonFor(row.targetDate,today)===60),90:ranked.filter(row=>horizonFor(row.targetDate,today)===90)};
  return NextResponse.json({activePeriod, commitments:ranked.slice(0,7), nextMove:ranked[0]??null, atRisk, capacity, milestones:milestones.data??[], horizons, decisionGates:gates.data??[],dependencies:dependencies.data??[]},{headers:{"Cache-Control":"private, no-store"}});
} catch(error){return apiError(error,"Control Tower could not be loaded.");} }
