import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import { apiError } from "@/lib/api";
import { strategySources, strategyTargets } from "@/lib/founder-os/workflows";
const sourceSchema = z.object({ source_type: z.enum(["task", "project", "decision", "risk"]), source_id: z.uuid() });
const targetSchema = sourceSchema.extend({ target_type: z.enum(["goal", "commitment", "milestone", "kpi"]), target_id: z.uuid() }).strict();
export async function GET(request: Request) {
 try {
  const { supabase, userId } = await requireUser();
  const params = new URL(request.url).searchParams;
  const source = sourceSchema.parse(Object.fromEntries(params));
  const owned = await supabase.from(strategySources[source.source_type]).select("id").eq("id", source.source_id).eq("user_id", userId).maybeSingle();
  if (owned.error) throw owned.error;
  if (!owned.data) return NextResponse.json({ error: "Source unavailable." }, { status: 404 });
  const links = await supabase.from("founder_strategy_links").select("*").eq("user_id", userId).eq("source_type", source.source_type).eq("source_id", source.source_id).limit(100);
  if (links.error) throw links.error;
  const options = Object.fromEntries(await Promise.all(Object.entries(strategyTargets).map(async ([type, [table, label]]) => {
    let query = supabase.from(table).select(`id,${label}`).eq("user_id", userId).order(label).limit(100);
    if (params.get("q")) query = query.ilike(label, `%${params.get("q")!.slice(0, 200).replace(/[\\%_]/g, "\\$&")}%`);
    const result = await query; if (result.error) throw result.error;
    return [type, (result.data ?? []).map(r => { const row = r as unknown as Record<string, unknown>; return { id: row.id, label: row[label] }; })];
  })));
  const targetNames = new Map<string, string>();
  await Promise.all(Object.entries(strategyTargets).map(async ([type, [table, label]]) => {
    const ids = (links.data ?? []).filter(l => l.target_type === type).map(l => l.target_id);
    if (!ids.length) return;
    const result = await supabase.from(table).select(`id,${label}`).eq("user_id", userId).in("id", ids);
    if (result.error) throw result.error;
    for (const r of result.data ?? []) { const row = r as unknown as Record<string, unknown>; targetNames.set(`${type}:${row.id}`, String(row[label])); }
  }));
  const named = (links.data ?? []).map(link => ({ ...link, label: targetNames.get(`${link.target_type}:${link.target_id}`) ?? "Unavailable target" }));
  return NextResponse.json({ links: named, options });
 } catch (e) { return apiError(e, "Strategic links are unavailable. Check the local Tier 1 migration."); }
}
export async function POST(request: Request) {
 try { const { supabase, userId } = await requireUser(); const input = targetSchema.parse(await request.json()); const result = await supabase.from("founder_strategy_links").upsert({ ...input, user_id: userId }, { onConflict: "user_id,source_type,source_id,target_type,target_id" }).select().single(); if (result.error) throw result.error; return NextResponse.json({ record: result.data }); }
 catch (e) { return apiError(e, "Strategic link could not be saved."); }
}
export async function DELETE(request: Request) {
 try { const { supabase, userId } = await requireUser(); const id = z.uuid().parse(new URL(request.url).searchParams.get("id")); const result = await supabase.from("founder_strategy_links").delete().eq("user_id", userId).eq("id", id).select("id").maybeSingle(); if (result.error) throw result.error; return NextResponse.json({ removed: Boolean(result.data) }); }
 catch (e) { return apiError(e, "Strategic link could not be removed."); }
}
