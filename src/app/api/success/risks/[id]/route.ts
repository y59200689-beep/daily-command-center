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
      .from("client_risks")
      .select("*, client:clients(id, name, company), owner_person:team_people(id, name)")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Risk not found." }, { status: 404 });

    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error, "Risk could not be loaded.");
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
      ]).optional(),
      severity: z.enum(["low", "medium", "high", "critical"]).optional(),
      description: z.string().min(1).max(500).optional(),
      evidence: z.string().nullable().optional(),
      status: z.enum(["open", "monitoring", "mitigating", "resolved", "dismissed"]).optional(),
      owner_person_id: z.string().uuid().nullable().optional(),
      mitigation: z.string().nullable().optional(),
      review_at: z.string().nullable().optional(),
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
      .from("client_risks")
      .update(parsed as never)
      .eq("id", id)
      .eq("user_id", userId)
      .select("*, client:clients(id, name), owner_person:team_people(id, name)")
      .single();

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error, "Risk could not be updated.");
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
      .from("client_risks")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error, "Risk could not be deleted.");
  }
}
