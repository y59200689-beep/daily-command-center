import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("client_id");
    const status = searchParams.get("status");
    const forecastCategory = searchParams.get("forecast_category");

    let query = supabase
      .from("client_renewals")
      .select("*, client:clients(id, name, company), service:services(id, name), owner_person:team_people(id, name)")
      .eq("user_id", userId)
      .order("renewal_date", { ascending: true });

    if (clientId) query = query.eq("client_id", clientId);
    if (status && status !== "all") query = query.eq("status", status);
    if (forecastCategory && forecastCategory !== "all") {
      query = query.eq("forecast_category", forecastCategory);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ data: data ?? [] });
  } catch (error) {
    return apiError(error, "Renewals could not be loaded.");
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const body = await request.json();

    const schema = z.object({
      client_id: z.string().uuid(),
      service_id: z.string().uuid().nullable().optional(),
      renewal_date: z.string(),
      renewal_type: z.enum([
        "subscription",
        "retainer",
        "maintenance",
        "service_contract",
        "license",
        "custom",
      ]).default("retainer"),
      status: z.enum([
        "upcoming",
        "preparing",
        "discussing",
        "renewed",
        "not_renewing",
        "deferred",
        "unknown",
      ]).default("upcoming"),
      forecast_category: z.enum(["committed", "likely", "uncertain", "at_risk"]).default("uncertain"),
      value: z.number().nonnegative().nullable().optional(),
      currency: z.string().length(3).default("MAD"),
      owner_person_id: z.string().uuid().nullable().optional(),
      preparation_state: z.enum(["not_started", "in_progress", "ready", "not_needed"]).default("not_started"),
      last_review_at: z.string().nullable().optional(),
      next_action: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
    });

    const parsed = schema.parse(body);

    const clientCheck = await supabase
      .from("clients")
      .select("id")
      .eq("id", parsed.client_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (clientCheck.error) throw clientCheck.error;
    if (!clientCheck.data) {
      return NextResponse.json({ error: "Client not found or unowned." }, { status: 404 });
    }

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
      .insert({
        user_id: userId,
        ...parsed,
      } as never)
      .select("*, client:clients(id, name), service:services(id, name), owner_person:team_people(id, name)")
      .single();

    if (error) throw error;
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return apiError(error, "Renewal could not be created.");
  }
}
