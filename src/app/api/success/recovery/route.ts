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

    let query = supabase
      .from("client_recovery_plans")
      .select("*, client:clients(id, name, company), owner_person:team_people(id, name)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (clientId) query = query.eq("client_id", clientId);
    if (status && status !== "all") query = query.eq("status", status);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ data: data ?? [] });
  } catch (error) {
    return apiError(error, "Recovery plans could not be loaded.");
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const body = await request.json();

    const schema = z.object({
      client_id: z.string().uuid(),
      risk_summary: z.string().min(1),
      target_state: z.string().min(1),
      actions: z.string().min(1),
      owner_person_id: z.string().uuid().nullable().optional(),
      review_date: z.string().nullable().optional(),
      status: z.enum(["draft", "active", "monitoring", "resolved", "archived"]).default("draft"),
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
      .from("client_recovery_plans")
      .insert({ user_id: userId, ...parsed } as never)
      .select("*, client:clients(id, name), owner_person:team_people(id, name)")
      .single();

    if (error) throw error;
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return apiError(error, "Recovery plan could not be created.");
  }
}
