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
    const severity = searchParams.get("severity");

    let query = supabase
      .from("client_issues")
      .select("*, client:clients(id, name, company), owner_person:team_people(id, name)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (clientId) query = query.eq("client_id", clientId);
    if (status && status !== "all") query = query.eq("status", status);
    if (severity && severity !== "all") query = query.eq("severity", severity);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ data: data ?? [] });
  } catch (error) {
    return apiError(error, "Client issues could not be loaded.");
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const body = await request.json();

    const schema = z.object({
      client_id: z.string().uuid(),
      title: z.string().min(1).max(240),
      description: z.string().min(1),
      severity: z.enum(["low", "medium", "high", "critical"]).default("medium"),
      source: z.string().default("client"),
      owner_person_id: z.string().uuid().nullable().optional(),
      status: z.enum([
        "open",
        "investigating",
        "waiting_on_client",
        "waiting_on_us",
        "resolved",
        "closed",
      ]).default("open"),
      opened_at: z.string().optional(),
      resolution: z.string().nullable().optional(),
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
      .from("client_issues")
      .insert({
        user_id: userId,
        ...parsed,
        opened_at: parsed.opened_at || new Date().toISOString(),
      } as never)
      .select("*, client:clients(id, name), owner_person:team_people(id, name)")
      .single();

    if (error) throw error;
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return apiError(error, "Client issue could not be created.");
  }
}
