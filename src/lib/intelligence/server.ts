import type { SupabaseClient } from "@supabase/supabase-js";
import { buildIntelligenceOverview } from "@/lib/intelligence/overview";
import { loadIntelligenceWorkspace } from "@/lib/intelligence/workspace";

export async function getIntelligence(client: SupabaseClient<Record<string, unknown>>, userId: string, now = new Date()) {
  const snapshot = await loadIntelligenceWorkspace(client, userId, now);
  return { snapshot, overview: buildIntelligenceOverview(snapshot) };
}
