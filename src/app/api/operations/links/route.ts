import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";

const operationalTypes = [
  "sop", "process", "run", "incident", "quality_check", "failure", "improvement",
] as const;

const createSchema = z.object({
  operational_type: z.enum(operationalTypes),
  operational_id: z.string().uuid(),
  entity_type: z.string().min(1).max(80),
  entity_id: z.string().uuid(),
});

export async function GET(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const url = new URL(request.url);
    const operationalType = url.searchParams.get("operational_type");
    const operationalId = url.searchParams.get("operational_id");

    let query = supabase
      .from("operational_entity_links")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (operationalType) query = query.eq("operational_type", operationalType);
    if (operationalId) query = query.eq("operational_id", operationalId);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ links: data ?? [] });
  } catch (error) {
    return apiError(error, "Links could not be loaded.");
  }
}

export async function POST(request: Request) {
  try {
    const input = createSchema.parse(await request.json());
    const { supabase, userId } = await requireUser();

    // Upsert — unique constraint (user_id, operational_type, operational_id, entity_type, entity_id)
    const { data, error } = await supabase
      .from("operational_entity_links")
      .upsert(
        {
          user_id: userId,
          operational_type: input.operational_type,
          operational_id: input.operational_id,
          entity_type: input.entity_type,
          entity_id: input.entity_id,
        },
        { onConflict: "user_id,operational_type,operational_id,entity_type,entity_id" }
      )
      .select("*")
      .single();

    if (error) throw error;
    return NextResponse.json({ link: data }, { status: 201 });
  } catch (error) {
    return apiError(error, "Link could not be created.");
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const linkId = url.searchParams.get("id");
    if (!linkId) return NextResponse.json({ error: "id is required." }, { status: 400 });

    const { supabase, userId } = await requireUser();

    const { error } = await supabase
      .from("operational_entity_links")
      .delete()
      .eq("id", linkId)
      .eq("user_id", userId);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error, "Link could not be removed.");
  }
}
