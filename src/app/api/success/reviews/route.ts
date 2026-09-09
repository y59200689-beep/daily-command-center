import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";
import { buildRetentionReview, type ClientRecord } from "@/lib/success";

export async function GET(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode") ?? "summary";
    const periodParam = (searchParams.get("period") ?? "week") as "week" | "month";
    const period = periodParam === "month" ? "month" : "week";
    const clientId = searchParams.get("client_id");

    if (mode === "history") {
      let query = supabase
        .from("client_account_reviews")
        .select("*, client:clients(id, name, company)")
        .eq("user_id", userId)
        .order("reviewed_at", { ascending: false });

      if (clientId) query = query.eq("client_id", clientId);

      const { data, error } = await query;
      if (error) throw error;
      return NextResponse.json({ data: data ?? [] });
    }

    // Default: compute summary
    const [clientsRes, renewalsRes, risksRes, outcomesRes, issuesRes, commitmentsRes] = await Promise.all([
      supabase.from("clients").select("*").eq("user_id", userId).is("deleted_at", null),
      supabase.from("client_renewals").select("*, client:clients(id, name)").eq("user_id", userId),
      supabase.from("client_risks").select("*, client:clients(id, name)").eq("user_id", userId),
      supabase.from("client_outcomes").select("*, client:clients(id, name)").eq("user_id", userId),
      supabase.from("client_issues").select("*, client:clients(id, name)").eq("user_id", userId),
      supabase.from("client_commitments").select("*, client:clients(id, name)").eq("user_id", userId),
    ]);

    if (clientsRes.error) throw clientsRes.error;

    const summary = buildRetentionReview(
      (clientsRes.data ?? []) as ClientRecord[],
      renewalsRes.data ?? [],
      risksRes.data ?? [],
      outcomesRes.data ?? [],
      issuesRes.data ?? [],
      commitmentsRes.data ?? [],
      period
    );

    return NextResponse.json({ data: summary });
  } catch (error) {
    return apiError(error, "Retention reviews could not be loaded.");
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const body = await request.json();

    const schema = z.object({
      client_id: z.string().uuid(),
      period: z.enum(["week", "month", "quarter", "annual"]).default("quarter"),
      health_state: z.enum(["healthy", "needs_attention", "at_risk", "critical", "insufficient_data"]),
      wins: z.string().nullable().optional(),
      risks: z.string().nullable().optional(),
      open_commitments_count: z.number().int().default(0),
      outcomes_summary: z.string().nullable().optional(),
      renewal_status: z.string().nullable().optional(),
      expansion_readiness: z.enum(["ready", "potential", "not_yet", "do_not_pursue", "unknown"]).optional(),
      next_actions: z.string().nullable().optional(),
      reviewed_at: z.string().optional(),
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
      .from("client_account_reviews")
      .insert({
        user_id: userId,
        ...parsed,
        reviewed_at: parsed.reviewed_at || new Date().toISOString(),
      } as never)
      .select("*, client:clients(id, name)")
      .single();

    if (error) throw error;
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return apiError(error, "Account review could not be recorded.");
  }
}
