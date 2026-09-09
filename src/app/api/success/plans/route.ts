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
      .from("client_success_plans")
      .select("*, client:clients(id, name, company)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (clientId) query = query.eq("client_id", clientId);
    if (status && status !== "all") query = query.eq("status", status);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ data: data ?? [] });
  } catch (error) {
    return apiError(error, "Success plans could not be loaded.");
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const body = await request.json();

    const schema = z.object({
      client_id: z.string().uuid(),
      title: z.string().min(1).max(240),
      period: z.string().default("annual"),
      objective: z.string().min(1),
      key_outcomes: z.string().optional().nullable(),
      risks: z.string().optional().nullable(),
      stakeholders: z.string().optional().nullable(),
      responsibilities: z.string().optional().nullable(),
      review_cadence: z.enum(["weekly", "monthly", "quarterly", "semi_annual", "annual", "none"]).default("quarterly"),
      next_review_at: z.string().optional().nullable(),
      status: z.enum(["draft", "active", "needs_review", "completed", "archived"]).default("draft"),
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
      .from("client_success_plans")
      .insert({
        user_id: userId,
        ...parsed,
      } as never)
      .select("*, client:clients(id, name)")
      .single();

    if (error) throw error;
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return apiError(error, "Success plan could not be created.");
  }
}
