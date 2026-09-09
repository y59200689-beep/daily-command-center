import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("client_id");
    const signalType = searchParams.get("signal_type");

    let query = supabase
      .from("client_satisfaction_signals")
      .select("*, client:clients(id, name, company)")
      .eq("user_id", userId)
      .order("recorded_at", { ascending: false });

    if (clientId) query = query.eq("client_id", clientId);
    if (signalType && signalType !== "all") query = query.eq("signal_type", signalType);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ data: data ?? [] });
  } catch (error) {
    return apiError(error, "Satisfaction signals could not be loaded.");
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const body = await request.json();

    const schema = z.object({
      client_id: z.string().uuid(),
      signal_type: z.enum([
        "positive_feedback",
        "neutral_feedback",
        "negative_feedback",
        "complaint",
        "praise",
        "requested_change",
        "referral",
        "renewal_intent",
      ]),
      source: z.string().default("manual"),
      recorded_at: z.string().optional(),
      summary: z.string().min(1).max(500),
      severity: z.enum(["low", "medium", "high", "critical"]).nullable().optional(),
      linked_entity_type: z.string().nullable().optional(),
      linked_entity_id: z.string().uuid().nullable().optional(),
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

    const { data, error } = await supabase
      .from("client_satisfaction_signals")
      .insert({
        user_id: userId,
        ...parsed,
        recorded_at: parsed.recorded_at || new Date().toISOString(),
      } as never)
      .select("*, client:clients(id, name)")
      .single();

    if (error) throw error;
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return apiError(error, "Satisfaction signal could not be recorded.");
  }
}
