import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { memorySourceRoute, verifyMemorySource } from "@/lib/intelligence/memory";
import { requireUser } from "@/lib/supabase/server";

const sourceType = z.enum(["task", "project", "client", "note", "decision", "content", "campaign", "invoice", "goal", "calendar_event"]);
const memoryInput = z.object({
  memoryType: z.enum(["preference", "project_context", "client_context", "decision", "pattern", "routine", "fact"]),
  title: z.string().trim().min(1).max(240),
  summary: z.string().trim().min(1).max(10_000),
  sourceEntityType: sourceType.nullable().optional(),
  sourceEntityId: z.uuid().nullable().optional(),
  confidence: z.number().min(0).max(1).default(0.7),
}).strict().superRefine((value, context) => {
  if (Boolean(value.sourceEntityType) !== Boolean(value.sourceEntityId)) context.addIssue({ code: "custom", path: ["sourceEntityId"], message: "Choose both a source type and source record." });
});

export async function GET(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const url = new URL(request.url);
    const query = url.searchParams.get("query")?.trim().slice(0, 240) ?? "";
    let requestQuery = supabase.from("memory_items").select("*").eq("user_id", userId).is("archived_at", null).order("updated_at", { ascending: false }).limit(100);
    if (query) requestQuery = requestQuery.or(`title.ilike.%${query.replaceAll("%", "\\%")}%,summary.ilike.%${query.replaceAll("%", "\\%")}%`);
    const { data, error } = await requestQuery;
    if (error) throw error;
    return NextResponse.json({ items: (data ?? []).map((item) => ({ ...item, source_route: memorySourceRoute(item.source_entity_type, item.source_entity_id) })) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error, "Memory could not be loaded.");
  }
}

export async function POST(request: Request) {
  try {
    const input = memoryInput.parse(await request.json());
    const { supabase, userId } = await requireUser();
    await verifyMemorySource(supabase, userId, input.sourceEntityType, input.sourceEntityId);
    const { data, error } = await supabase.from("memory_items").insert({ user_id: userId, memory_type: input.memoryType, title: input.title, summary: input.summary, source_entity_type: input.sourceEntityType ?? null, source_entity_id: input.sourceEntityId ?? null, confidence: input.confidence, last_verified_at: new Date().toISOString() } as never).select("*").single();
    if (error) throw error;
    return NextResponse.json({ item: data }, { status: 201 });
  } catch (error) {
    return apiError(error, "Memory could not be saved.");
  }
}
