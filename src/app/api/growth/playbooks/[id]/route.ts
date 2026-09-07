import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { supabase, userId } = await requireUser();

    const { data: playbook, error } = await supabase
      .from("sales_playbooks")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    if (!playbook) return NextResponse.json({ error: "Playbook not found." }, { status: 404 });

    const { data: runs, error: runsError } = await supabase
      .from("playbook_runs")
      .select("*")
      .eq("playbook_id", id)
      .eq("user_id", userId)
      .order("started_at", { ascending: false });

    if (runsError) throw runsError;

    return NextResponse.json({ playbook, runs: runs ?? [] });
  } catch (error) {
    return apiError(error, "Playbook could not be loaded.");
  }
}

const runActionSchema = z.object({
  action: z.enum(["start_run", "complete_step", "skip_step", "pause", "resume", "cancel", "update_playbook"]),
  runId: z.string().uuid().optional(),
  target_type: z.enum(["lead", "opportunity", "client"]).optional(),
  target_id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(240).optional(),
  purpose: z.string().trim().max(1000).optional().nullable(),
  steps: z.array(z.record(z.string(), z.unknown())).optional(),
  status: z.enum(["active", "archived"]).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const input = runActionSchema.parse(await request.json());
    const { supabase, userId } = await requireUser();

    if (input.action === "update_playbook") {
      const updates: Record<string, unknown> = {};
      if (input.name !== undefined) updates.name = input.name;
      if (input.purpose !== undefined) updates.purpose = input.purpose;
      if (input.steps !== undefined) updates.steps = input.steps;
      if (input.status !== undefined) updates.status = input.status;

      const { data, error } = await supabase
        .from("sales_playbooks")
        .update(updates)
        .eq("id", id)
        .eq("user_id", userId)
        .select("*")
        .single();
      if (error) throw error;
      return NextResponse.json({ playbook: data });
    }

    if (input.action === "start_run") {
      if (!input.target_type || !input.target_id) {
        return NextResponse.json({ error: "target_type and target_id are required to start a run." }, { status: 400 });
      }

      const { data: playbook, error: pbError } = await supabase
        .from("sales_playbooks")
        .select("steps")
        .eq("id", id)
        .eq("user_id", userId)
        .single();
      if (pbError) throw pbError;

      const steps = (playbook.steps as Array<Record<string, unknown>>) ?? [];
      const initialStepStates = steps.map((s, idx) => ({
        index: idx,
        status: idx === 0 ? "active" : "pending",
        title: s.title,
        day: s.day,
        updated_at: new Date().toISOString(),
      }));

      const { data: run, error: runError } = await supabase
        .from("playbook_runs")
        .insert({
          user_id: userId,
          playbook_id: id,
          target_type: input.target_type,
          target_id: input.target_id,
          current_step: 0,
          status: "active",
          step_states: initialStepStates,
          started_at: new Date().toISOString(),
        })
        .select("*")
        .single();
      if (runError) throw runError;
      return NextResponse.json({ run }, { status: 201 });
    }

    if (["complete_step", "skip_step", "pause", "resume", "cancel"].includes(input.action)) {
      if (!input.runId) {
        return NextResponse.json({ error: "runId is required for this action." }, { status: 400 });
      }

      const { data: run, error: runErr } = await supabase
        .from("playbook_runs")
        .select("*")
        .eq("id", input.runId)
        .eq("user_id", userId)
        .single();
      if (runErr) throw runErr;

      let currentStep = run.current_step;
      let runStatus = run.status;
      const stepStates = (run.step_states as Array<Record<string, unknown>>) ?? [];
      const now = new Date().toISOString();

      if (input.action === "pause") {
        runStatus = "paused";
      } else if (input.action === "resume") {
        runStatus = "active";
      } else if (input.action === "cancel") {
        runStatus = "cancelled";
      } else if (input.action === "complete_step" || input.action === "skip_step") {
        if (stepStates[currentStep]) {
          stepStates[currentStep].status = input.action === "complete_step" ? "completed" : "skipped";
          stepStates[currentStep].completed_at = now;
        }
        if (currentStep + 1 < stepStates.length) {
          currentStep += 1;
          stepStates[currentStep].status = "active";
        } else {
          runStatus = "completed";
        }
      }

      const { data: updatedRun, error: updateErr } = await supabase
        .from("playbook_runs")
        .update({
          current_step: currentStep,
          status: runStatus,
          step_states: stepStates,
          completed_at: runStatus === "completed" ? now : run.completed_at,
          cancelled_at: runStatus === "cancelled" ? now : run.cancelled_at,
        })
        .eq("id", input.runId)
        .eq("user_id", userId)
        .select("*")
        .single();
      if (updateErr) throw updateErr;

      return NextResponse.json({ run: updatedRun });
    }

    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  } catch (error) {
    return apiError(error, "Playbook update failed.");
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { supabase, userId } = await requireUser();

    const { data, error } = await supabase
      .from("sales_playbooks")
      .update({ status: "archived" })
      .eq("id", id)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error) throw error;
    return NextResponse.json({ playbook: data });
  } catch (error) {
    return apiError(error, "Playbook archiving failed.");
  }
}
