import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";
import { decisionWorkflow, postmortemSchema, reviewVariance } from "@/lib/founder-os/workflows";
const kinds = { decision: "decisions", issue: "quality_incidents", risk: "operating_risks", forecast: "forecast_evaluations", weekly: "retrospectives" } as const;
type Context = { params: Promise<{ kind: string; id: string }> };
async function source(context: Context) {
  const params = await context.params;
  const kind = z.enum(["decision", "issue", "risk", "forecast", "weekly"]).parse(params.kind), id = z.uuid().parse(params.id);
  const { supabase, userId } = await requireUser();
  let query = supabase.from(kinds[kind]).select("*").eq("user_id", userId).eq("id", id);
  if (kind === "decision") query = query.is("deleted_at", null);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return { supabase, userId, kind, id, record: data };
}
export async function GET(_request: Request, context: Context) {
  try {
    const { supabase, userId, kind, id, record } = await source(context);
    if (!record) return NextResponse.json({ error: "Record not found." }, { status: 404 });
    const lesson = await supabase.from("operating_lessons").select("id,title,status,statement").eq("user_id", userId).eq("source_table", kinds[kind]).eq("source_id", id).maybeSingle();
    if (lesson.error) throw lesson.error;
    const relationships: { title: string; route: string }[] = [];
    if (kind === "decision") {
      const groups = await Promise.all([
        supabase.from("operating_risks").select("id,title").eq("user_id", userId).eq("decision_id", id).limit(50),
        supabase.from("growth_experiments").select("id,name").eq("user_id", userId).eq("decision_id", id).limit(50),
        supabase.from("quality_incidents").select("id,title").eq("user_id", userId).eq("linked_entity_type", "decision").eq("linked_entity_id", id).limit(50),
      ]);
      for (const group of groups) if (group.error) throw group.error;
      for (const r of groups[0].data ?? []) relationships.push({ title: r.title, route: `/risks/register?record=${r.id}` });
      for (const r of groups[1].data ?? []) relationships.push({ title: r.name, route: `/experiments?record=${r.id}` });
      for (const r of groups[2].data ?? []) relationships.push({ title: r.title, route: `/issues/${r.id}` });
      if (record.project_id) relationships.push({ title: "Linked project", route: `/projects/${record.project_id}` });
    }
    return NextResponse.json({ record, lesson: lesson.data, relationships });
  } catch (e) { return apiError(e, "Workflow could not be loaded."); }
}
export async function PATCH(request: Request, context: Context) {
  try {
    const { supabase, userId, kind, id, record } = await source(context);
    if (!record) return NextResponse.json({ error: "Record not found." }, { status: 404 });
    let values: Record<string, unknown>;
    if (kind === "decision") {
      const workflow = decisionWorkflow.parse(await request.json());
      const review = workflow.review;
      values = { workflow, ...(review ? { actual_outcome: review.actual_outcome, variance: String(reviewVariance(workflow.expected_value, review.actual_metric) ?? "Not numerically comparable"), status: review.disposition === "reverse" ? "reversed" : review.disposition === "remain" ? "validated" : "under_review" } : {}) };
    } else if (kind === "issue") values = { postmortem: postmortemSchema.parse(await request.json()) };
    else return NextResponse.json({ error: "Use the source workspace to edit this record." }, { status: 405 });
    const { data, error } = await supabase.from(kinds[kind]).update(values).eq("user_id", userId).eq("id", id).select("*").single();
    if (error) throw error;
    return NextResponse.json({ record: data });
  } catch (e) { return apiError(e, "Workflow could not be saved. The local Tier 1 migration must be installed in the target database."); }
}
export async function POST(request: Request, context: Context) {
  try {
    const { supabase, kind, id, record } = await source(context);
    if (!record) return NextResponse.json({ error: "Record not found." }, { status: 404 });
    const { lesson } = z.object({ lesson: z.string().trim().min(5).max(10000) }).strict().parse(await request.json());
    const { data, error } = await supabase.rpc("tier1_propose_lesson", { source_kind: kind, source_key: id, lesson_statement: lesson });
    if (error) throw error;
    return NextResponse.json({ lessonId: data });
  } catch (e) { return apiError(e, "Lesson could not be proposed. The local Tier 1 migration must be installed in the target database."); }
}
