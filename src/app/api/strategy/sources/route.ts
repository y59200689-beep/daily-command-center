import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";

const sourceTypes = {
  goal: { table: "goals", label: "title" },
  project: { table: "projects", label: "name" },
  opportunity: { table: "opportunities", label: "title" },
  proposal: { table: "proposals", label: "title" },
  campaign: { table: "campaigns", label: "name" },
  roadmap: { table: "product_roadmap_items", label: "title" },
  trip: { table: "trips", label: "title" },
  personal_admin: { table: "personal_admin_items", label: "title" },
  commitment: { table: "strategic_commitments", label: "title" },
  milestone: { table: "strategic_milestones", label: "title" },
  decision: { table: "decisions", label: "title" },
} as const;

export type StrategySourceType = keyof typeof sourceTypes;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const type = z.enum(Object.keys(sourceTypes) as [StrategySourceType, ...StrategySourceType[]]).parse(url.searchParams.get("type"));
    const query = (url.searchParams.get("q") ?? "").trim().slice(0, 120);
    const { supabase, userId } = await requireUser();
    const config = sourceTypes[type];
    let requestQuery = supabase.from(config.table).select(`id,${config.label}`).eq("user_id", userId).order(config.label).limit(20);
    if (query) requestQuery = requestQuery.ilike(config.label, `%${query.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`);
    const { data, error } = await requestQuery;
    if (error) throw error;
    return NextResponse.json({ records: (data ?? []).map((row) => ({ id: String(row.id), label: String(row[config.label as keyof typeof row] ?? "Untitled") })) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error, "Strategy sources could not be loaded.");
  }
}
