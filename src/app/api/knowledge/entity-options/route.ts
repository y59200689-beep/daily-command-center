import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";

const kinds = z.enum([
  "project", "client", "lead", "opportunity", "proposal", "campaign", "content",
  "goal", "decision", "roadmap", "product", "supplier", "trip", "commitment", "milestone",
]);

const definitions = {
  project: { table: "projects", label: "name", status: "status", route: "/projects" },
  client: { table: "clients", label: "name", status: "status", route: "/clients" },
  lead: { table: "leads", label: "name", status: "status", route: "/leads" },
  opportunity: { table: "opportunities", label: "title", status: "stage", route: "/opportunities" },
  proposal: { table: "proposals", label: "title", status: "status", route: "/proposals" },
  campaign: { table: "campaigns", label: "name", status: "status", route: "/campaigns" },
  content: { table: "content_items", label: "title", status: "status", route: "/content" },
  goal: { table: "goals", label: "title", status: "status", route: "/goals" },
  decision: { table: "decisions", label: "title", status: "status", route: "/decisions" },
  roadmap: { table: "product_roadmap_items", label: "title", status: "status", route: "/founder/roadmap" },
  product: { table: "product_catalog_refs", label: "name", status: "active", route: "/founder/products" },
  supplier: { table: "supplier_records", label: "name", status: "active", route: "/founder/suppliers" },
  trip: { table: "trips", label: "title", status: "status", route: "/life/trips" },
  commitment: { table: "strategic_commitments", label: "title", status: "status", route: "/control-tower" },
  milestone: { table: "strategic_milestones", label: "title", status: "status", route: "/control-tower" },
} as const;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const kind = kinds.parse(url.searchParams.get("type"));
    const query = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
    const definition = definitions[kind];
    const { supabase, userId } = await requireUser();
    let builder = supabase
      .from(definition.table)
      .select(`id,${definition.label},${definition.status}`)
      .eq("user_id", userId)
      .order(definition.label, { ascending: true })
      .limit(40);
    if (query) builder = builder.ilike(definition.label, `%${query}%`);
    const { data, error } = await builder;
    if (error) throw error;
    const rows: Array<Record<string, unknown> & { id: string }> = data ?? [];
    return NextResponse.json({
      items: rows.map((row) => ({
        id: row.id,
        label: String(row[definition.label] ?? "Untitled"),
        status: row[definition.status] == null ? null : String(row[definition.status]),
        route: `${definition.route}/${row.id}`,
      })),
    });
  } catch (error) {
    return apiError(error, "Linked records could not be loaded.");
  }
}
