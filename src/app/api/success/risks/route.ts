import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, isMissingOptionalSchema } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("client_id");
    const status = searchParams.get("status");
    const severity = searchParams.get("severity");

    let query = supabase
      .from("client_risks")
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
    if (isMissingOptionalSchema(error)) return NextResponse.json({ data: [], schemaStatus: "unavailable", schemaDependency: "V13 Customer Success schema" });
    return apiError(error, "Risks could not be loaded.");
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const body = await request.json();

    const schema = z.object({
      client_id: z.string().uuid(),
      risk_type: z.enum([
        "delivery_delay",
        "communication_gap",
        "quality_issue",
        "payment_issue",
        "stakeholder_issue",
        "unmet_outcome",
        "renewal_risk",
        "low_engagement",
        "scope_mismatch",
        "dependency",
        "support_issue",
        "other",
      ]),
      severity: z.enum(["low", "medium", "high", "critical"]).default("medium"),
      description: z.string().min(1).max(500),
      evidence: z.string().nullable().optional(),
      status: z.enum(["open", "monitoring", "mitigating", "resolved", "dismissed"]).default("open"),
      owner_person_id: z.string().uuid().nullable().optional(),
      mitigation: z.string().nullable().optional(),
      review_at: z.string().nullable().optional(),
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
      .from("client_risks")
      .insert({
        user_id: userId,
        ...parsed,
      } as never)
      .select("*, client:clients(id, name), owner_person:team_people(id, name)")
      .single();

    if (error) throw error;
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return apiError(error, "Risk could not be created.");
  }
}
