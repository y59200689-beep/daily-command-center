import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";

const createSchema = z.object({
  from_label: z.string().trim().min(1).max(240),
  to_label: z.string().trim().min(1).max(240),
  handoff_description: z.string().trim().min(1).max(2000),
  expected_handoff_time: z.string().datetime({ offset: true }).optional().nullable(),
  notes: z.string().optional().nullable(),
});

const patchSchema = z.object({
  accepted: z.boolean().optional(),
  notes: z.string().optional().nullable(),
});

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: runId } = await context.params;
    const { supabase, userId } = await requireUser();

    // Verify run ownership
    const { data: run } = await supabase
      .from("process_runs")
      .select("id")
      .eq("id", runId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!run) return NextResponse.json({ error: "Run not found." }, { status: 404 });

    const { data, error } = await supabase
      .from("operational_handoffs")
      .select("*")
      .eq("run_id", runId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ handoffs: data ?? [] });
  } catch (error) {
    return apiError(error, "Handoffs could not be loaded.");
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: runId } = await context.params;
    const input = createSchema.parse(await request.json());
    const { supabase, userId } = await requireUser();

    // Verify run ownership
    const { data: run } = await supabase
      .from("process_runs")
      .select("id")
      .eq("id", runId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!run) return NextResponse.json({ error: "Run not found." }, { status: 404 });

    const { data, error } = await supabase
      .from("operational_handoffs")
      .insert({
        user_id: userId,
        run_id: runId,
        from_label: input.from_label,
        to_label: input.to_label,
        handoff_description: input.handoff_description,
        expected_handoff_time: input.expected_handoff_time ?? null,
        notes: input.notes ?? null,
      })
      .select("*")
      .single();

    if (error) throw error;
    return NextResponse.json({ handoff: data }, { status: 201 });
  } catch (error) {
    return apiError(error, "Handoff could not be created.");
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: runId } = await context.params;
    const url = new URL(request.url);
    const handoffId = url.searchParams.get("handoff_id");
    if (!handoffId) return NextResponse.json({ error: "handoff_id is required." }, { status: 400 });

    const input = patchSchema.parse(await request.json());
    const { supabase, userId } = await requireUser();

    // Verify ownership via run
    const { data: handoff } = await supabase
      .from("operational_handoffs")
      .select("id")
      .eq("id", handoffId)
      .eq("user_id", userId)
      .eq("run_id", runId)
      .maybeSingle();
    if (!handoff) return NextResponse.json({ error: "Handoff not found." }, { status: 404 });

    const updates: Record<string, unknown> = {};
    if (input.accepted !== undefined) {
      updates.accepted = input.accepted;
      updates.accepted_at = input.accepted ? new Date().toISOString() : null;
    }
    if (input.notes !== undefined) updates.notes = input.notes;

    const { data, error } = await supabase
      .from("operational_handoffs")
      .update(updates)
      .eq("id", handoffId)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error) throw error;
    return NextResponse.json({ handoff: data });
  } catch (error) {
    return apiError(error, "Handoff could not be updated.");
  }
}
