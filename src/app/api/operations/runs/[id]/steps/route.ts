import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";

const stepActionSchema = z.object({
  step_id: z.string().uuid(),
  status: z.enum(["completed", "skipped", "pending"]),
  notes: z.string().optional().nullable(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: runId } = await context.params;
    const input = stepActionSchema.parse(await request.json());
    const { supabase, userId } = await requireUser();

    const { data: run, error: runError } = await supabase
      .from("process_runs")
      .select("*")
      .eq("id", runId)
      .eq("user_id", userId)
      .maybeSingle();

    if (runError) throw runError;
    if (!run) return NextResponse.json({ error: "Run not found." }, { status: 404 });

    // If step is marked skipped, check if step is required
    if (input.status === "skipped" && run.sop_id) {
      const step = await supabase
        .from("sop_steps")
        .select("required,title")
        .eq("id", input.step_id)
        .eq("sop_id", run.sop_id)
        .eq("user_id", userId)
        .maybeSingle();

      if (step.data?.required && (!input.notes || !input.notes.trim())) {
        return NextResponse.json(
          { error: "Required step cannot be skipped without an explanation notes." },
          { status: 400 }
        );
      }
    }

    const currentProgress = (run.step_progress as Array<{ step_id: string; status: string; notes?: string }>) ?? [];
    const index = currentProgress.findIndex((p) => p.step_id === input.step_id);

    const updatedProgress = [...currentProgress];
    if (index >= 0) {
      updatedProgress[index] = { step_id: input.step_id, status: input.status, notes: input.notes ?? undefined };
    } else {
      updatedProgress.push({ step_id: input.step_id, status: input.status, notes: input.notes ?? undefined });
    }

    const { data: updatedRun, error: updateError } = await supabase
      .from("process_runs")
      .update({
        step_progress: updatedProgress,
        status: run.status === "planned" || run.status === "ready" ? "in_progress" : run.status,
        started_at: run.started_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", runId)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (updateError) throw updateError;

    await supabase.from("operational_timeline").insert({
      user_id: userId,
      run_id: runId,
      event_type: input.status === "completed" ? "step_completed" : "step_skipped",
      details: `Step ${input.status}: ${input.notes ?? ""}`,
    });

    return NextResponse.json({ run: updatedRun });
  } catch (error) {
    return apiError(error, "Step status could not be updated.");
  }
}
