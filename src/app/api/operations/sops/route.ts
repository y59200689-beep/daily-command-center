import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, isMissingOptionalSchema } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";

const sopSchema = z.object({
  title: z.string().trim().min(1).max(240),
  purpose: z.string().trim().max(1000).optional().nullable(),
  description: z.string().optional().nullable(),
  status: z.enum(["draft", "active", "needs_review", "deprecated", "archived"]).default("draft"),
  category: z.string().trim().default("other"),
  owner_label: z.string().optional().nullable(),
  review_cadence: z.string().default("quarterly"),
  next_review_at: z.string().optional().nullable(),
  criticality: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  estimated_duration_minutes: z.number().int().positive().optional().nullable(),
  trigger: z.string().optional().nullable(),
  expected_outcome: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  steps: z.array(z.object({
    title: z.string().trim().min(1).max(240),
    instructions: z.string().optional().nullable(),
    required: z.boolean().default(true),
    step_type: z.enum(["action", "check", "decision", "approval", "reference", "wait", "manual_entry", "other"]).default("action"),
    estimated_minutes: z.number().int().nonnegative().optional().nullable(),
    linked_tool_or_system: z.string().optional().nullable(),
    linked_file_id: z.string().uuid().optional().nullable(),
    linked_note_id: z.string().uuid().optional().nullable(),
  })).optional().default([]),
  checklist: z.array(z.object({
    label: z.string().trim().min(1).max(240),
    required: z.boolean().default(true),
    instructions: z.string().optional().nullable(),
    evidence_required: z.boolean().default(false),
    completion_rule: z.string().optional().nullable(),
  })).optional().default([]),
});

export async function GET(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const status = searchParams.get("status");
    const q = searchParams.get("q");

    let query = supabase.from("operational_sops").select("*").eq("user_id", userId).order("updated_at", { ascending: false });
    if (category && category !== "all") query = query.eq("category", category);
    if (status && status !== "all") query = query.eq("status", status);
    if (q) query = query.ilike("title", `%${q.replaceAll("%", "\\%")}%`);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ sops: data ?? [] });
  } catch (error) {
    if (isMissingOptionalSchema(error)) return NextResponse.json({ sops: [], schemaStatus: "unavailable", schemaDependency: "V11 operations schema" });
    return apiError(error, "SOPs could not be loaded.");
  }
}

export async function POST(request: Request) {
  try {
    const input = sopSchema.parse(await request.json());
    const { supabase, userId } = await requireUser();

    // Insert SOP
    const { data: sop, error: sopError } = await supabase
      .from("operational_sops")
      .insert({
        user_id: userId,
        title: input.title,
        purpose: input.purpose,
        description: input.description,
        status: input.status,
        category: input.category,
        owner_label: input.owner_label,
        review_cadence: input.review_cadence,
        next_review_at: input.next_review_at,
        criticality: input.criticality,
        estimated_duration_minutes: input.estimated_duration_minutes,
        trigger: input.trigger,
        expected_outcome: input.expected_outcome,
        notes: input.notes,
        current_version: 1,
      })
      .select("*")
      .single();

    if (sopError) throw sopError;

    // Create Version 1
    const { data: version } = await supabase
      .from("sop_versions")
      .insert({
        user_id: userId,
        sop_id: sop.id,
        version_number: 1,
        change_summary: "Initial version",
        effective_date: new Date().toISOString().slice(0, 10),
        status: "active",
      })
      .select("*")
      .single();

    // Insert steps if provided
    if (input.steps.length > 0) {
      const stepsPayload = input.steps.map((s, idx) => ({
        user_id: userId,
        sop_id: sop.id,
        sop_version_id: version?.id ?? null,
        position: idx,
        title: s.title,
        instructions: s.instructions ?? null,
        required: s.required,
        step_type: s.step_type,
        estimated_minutes: s.estimated_minutes ?? null,
        linked_tool_or_system: s.linked_tool_or_system ?? null,
        linked_file_id: s.linked_file_id ?? null,
        linked_note_id: s.linked_note_id ?? null,
      }));
      await supabase.from("sop_steps").insert(stepsPayload as never);
    }

    // Insert checklist if provided
    if (input.checklist.length > 0) {
      const checklistPayload = input.checklist.map((c, idx) => ({
        user_id: userId,
        sop_id: sop.id,
        sop_version_id: version?.id ?? null,
        label: c.label,
        required: c.required,
        position: idx,
        instructions: c.instructions ?? null,
        evidence_required: c.evidence_required,
        completion_rule: c.completion_rule ?? null,
      }));
      await supabase.from("sop_checklist_items").insert(checklistPayload as never);
    }

    return NextResponse.json({ sop }, { status: 201 });
  } catch (error) {
    return apiError(error, "SOP could not be created.");
  }
}
