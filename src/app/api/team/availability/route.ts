import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";

const availSchema = z.object({
  person_id: z.string().uuid(),
  status: z.enum(["available", "limited", "unavailable"]).default("available"),
  start_at: z.string().datetime().optional().nullable().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  end_at: z.string().datetime().optional().nullable().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  reason: z.string().max(200).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export async function GET(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const url = new URL(request.url);
    const personId = url.searchParams.get("person_id");

    let qb = supabase
      .from("team_availability")
      .select("*, person:team_people!person_id(id, name, role_title)")
      .eq("user_id", userId)
      .order("start_at", { ascending: false });

    if (personId) {
      qb = qb.eq("person_id", personId);
    }

    const { data, error } = await qb;
    if (error) throw error;

    return NextResponse.json({ data: data ?? [] });
  } catch (error) {
    return apiError(error, "Availability could not be loaded.");
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const body = await request.json();
    const parsed = availSchema.parse(body);

    const { data: person } = await supabase.from("team_people").select("id").eq("id", parsed.person_id).eq("user_id", userId).maybeSingle();
    if (!person) {
      return NextResponse.json({ error: "Person does not belong to you." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("team_availability")
      .insert({
        user_id: userId,
        person_id: parsed.person_id,
        status: parsed.status,
        start_at: parsed.start_at || null,
        end_at: parsed.end_at || null,
        reason: parsed.reason || null,
        notes: parsed.notes || null,
      })
      .select("*")
      .single();

    if (error) throw error;
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return apiError(error, "Availability could not be created.");
  }
}

export async function DELETE(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) return NextResponse.json({ error: "ID required." }, { status: 400 });

    const { error } = await supabase
      .from("team_availability")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error, "Availability could not be deleted.");
  }
}
