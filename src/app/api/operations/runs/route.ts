import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";

const runCreateSchema = z.object({
  title: z.string().trim().min(1).max(240),
  process_template_id: z.string().uuid().optional().nullable(),
  sop_id: z.string().uuid().optional().nullable(),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  trigger_source: z.string().optional().nullable(),
  linked_entity_type: z.string().optional().nullable(),
  linked_entity_id: z.string().uuid().optional().nullable(),
  due_at: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  status: z.enum(["planned", "ready", "in_progress", "blocked", "needs_review", "completed", "failed", "cancelled"]).default("planned"),
});

export async function GET(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const processId = searchParams.get("processId");

    let query = supabase
      .from("process_runs")
      .select("*,process_templates(name,category),operational_sops(title)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (status && status !== "all") query = query.eq("status", status);
    if (priority && priority !== "all") query = query.eq("priority", priority);
    if (processId) query = query.eq("process_template_id", processId);

    const { data, error } = await query.limit(100);
    if (error) throw error;

    return NextResponse.json({ runs: data ?? [] });
  } catch (error) {
    return apiError(error, "Process runs could not be loaded.");
  }
}

export async function POST(request: Request) {
  try {
    const input = runCreateSchema.parse(await request.json());
    const { supabase, userId } = await requireUser();

    let sopId = input.sop_id;
    let sopVersionNumber = 1;
    let sopVersionId: string | null = null;

    // If process_template_id is provided and sop_id not explicitly set, fetch sop from process template
    if (input.process_template_id && !sopId) {
      const proc = await supabase
        .from("process_templates")
        .select("sop_id,default_priority")
        .eq("id", input.process_template_id)
        .eq("user_id", userId)
        .maybeSingle();
      if (proc.data?.sop_id) {
        sopId = proc.data.sop_id;
      }
    }

    // Get current SOP version if sopId exists
    if (sopId) {
      const sop = await supabase
        .from("operational_sops")
        .select("id,current_version")
        .eq("id", sopId)
        .eq("user_id", userId)
        .maybeSingle();

      if (sop.data) {
        sopVersionNumber = sop.data.current_version ?? 1;
        const version = await supabase
          .from("sop_versions")
          .select("id")
          .eq("sop_id", sopId)
          .eq("version_number", sopVersionNumber)
          .eq("user_id", userId)
          .maybeSingle();
        if (version.data) {
          sopVersionId = version.data.id;
        }
      }
    }

    // Insert Process Run
    const { data: run, error: runError } = await supabase
      .from("process_runs")
      .insert({
        user_id: userId,
        process_template_id: input.process_template_id ?? null,
        sop_id: sopId ?? null,
        sop_version_id: sopVersionId,
        sop_version_number: sopVersionNumber,
        title: input.title,
        status: input.status,
        priority: input.priority,
        trigger_source: input.trigger_source ?? "manual",
        linked_entity_type: input.linked_entity_type ?? null,
        linked_entity_id: input.linked_entity_id ?? null,
        due_at: input.due_at ?? null,
        notes: input.notes ?? null,
        started_at: input.status === "in_progress" ? new Date().toISOString() : null,
      })
      .select("*")
      .single();

    if (runError) throw runError;

    // Instantiate checklist items from SOP checklist
    if (sopId) {
      const { data: sopChecklist } = await supabase
        .from("sop_checklist_items")
        .select("*")
        .eq("sop_id", sopId)
        .eq("user_id", userId)
        .order("position");

      if (sopChecklist && sopChecklist.length > 0) {
        const runChecklistPayload = sopChecklist.map((item, idx) => ({
          user_id: userId,
          run_id: run.id,
          checklist_item_id: item.id,
          label: item.label,
          required: item.required,
          position: idx,
          completed: false,
          evidence_required: item.evidence_required,
        }));
        await supabase.from("run_checklist_items").insert(runChecklistPayload as never);
      }
    }

    // Record timeline entry
    await supabase.from("operational_timeline").insert({
      user_id: userId,
      run_id: run.id,
      event_type: "created",
      details: `Run "${run.title}" created.`,
    });

    return NextResponse.json({ run }, { status: 201 });
  } catch (error) {
    return apiError(error, "Process run could not be created.");
  }
}
