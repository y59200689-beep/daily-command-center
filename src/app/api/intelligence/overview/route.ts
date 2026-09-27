import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { adaptiveModules } from "@/lib/intelligence/overview";
import { getIntelligence } from "@/lib/intelligence/server";
import { persistIntelligenceSnapshot } from "@/lib/intelligence/workspace";
import { requireUser } from "@/lib/supabase/server";

export async function GET() {
  try {
    const { supabase, userId } = await requireUser();
    const { snapshot, overview } = await getIntelligence(supabase, userId);
    const sources = {project:snapshot.projects,client:snapshot.clients,content:snapshot.content,campaign:snapshot.campaigns,task:snapshot.tasks,fitness:snapshot.fitnessTargets};
    const risks = overview.risks.map(risk => {const rows = sources[risk.entityType as keyof typeof sources] ?? [];const source=rows.find(row=>row.id===risk.entityId);return {...risk,updatedAt:typeof source?.updated_at === "string" ? source.updated_at : null};});
    const history = await supabase.from("risk_snapshots").select("snapshot_date,risk_key,severity,entity_type").eq("user_id",userId).gte("snapshot_date",new Date(Date.now()-90*86400000).toISOString().slice(0,10)).order("snapshot_date").limit(10001);
    return NextResponse.json({ ...overview, risks, evaluatedAt:snapshot.now, riskHistory:history.error || (history.data?.length ?? 0)>10000 ? [] : history.data, riskHistoryAvailable:!history.error && (history.data?.length ?? 0)<=10000, modules: adaptiveModules(overview) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error, "Intelligence could not be prepared.");
  }
}

export async function POST() {
  try {
    const { supabase, userId } = await requireUser();
    const { snapshot, overview } = await getIntelligence(supabase, userId);
    await persistIntelligenceSnapshot(supabase, userId, overview, snapshot.today);
    return NextResponse.json({ saved: true, generatedAt: snapshot.now });
  } catch (error) {
    return apiError(error, "Intelligence snapshot could not be saved.");
  }
}
