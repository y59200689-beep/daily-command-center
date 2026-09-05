import type { SupabaseClient } from "@supabase/supabase-js";

const sourceTables = {
  task: "tasks",
  project: "projects",
  client: "clients",
  note: "notes",
  decision: "decisions",
  content: "content_items",
  campaign: "campaigns",
  invoice: "invoices",
  goal: "goals",
  calendar_event: "calendar_events",
} as const;

export type MemorySourceType = keyof typeof sourceTables;

export async function verifyMemorySource(client: SupabaseClient, userId: string, sourceType?: MemorySourceType | null, sourceId?: string | null) {
  if (!sourceType && !sourceId) return;
  if (!sourceType || !sourceId) throw new Error("MEMORY_SOURCE_PAIR_REQUIRED");
  const table = sourceTables[sourceType];
  const { data, error } = await client.from(table).select("id").eq("id", sourceId).eq("user_id", userId).is("deleted_at", null).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("MEMORY_SOURCE_NOT_FOUND");
}

export function memorySourceRoute(sourceType: MemorySourceType | null, sourceId: string | null) {
  if (!sourceType || !sourceId) return null;
  if (sourceType === "calendar_event") return "/calendar";
  if (sourceType === "content") return `/content/${sourceId}`;
  if (sourceType === "invoice") return `/finance/invoices?record=${sourceId}`;
  return `/${sourceType}s/${sourceId}`;
}
