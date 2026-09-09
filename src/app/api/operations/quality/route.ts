import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";

const createCheckSchema = z.object({
  type: z.literal("check"),
  name: z.string().trim().min(1).max(240),
  description: z.string().optional().nullable(),
  check_type: z.enum(["manual", "automated", "peer_review", "metric_threshold", "other"]).default("manual"),
  pass_criteria: z.string().trim().min(1),
  sop_id: z.string().uuid(),
  process_template_id: z.string().uuid().optional().nullable(),
  required: z.boolean().default(true),
  severity_if_failed: z.enum(["low", "medium", "high", "critical"]).default("high"),
  evidence_required: z.boolean().default(false),
});

const createIncidentSchema = z.object({
  type: z.literal("incident"),
  title: z.string().trim().min(1).max(240),
  description: z.string().trim().min(1),
  severity: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  status: z.enum(["open", "investigating", "corrective_action", "monitoring", "resolved", "archived"]).default("open"),
  process_template_id: z.string().uuid().optional().nullable(),
  run_id: z.string().uuid().optional().nullable(),
  sop_id: z.string().uuid().optional().nullable(),
  root_cause: z.string().optional().nullable(),
  corrective_action: z.string().optional().nullable(),
  preventive_action: z.string().optional().nullable(),
  create_task: z.boolean().optional(),
  task_title: z.string().optional().nullable(),
  task_due_date: z.string().optional().nullable(),
});

const recordExecutionSchema = z.object({
  type: z.literal("execution"),
  run_id: z.string().uuid(),
  quality_check_id: z.string().uuid(),
  status: z.enum(["pass", "fail", "needs_review", "not_applicable"]),
  evidence_text: z.string().optional().nullable(),
  evidence_attachment_id: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function GET() {
  try {
    const { supabase, userId } = await requireUser();



    const [checksRes, incidentsRes, executionsRes] = await Promise.all([
      supabase.from("quality_checks").select("*,operational_sops(title)").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("quality_incidents").select("*,process_templates(name),process_runs(title),tasks(id,title,status)").eq("user_id", userId).order("detected_at", { ascending: false }),
      supabase.from("quality_executions").select("*,quality_checks(*),process_runs(title)").eq("user_id", userId).order("executed_at", { ascending: false }).limit(50),
    ]);

    if (checksRes.error) throw checksRes.error;
    if (incidentsRes.error) throw incidentsRes.error;

    return NextResponse.json({
      checks: checksRes.data ?? [],
      incidents: incidentsRes.data ?? [],
      executions: executionsRes.data ?? [],
    });
  } catch (error) {
    return apiError(error, "Quality records could not be loaded.");
  }
}

export async function POST(request: Request) {
  try {
    const raw = await request.json();
    const { supabase, userId } = await requireUser();

    if (raw.type === "check") {
      const input = createCheckSchema.parse(raw);
      const { data, error } = await supabase
        .from("quality_checks")
        .insert({
          user_id: userId,
          name: input.name,
          description: input.description,
          check_type: input.check_type,
          pass_criteria: input.pass_criteria,
          sop_id: input.sop_id,
          process_template_id: input.process_template_id ?? null,
          required: input.required,
          severity_if_failed: input.severity_if_failed,
          evidence_required: input.evidence_required,
        })
        .select("*")
        .single();

      if (error) throw error;
      return NextResponse.json({ check: data }, { status: 201 });
    }

    if (raw.type === "execution") {
      const input = recordExecutionSchema.parse(raw);
      const { data, error } = await supabase
        .from("quality_executions")
        .insert({
          user_id: userId,
          run_id: input.run_id,
          quality_check_id: input.quality_check_id,
          status: input.status,
          evidence_text: input.evidence_text ?? null,
          evidence_attachment_id: input.evidence_attachment_id ?? null,
          notes: input.notes ?? null,
          executed_at: new Date().toISOString(),
        })
        .select("*")
        .single();

      if (error) throw error;

      if (input.status === "fail") {
        await supabase.from("operational_timeline").insert({
          user_id: userId,
          run_id: input.run_id,
          event_type: "quality_failure",
          details: `Quality check failed. ${input.notes ?? ""}`,
        });
      }

      return NextResponse.json({ execution: data }, { status: 201 });
    }

    if (raw.type === "incident") {
      const input = createIncidentSchema.parse(raw);
      let correctiveTaskId: string | null = null;

      if (input.create_task && input.task_title) {
        const { data: task } = await supabase
          .from("tasks")
          .insert({
            user_id: userId,
            title: input.task_title,
            due_date: input.task_due_date ?? null,
            priority: input.severity === "critical" ? "urgent" : input.severity === "high" ? "high" : "medium",
            status: "planned",
          } as never)
          .select("id")
          .single();
        if (task) correctiveTaskId = task.id;
      }

      const { data, error } = await supabase
        .from("quality_incidents")
        .insert({
          user_id: userId,
          title: input.title,
          description: input.description,
          severity: input.severity,
          status: input.status,
          process_template_id: input.process_template_id ?? null,
          run_id: input.run_id ?? null,
          sop_id: input.sop_id ?? null,
          root_cause: input.root_cause ?? null,
          corrective_action: input.corrective_action ?? null,
          preventive_action: input.preventive_action ?? null,
          corrective_task_id: correctiveTaskId,
        })
        .select("*")
        .single();

      if (error) throw error;

      if (input.run_id) {
        await supabase.from("operational_timeline").insert({
          user_id: userId,
          run_id: input.run_id,
          event_type: "incident_created",
          details: `Incident: ${input.title}`,
        });
      }

      return NextResponse.json({ incident: data }, { status: 201 });
    }

    return NextResponse.json({ error: "Invalid record type." }, { status: 400 });
  } catch (error) {
    return apiError(error, "Quality operation failed.");
  }
}
