import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import { apiError } from "@/lib/api";
import { dependencyImpact } from "@/lib/founder-os/intelligence";
import { endpointTables } from "@/lib/founder-os/resources";
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const id = z.uuid().parse(params.get("id"));
    const type = z.enum(Object.keys(endpointTables) as [keyof typeof endpointTables, ...Array<keyof typeof endpointTables>]).parse(params.get("type"));
    const { supabase, userId } = await requireUser();
    const { data: entity, error: entityError } = await supabase.from(endpointTables[type]).select("id").eq("user_id", userId).eq("id", id).maybeSingle();
    if (entityError) throw entityError;
    if (!entity) return NextResponse.json({ error: "Entity not found." }, { status: 404 });
    const { data, error } = await supabase.from("operational_dependencies").select("id,source_type,source_id,dependency_type,dependency_id,dependency_label,state,notes").eq("user_id", userId).order("created_at").limit(501);
    if (error) throw error;
    const rows = (data ?? []).slice(0, 500);
    const downstream = dependencyImpact(rows, type, id);
    const names = new Map<string, string>();
    const endpoints = new Map<string, Set<string>>();
    for (const row of rows) for (const side of ["source", "dependency"] as const) {
      const kind = String(row[`${side}_type`]); const key = String(row[`${side}_id`]);
      if (Object.hasOwn(endpointTables, kind)) { if (!endpoints.has(kind)) endpoints.set(kind, new Set()); endpoints.get(kind)!.add(key); }
    }
    await Promise.all([...endpoints].map(async ([kind, ids]) => {
      const table = endpointTables[kind as keyof typeof endpointTables];
      const label = ["projects", "companies", "team_people", "operational_systems", "supplier_records", "clients", "product_catalog_refs", "process_templates"].includes(table) ? "name" : table === "integrations" ? "provider" : "title";
      const result = await supabase.from(table).select(`id,${label}`).eq("user_id", userId).in("id", [...ids]);
      if (result.error) throw result.error;
      for (const record of result.data ?? []) { const r = record as unknown as Record<string, unknown>; names.set(`${kind}:${r.id}`, String(r[label])); }
    }));
    const named = rows.map(r => ({ ...r, source_label: names.get(`${r.source_type}:${r.source_id}`) ?? "Unavailable record", target_label: names.get(`${r.dependency_type}:${r.dependency_id}`) ?? r.dependency_label }));
    return NextResponse.json({ blockedBy: named.filter(r => r.source_type === type && r.source_id === id), blocks: named.filter(r => r.dependency_type === type && r.dependency_id === id), downstream: downstream.map(key => ({ id: key, label: names.get(key) ?? "Unavailable record", type: key.split(":")[0] })), limited: (data?.length ?? 0) > 500 });
  } catch (error) { return apiError(error, "Dependencies could not be loaded."); }
}
