import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";

const dependencyStateValues = ["ready", "waiting", "blocked", "unavailable", "unknown"] as const;
const dependencyTypeValues = [
  "process", "task", "project", "client", "opportunity", "supplier", "product",
  "campaign", "calendar_event", "integration", "tool_system", "approval",
  "strategic_milestone", "other",
] as const;
const sourceTypeValues = ["sop", "process", "run"] as const;

const createSchema = z.object({
  source_type: z.enum(sourceTypeValues),
  source_id: z.string().uuid(),
  dependency_type: z.enum(dependencyTypeValues),
  dependency_id: z.string().uuid().optional().nullable(),
  dependency_label: z.string().trim().min(1).max(240),
  state: z.enum(dependencyStateValues).default("unknown"),
  notes: z.string().optional().nullable(),
});

const patchSchema = z.object({
  state: z.enum(dependencyStateValues).optional(),
  notes: z.string().optional().nullable(),
  dependency_label: z.string().trim().min(1).max(240).optional(),
});

export async function GET(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const url = new URL(request.url);
    const sourceType = url.searchParams.get("source_type");
    const sourceId = url.searchParams.get("source_id");

    let query = supabase
      .from("operational_dependencies")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (sourceType) query = query.eq("source_type", sourceType);
    if (sourceId) query = query.eq("source_id", sourceId);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ dependencies: data ?? [] });
  } catch (error) {
    return apiError(error, "Dependencies could not be loaded.");
  }
}

export async function POST(request: Request) {
  try {
    const input = createSchema.parse(await request.json());
    const { supabase, userId } = await requireUser();

    const { data, error } = await supabase
      .from("operational_dependencies")
      .insert({
        user_id: userId,
        source_type: input.source_type,
        source_id: input.source_id,
        dependency_type: input.dependency_type,
        dependency_id: input.dependency_id ?? null,
        dependency_label: input.dependency_label,
        state: input.state,
        notes: input.notes ?? null,
      })
      .select("*")
      .single();

    if (error) throw error;
    return NextResponse.json({ dependency: data }, { status: 201 });
  } catch (error) {
    return apiError(error, "Dependency could not be created.");
  }
}

export async function PATCH(request: Request) {
  try {
    const url = new URL(request.url);
    const depId = url.searchParams.get("id");
    if (!depId) return NextResponse.json({ error: "id is required." }, { status: 400 });

    const input = patchSchema.parse(await request.json());
    const { supabase, userId } = await requireUser();

    const updates: Record<string, unknown> = {};
    if (input.state !== undefined) updates.state = input.state;
    if (input.notes !== undefined) updates.notes = input.notes;
    if (input.dependency_label !== undefined) updates.dependency_label = input.dependency_label;

    const { data, error } = await supabase
      .from("operational_dependencies")
      .update(updates)
      .eq("id", depId)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error) throw error;
    return NextResponse.json({ dependency: data });
  } catch (error) {
    return apiError(error, "Dependency could not be updated.");
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const depId = url.searchParams.get("id");
    if (!depId) return NextResponse.json({ error: "id is required." }, { status: 400 });

    const { supabase, userId } = await requireUser();

    const { error } = await supabase
      .from("operational_dependencies")
      .delete()
      .eq("id", depId)
      .eq("user_id", userId);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error, "Dependency could not be deleted.");
  }
}
