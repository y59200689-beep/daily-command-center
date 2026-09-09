import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";
import { evaluateProcessHealth } from "@/lib/operations";

const processSchema = z.object({
  name: z.string().trim().min(1).max(240),
  description: z.string().optional().nullable(),
  status: z.enum(["draft", "active", "paused", "archived"]).default("active"),
  category: z.string().trim().default("other"),
  sop_id: z.string().uuid().optional().nullable(),
  default_priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  default_frequency: z.enum(["daily", "weekly", "monthly", "quarterly", "custom"]).optional().nullable(),
  default_duration_minutes: z.number().int().positive().optional().nullable(),
  trigger: z.string().optional().nullable(),
  owner_label: z.string().optional().nullable(),
  criticality: z.enum(["low", "medium", "high", "critical"]).default("medium"),
});

export async function GET(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const status = searchParams.get("status");

    let query = supabase
      .from("process_templates")
      .select("*,operational_sops(title,criticality,status)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (category && category !== "all") query = query.eq("category", category);
    if (status && status !== "all") query = query.eq("status", status);

    const [processesRes, runsRes, failuresRes, incidentsRes] = await Promise.all([
      query,
      supabase.from("process_runs").select("*").eq("user_id", userId),
      supabase.from("process_failures").select("*").eq("user_id", userId),
      supabase.from("quality_incidents").select("*").eq("user_id", userId),
    ]);

    if (processesRes.error) throw processesRes.error;

    const runs = runsRes.data ?? [];
    const failures = failuresRes.data ?? [];
    const incidents = incidentsRes.data ?? [];

    const processes = (processesRes.data ?? []).map((proc) => {
      const procRuns = runs.filter((r) => r.process_template_id === proc.id);
      const procFailures = failures.filter((f) => procRuns.some((pr) => pr.id === f.run_id));
      const procIncidents = incidents.filter((i) => i.process_template_id === proc.id);
      const health = evaluateProcessHealth(procRuns, procFailures, procIncidents);
      return {
        ...proc,
        health,
        runStats: {
          total: procRuns.length,
          completed: procRuns.filter((r) => r.status === "completed").length,
          failed: procRuns.filter((r) => r.status === "failed").length,
          blocked: procRuns.filter((r) => r.status === "blocked").length,
        },
      };
    });

    return NextResponse.json({ processes });
  } catch (error) {
    return apiError(error, "Process templates could not be loaded.");
  }
}

export async function POST(request: Request) {
  try {
    const input = processSchema.parse(await request.json());
    const { supabase, userId } = await requireUser();

    // If sop_id is provided, verify ownership
    if (input.sop_id) {
      const sop = await supabase
        .from("operational_sops")
        .select("id")
        .eq("id", input.sop_id)
        .eq("user_id", userId)
        .maybeSingle();
      if (!sop.data) return NextResponse.json({ error: "Linked SOP not found." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("process_templates")
      .insert({
        user_id: userId,
        name: input.name,
        description: input.description,
        status: input.status,
        category: input.category,
        sop_id: input.sop_id,
        default_priority: input.default_priority,
        default_frequency: input.default_frequency,
        default_duration_minutes: input.default_duration_minutes,
        trigger: input.trigger,
        owner_label: input.owner_label,
        criticality: input.criticality,
      })
      .select("*")
      .single();

    if (error) throw error;
    return NextResponse.json({ process: data }, { status: 201 });
  } catch (error) {
    return apiError(error, "Process template could not be created.");
  }
}
