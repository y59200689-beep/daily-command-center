import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import { apiError } from "@/lib/api";
import { isResource } from "@/lib/founder-os/resources";
import { legacyResources, legacyResourceSchema } from "@/lib/founder-os/legacy";
import { validateLegacyReferences } from "@/lib/founder-os/legacy-repository";
import * as operating from "@/app/api/operating/[resource]/[id]/route";
type Context = { params: Promise<{ resource: string; id: string }> };
async function handle(request: Request, context: Context, method: "GET" | "PATCH" | "DELETE") {
  try {
    const { resource, id } = await context.params;
    if (isResource(resource)) return operating[method](request, context);
    const key = legacyResourceSchema.parse(resource); z.uuid().parse(id);
    const { supabase, userId } = await requireUser();
    const config = legacyResources[key];
    const current = await supabase.from(config.table).select("*").eq("user_id", userId).eq("id", id).maybeSingle();
    if (current.error) throw current.error;
    if (!current.data) return NextResponse.json({ error: "Record not found." }, { status: 404 });
    if (method === "GET") return NextResponse.json({ record: current.data });
    const archive = { suppliers: { active: false }, "supplier-orders": { status: "canceled" }, roadmap: { status: "paused" }, incidents: { status: "resolved" }, support: { status: "closed" } };
    const input = method === "DELETE" ? archive[key] : config.schema.partial().strict().parse(await request.json());
    await validateLegacyReferences(supabase, userId, { ...current.data, ...input });
    const result = await supabase.from(config.table).update(input).eq("user_id", userId).eq("id", id).select("*").single();
    if (result.error) throw result.error;
    return NextResponse.json({ record: result.data });
  } catch (e) { return apiError(e, "Founder record could not be managed."); }
}
export const GET = (r: Request, c: Context) => handle(r, c, "GET");
export const PATCH = (r: Request, c: Context) => handle(r, c, "PATCH");
export const DELETE = (r: Request, c: Context) => handle(r, c, "DELETE");
