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
    const type = searchParams.get("type");

    let query = supabase
      .from("client_check_ins")
      .select("*, client:clients(id, name, company)")
      .eq("user_id", userId)
      .order("scheduled_at", { ascending: false, nullsFirst: false });

    if (clientId) query = query.eq("client_id", clientId);
    if (status && status !== "all") query = query.eq("status", status);
    if (type && type !== "all") query = query.eq("check_in_type", type);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ data: data ?? [] });
  } catch (error) {
    return apiError(error, "Check-ins could not be loaded.");
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const body = await request.json();

    const schema = z.object({
      client_id: z.string().uuid(),
      check_in_type: z.enum([
        "routine",
        "success_review",
        "delivery_review",
        "renewal",
        "risk_recovery",
        "expansion",
        "executive_review",
        "other",
      ]).default("routine"),
      scheduled_at: z.string().nullable().optional(),
      completed_at: z.string().nullable().optional(),
      status: z.enum(["scheduled", "completed", "cancelled", "rescheduled"]).default("scheduled"),
      purpose: z.string().min(1).max(240),
      summary: z.string().nullable().optional(),
      next_action: z.string().nullable().optional(),
      meeting_id: z.string().uuid().nullable().optional(),
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
      .from("client_check_ins")
      .insert({
        user_id: userId,
        ...parsed,
      } as never)
      .select("*, client:clients(id, name)")
      .single();

    if (error) throw error;
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return apiError(error, "Check-in could not be created.");
  }
}
