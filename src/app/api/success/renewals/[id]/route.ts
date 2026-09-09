import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { supabase, userId } = await requireUser();

    const { data, error } = await supabase
      .from("client_renewals")
      .select("*, client:clients(id, name, company), service:services(id, name), owner_person:team_people(id, name)")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Renewal not found." }, { status: 404 });

    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error, "Renewal could not be loaded.");
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { supabase, userId } = await requireUser();
    const body = await request.json();

    const schema = z.object({
      service_id: z.string().uuid().nullable().optional(),
      renewal_date: z.string().optional(),
      renewal_type: z.enum([
        "subscription",
        "retainer",
        "maintenance",
        "service_contract",
        "license",
        "custom",
      ]).optional(),
      status: z.enum([
        "upcoming",
        "preparing",
        "discussing",
        "renewed",
        "not_renewing",
        "deferred",
        "unknown",
      ]).optional(),
      forecast_category: z.enum(["committed", "likely", "uncertain", "at_risk"]).optional(),
      value: z.number().nonnegative().nullable().optional(),
      currency: z.string().length(3).optional(),
      owner_person_id: z.string().uuid().nullable().optional(),
      preparation_state: z.enum(["not_started", "in_progress", "ready", "not_needed"]).optional(),
      last_review_at: z.string().nullable().optional(),
      next_action: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
    });

    const parsed = schema.parse(body);

    if (parsed.owner_person_id) {
      const personCheck = await supabase
        .from("team_people")
        .select("id")
        .eq("id", parsed.owner_person_id)
        .eq("user_id", userId)
        .maybeSingle();
      if (personCheck.error) throw personCheck.error;
      if (!personCheck.data) {
        return NextResponse.json({ error: "Owner person not found or unowned." }, { status: 404 });
      }
    }

    const { data, error } = await supabase
      .from("client_renewals")
      .update(parsed as never)
      .eq("id", id)
      .eq("user_id", userId)
      .select("*, client:clients(id, name), service:services(id, name), owner_person:team_people(id, name)")
      .single();

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error, "Renewal could not be updated.");
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { supabase, userId } = await requireUser();

    const { error } = await supabase
      .from("client_renewals")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error, "Renewal could not be deleted.");
  }
}
