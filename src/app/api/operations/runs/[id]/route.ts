import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, isMissingOptionalSchema } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";
import { validateRunCompletion } from "@/lib/operations";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { supabase, userId } = await requireUser();

    const { data: run, error: runError } = await supabase
      .from("process_runs")
      .select("*,process_templates(*),operational_sops(*)")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();

    if (runError) throw runError;
    if (!run) return NextResponse.json({ error: "Run not found." }, { status: 404 });

    const [stepsRes, checklistRes, blockersRes, failuresRes, qualityExecsRes, timelineRes] = await Promise.all([
      run.sop_id ? supabase.from("sop_steps").select("*").eq("sop_id", run.sop_id).eq("user_id", userId).order("position") : Promise.resolve({ data: [] }),
      supabase.from("run_checklist_items").select("*").eq("run_id", id).eq("user_id", userId).order("position"),
      supabase.from("operational_blockers").select("*").eq("run_id", id).eq("user_id", userId).order("blocked_since", { ascending: false }),
      supabase.from("process_failures").select("*").eq("run_id", id).eq("user_id", userId).order("detected_at", { ascending: false }),
      supabase.from("quality_executions").select("*,quality_checks(*)").eq("run_id", id).eq("user_id", userId),
      supabase.from("operational_timeline").select("*").eq("run_id", id).eq("user_id", userId).order("created_at", { ascending: false }),
    ]);

    return NextResponse.json({
      run,
      steps: stepsRes.data ?? [],
      checklist: checklistRes.data ?? [],
      blockers: blockersRes.data ?? [],
      failures: failuresRes.data ?? [],
      qualityExecutions: qualityExecsRes.data ?? [],
      timeline: timelineRes.data ?? [],
    });
  } catch (error) {
    if (isMissingOptionalSchema(error)) return NextResponse.json({ schemaStatus: "unavailable", schemaDependency: "V11 operations schema" });
    return apiError(error, "Run detail could not be loaded.");
  }
}

const updateRunSchema = z.object({
  status: z.enum(["planned", "ready", "in_progress", "blocked", "needs_review", "completed", "failed", "cancelled"]).optional(),
  title: z.string().trim().min(1).max(240).optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  due_at: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  result_summary: z.string().optional().nullable(),
  failure_reason: z.string().optional().nullable(),
  failure_type: z.enum(["human_error", "missing_information", "dependency_unavailable", "tool_failure", "integration_failure", "quality_failure", "timing", "approval_blocked", "external_dependency", "unknown", "other"]).optional(),
  blocker_description: z.string().optional(),
  blocker_severity: z.enum(["low", "medium", "high", "critical"]).optional(),
  unblock_id: z.string().uuid().optional(),
  completion_override: z.boolean().optional(),
  completion_override_reason: z.string().optional().nullable(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const input = updateRunSchema.parse(await request.json());
    const { supabase, userId } = await requireUser();

    const { data: run, error: fetchError } = await supabase
      .from("process_runs")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!run) return NextResponse.json({ error: "Run not found." }, { status: 404 });

    const now = new Date().toISOString();
    let status = input.status ?? run.status;
    let started_at = run.started_at;
    let completed_at = run.completed_at;

    // Handle Start
    if (input.status === "in_progress" && !started_at) {
      started_at = now;
      await supabase.from("operational_timeline").insert({
        user_id: userId,
        run_id: id,
        event_type: "started",
        details: "Process execution started.",
      });
    }

    // Handle Blocker addition
    if (input.status === "blocked" && input.blocker_description) {
      await supabase.from("operational_blockers").insert({
        user_id: userId,
        run_id: id,
        description: input.blocker_description,
        severity: input.blocker_severity ?? run.priority,
        blocked_since: now,
      });
      await supabase.from("operational_timeline").insert({
        user_id: userId,
        run_id: id,
        event_type: "blocked",
        details: input.blocker_description,
      });
    }

    // Handle Unblock
    if (input.unblock_id) {
      await supabase
        .from("operational_blockers")
        .update({ resolved_at: now, resolution: "Resolved" } as never)
        .eq("id", input.unblock_id)
        .eq("user_id", userId);
      status = "in_progress";
      await supabase.from("operational_timeline").insert({
        user_id: userId,
        run_id: id,
        event_type: "unblocked",
        details: "Blocker resolved.",
      });
    }

    // Handle Failure
    if (input.status === "failed") {
      completed_at = now;
      await supabase.from("process_failures").insert({
        user_id: userId,
        run_id: id,
        failure_type: input.failure_type ?? "unknown",
        description: input.failure_reason ?? "Run marked as failed",
        severity: run.priority,
        detected_at: now,
      });
      await supabase.from("operational_timeline").insert({
        user_id: userId,
        run_id: id,
        event_type: "failed",
        details: input.failure_reason ?? "Process execution failed.",
      });
    }

    // Handle Completion Validation
    if (input.status === "completed") {
      const [stepsRes, checklistRes, qualityExecsRes] = await Promise.all([
        run.sop_id ? supabase.from("sop_steps").select("*").eq("sop_id", run.sop_id).eq("user_id", userId) : Promise.resolve({ data: [] }),
        supabase.from("run_checklist_items").select("*").eq("run_id", id).eq("user_id", userId),
        supabase.from("quality_executions").select("*,quality_checks(name,severity_if_failed)").eq("run_id", id).eq("user_id", userId),
      ]);

      const steps = stepsRes.data ?? [];
      const checklist = checklistRes.data ?? [];
      const qualityExecs = qualityExecsRes.data ?? [];
      const stepProgress = (run.step_progress as Array<{ step_id: string; status: "completed" | "skipped" | "pending" }>) ?? [];

      const validation = validateRunCompletion(
        steps,
        stepProgress,
        checklist,
        qualityExecs,
        Boolean(input.completion_override),
        input.completion_override_reason
      );

      if (!validation.canComplete) {
        return NextResponse.json(
          { error: "Run completion criteria not met.", blockers: validation.blockers },
          { status: 400 }
        );
      }

      completed_at = now;
      await supabase.from("operational_timeline").insert({
        user_id: userId,
        run_id: id,
        event_type: input.completion_override ? "override" : "completed",
        details: input.completion_override
          ? `Completed with override: ${input.completion_override_reason}`
          : "Process execution successfully completed.",
      });
    }

    const { data: updatedRun, error: updateError } = await supabase
      .from("process_runs")
      .update({
        status,
        title: input.title ?? run.title,
        priority: input.priority ?? run.priority,
        due_at: input.due_at !== undefined ? input.due_at : run.due_at,
        notes: input.notes !== undefined ? input.notes : run.notes,
        result_summary: input.result_summary !== undefined ? input.result_summary : run.result_summary,
        failure_reason: input.failure_reason !== undefined ? input.failure_reason : run.failure_reason,
        started_at,
        completed_at,
        completion_override: input.completion_override ?? run.completion_override,
        completion_override_reason: input.completion_override_reason ?? run.completion_override_reason,
        updated_at: now,
      } as never)
      .eq("id", id)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({ run: updatedRun });
  } catch (error) {
    return apiError(error, "Run could not be updated.");
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { supabase, userId } = await requireUser();

    const { error } = await supabase
      .from("process_runs")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error, "Process run could not be deleted.");
  }
}
