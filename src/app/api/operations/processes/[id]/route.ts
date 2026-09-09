import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";
import { evaluateProcessHealth, detectRepeatedFailures } from "@/lib/operations";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { supabase, userId } = await requireUser();

    const [processRes, runsRes, failuresRes, incidentsRes, improvementsRes] = await Promise.all([
      supabase.from("process_templates").select("*,operational_sops(*)").eq("id", id).eq("user_id", userId).maybeSingle(),
      supabase.from("process_runs").select("*").eq("process_template_id", id).eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
      supabase.from("process_failures").select("*").eq("user_id", userId),
      supabase.from("quality_incidents").select("*").eq("process_template_id", id).eq("user_id", userId),
      supabase.from("process_improvements").select("*").eq("process_template_id", id).eq("user_id", userId),
    ]);

    if (processRes.error) throw processRes.error;
    if (!processRes.data) return NextResponse.json({ error: "Process not found." }, { status: 404 });

    const runs = runsRes.data ?? [];
    const runIds = new Set(runs.map((r) => r.id));
    const failures = (failuresRes.data ?? []).filter((f) => f.run_id && runIds.has(f.run_id));
    const incidents = incidentsRes.data ?? [];
    const health = evaluateProcessHealth(runs, failures, incidents);
    const repeatedFailures = detectRepeatedFailures(failures);

    return NextResponse.json({
      process: processRes.data,
      runs,
      failures,
      incidents,
      improvements: improvementsRes.data ?? [],
      health,
      repeatedFailures,
    });
  } catch (error) {
    return apiError(error, "Process detail could not be loaded.");
  }
}

const updateSchema = z.object({
  name: z.string().trim().min(1).max(240).optional(),
  description: z.string().optional().nullable(),
  status: z.enum(["draft", "active", "paused", "archived"]).optional(),
  category: z.string().trim().optional(),
  sop_id: z.string().uuid().optional().nullable(),
  default_priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  default_frequency: z.enum(["daily", "weekly", "monthly", "quarterly", "custom"]).optional().nullable(),
  default_duration_minutes: z.number().int().positive().optional().nullable(),
  trigger: z.string().optional().nullable(),
  owner_label: z.string().optional().nullable(),
  criticality: z.enum(["low", "medium", "high", "critical"]).optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const input = updateSchema.parse(await request.json());
    const { supabase, userId } = await requireUser();

    if (input.sop_id) {
      const sop = await supabase.from("operational_sops").select("id").eq("id", input.sop_id).eq("user_id", userId).maybeSingle();
      if (!sop.data) return NextResponse.json({ error: "Linked SOP not found." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("process_templates")
      .update(input as never)
      .eq("id", id)
      .eq("user_id", userId)
      .select("*")
      .maybeSingle();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Process not found." }, { status: 404 });

    return NextResponse.json({ process: data });
  } catch (error) {
    return apiError(error, "Process could not be updated.");
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { supabase, userId } = await requireUser();

    const { error } = await supabase
      .from("process_templates")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error, "Process could not be deleted.");
  }
}
