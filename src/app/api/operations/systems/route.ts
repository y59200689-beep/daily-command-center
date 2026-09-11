import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, isMissingOptionalSchema } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";

const systemSchema = z.object({
  name: z.string().trim().min(1).max(240),
  system_type: z.string().trim().default("other"),
  purpose: z.string().trim().min(1),
  status: z.enum(["active", "degraded", "unavailable", "deprecated", "unknown"]).default("active"),
  owner_label: z.string().optional().nullable(),
  criticality: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  external_url: z.string().url().optional().nullable(),
  notes: z.string().optional().nullable(),
  linked_integration_id: z.string().uuid().optional().nullable(),
});

export async function GET() {
  try {
    const { supabase, userId } = await requireUser();

    const [systemsRes, integrationsRes] = await Promise.all([
      supabase.from("operational_systems").select("*").eq("user_id", userId).order("name"),
      supabase.from("integrations").select("id,provider,status,last_synced_at").eq("user_id", userId),
    ]);

    if (systemsRes.error) throw systemsRes.error;

    const integrationsMap = new Map((integrationsRes.data ?? []).map((i) => [i.id, i]));
    const systems = (systemsRes.data ?? []).map((sys) => ({
      ...sys,
      linked_integration: sys.linked_integration_id ? integrationsMap.get(sys.linked_integration_id) ?? null : null,
    }));

    return NextResponse.json({ systems });
  } catch (error) {
    if (isMissingOptionalSchema(error)) return NextResponse.json({ systems: [], schemaStatus: "unavailable", schemaDependency: "V11 operations schema" });
    return apiError(error, "Systems registry could not be loaded.");
  }
}

export async function POST(request: Request) {
  try {
    const input = systemSchema.parse(await request.json());
    const { supabase, userId } = await requireUser();

    const { data, error } = await supabase
      .from("operational_systems")
      .insert({
        user_id: userId,
        name: input.name,
        system_type: input.system_type,
        purpose: input.purpose,
        status: input.status,
        owner_label: input.owner_label,
        criticality: input.criticality,
        external_url: input.external_url ?? null,
        notes: input.notes ?? null,
        linked_integration_id: input.linked_integration_id ?? null,
      })
      .select("*")
      .single();

    if (error) throw error;
    return NextResponse.json({ system: data }, { status: 201 });
  } catch (error) {
    return apiError(error, "System could not be created.");
  }
}

export async function PATCH(request: Request) {
  try {
    const input = z.object({
      id: z.string().uuid(),
      status: z.enum(["active", "degraded", "unavailable", "deprecated", "unknown"]).optional(),
      notes: z.string().optional().nullable(),
    }).parse(await request.json());
    const { supabase, userId } = await requireUser();

    const { data, error } = await supabase
      .from("operational_systems")
      .update({
        ...(input.status ? { status: input.status } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", input.id)
      .eq("user_id", userId)
      .select("*")
      .maybeSingle();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: "System not found." }, { status: 404 });

    return NextResponse.json({ system: data });
  } catch (error) {
    return apiError(error, "System could not be updated.");
  }
}
