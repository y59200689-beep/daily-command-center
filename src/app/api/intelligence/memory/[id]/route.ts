import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { verifyMemorySource } from "@/lib/intelligence/memory";
import { requireUser } from "@/lib/supabase/server";

type Context = { params: Promise<{ id: string }> };
const updateInput = z.object({
  action: z.enum(["update", "archive", "outdated"]).default("update"),
  memoryType: z.enum(["preference", "project_context", "client_context", "decision", "pattern", "routine", "fact"]).optional(),
  title: z.string().trim().min(1).max(240).optional(),
  summary: z.string().trim().min(1).max(10_000).optional(),
  sourceEntityType: z.enum(["task", "project", "client", "note", "decision", "content", "campaign", "invoice", "goal", "calendar_event"]).nullable().optional(),
  sourceEntityId: z.uuid().nullable().optional(),
  confidence: z.number().min(0).max(1).optional(),
}).strict().superRefine((value, context) => {
  const sourceChanged = value.sourceEntityType !== undefined || value.sourceEntityId !== undefined;
  if (sourceChanged && Boolean(value.sourceEntityType) !== Boolean(value.sourceEntityId)) context.addIssue({ code: "custom", path: ["sourceEntityId"], message: "Choose both a source type and source record." });
});

export async function PATCH(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    z.uuid().parse(id);
    const input = updateInput.parse(await request.json());
    const { supabase, userId } = await requireUser();
    if (input.sourceEntityType !== undefined || input.sourceEntityId !== undefined) await verifyMemorySource(supabase, userId, input.sourceEntityType, input.sourceEntityId);
    const values: Record<string, unknown> = input.action === "archive" ? { archived_at: new Date().toISOString() } : input.action === "outdated" ? { confidence: 0, last_verified_at: new Date().toISOString() } : {};
    if (input.memoryType !== undefined) values.memory_type = input.memoryType;
    if (input.title !== undefined) values.title = input.title;
    if (input.summary !== undefined) values.summary = input.summary;
    if (input.sourceEntityType !== undefined) values.source_entity_type = input.sourceEntityType;
    if (input.sourceEntityId !== undefined) values.source_entity_id = input.sourceEntityId;
    if (input.confidence !== undefined) values.confidence = input.confidence;
    const { data, error } = await supabase.from("memory_items").update(values as never).eq("id", id).eq("user_id", userId).is("archived_at", null).select("*").maybeSingle();
    if (error) throw error;
    return data ? NextResponse.json({ item: data }) : NextResponse.json({ error: "Memory item not found." }, { status: 404 });
  } catch (error) {
    return apiError(error, "Memory could not be updated.");
  }
}
