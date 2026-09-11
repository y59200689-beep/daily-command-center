import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, isMissingOptionalSchema } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { supabase, userId } = await requireUser();

    const [sopRes, stepsRes, checklistRes, versionsRes, runsRes, qualityChecksRes, runbooksRes, linksRes] = await Promise.all([
      supabase.from("operational_sops").select("*").eq("id", id).eq("user_id", userId).maybeSingle(),
      supabase.from("sop_steps").select("*").eq("sop_id", id).eq("user_id", userId).order("position"),
      supabase.from("sop_checklist_items").select("*").eq("sop_id", id).eq("user_id", userId).order("position"),
      supabase.from("sop_versions").select("*").eq("sop_id", id).eq("user_id", userId).order("version_number", { ascending: false }),
      supabase.from("process_runs").select("*").eq("sop_id", id).eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
      supabase.from("quality_checks").select("*").eq("sop_id", id).eq("user_id", userId),
      supabase.from("operational_runbooks").select("*").eq("sop_id", id).eq("user_id", userId),
      supabase.from("operational_entity_links").select("*").eq("operational_type", "sop").eq("operational_id", id).eq("user_id", userId),
    ]);

    if (sopRes.error) throw sopRes.error;
    if (!sopRes.data) return NextResponse.json({ error: "SOP not found." }, { status: 404 });

    return NextResponse.json({
      sop: sopRes.data,
      steps: stepsRes.data ?? [],
      checklist: checklistRes.data ?? [],
      versions: versionsRes.data ?? [],
      runs: runsRes.data ?? [],
      qualityChecks: qualityChecksRes.data ?? [],
      runbooks: runbooksRes.data ?? [],
      links: linksRes.data ?? [],
    });
  } catch (error) {
    if (isMissingOptionalSchema(error)) return NextResponse.json({ schemaStatus: "unavailable", schemaDependency: "V11 operations schema" });
    return apiError(error, "SOP detail could not be loaded.");
  }
}

const updateSchema = z.object({
  title: z.string().trim().min(1).max(240).optional(),
  purpose: z.string().trim().max(1000).optional().nullable(),
  description: z.string().optional().nullable(),
  status: z.enum(["draft", "active", "needs_review", "deprecated", "archived"]).optional(),
  category: z.string().trim().optional(),
  owner_label: z.string().optional().nullable(),
  review_cadence: z.string().optional(),
  next_review_at: z.string().optional().nullable(),
  last_reviewed_at: z.string().optional().nullable(),
  criticality: z.enum(["low", "medium", "high", "critical"]).optional(),
  estimated_duration_minutes: z.number().int().positive().optional().nullable(),
  trigger: z.string().optional().nullable(),
  expected_outcome: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  mark_reviewed: z.boolean().optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const input = updateSchema.parse(await request.json());
    const { supabase, userId } = await requireUser();

    const updatePayload: Record<string, unknown> = { ...input };
    delete updatePayload.mark_reviewed;


    // If marked reviewed, calculate next review date based on cadence
    if (input.mark_reviewed) {
      const now = new Date();
      updatePayload.last_reviewed_at = now.toISOString();
      updatePayload.status = "active";
      const cadence = input.review_cadence ?? "quarterly";
      const days = cadence === "monthly" ? 30 : cadence === "biannual" ? 180 : cadence === "annual" ? 365 : 90;
      const nextDate = new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
      updatePayload.next_review_at = nextDate;
    }

    const { data, error } = await supabase
      .from("operational_sops")
      .update(updatePayload as never)
      .eq("id", id)
      .eq("user_id", userId)
      .select("*")
      .maybeSingle();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: "SOP not found." }, { status: 404 });

    return NextResponse.json({ sop: data });
  } catch (error) {
    return apiError(error, "SOP could not be updated.");
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { supabase, userId } = await requireUser();

    const { error } = await supabase
      .from("operational_sops")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error, "SOP could not be deleted.");
  }
}
