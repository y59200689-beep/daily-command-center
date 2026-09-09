import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";

const escalationSchema = z.object({
  source_entity_type: z.string().max(100).optional().nullable(),
  source_entity_id: z.string().uuid().optional().nullable(),
  person_id: z.string().uuid().optional().nullable(),
  reason: z.string().trim().min(1).max(2000),
  severity: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  status: z.enum(["open", "reviewing", "resolved", "dismissed"]).default("open"),
});

export async function GET(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const severity = url.searchParams.get("severity");

    let qb = supabase
      .from("team_escalations")
      .select("*, person:team_people!person_id(id, name, role_title)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (status && status !== "all") {
      qb = qb.eq("status", status);
    }
    if (severity && severity !== "all") {
      qb = qb.eq("severity", severity);
    }

    const { data, error } = await qb;
    if (error) throw error;

    return NextResponse.json({ data: data ?? [] });
  } catch (error) {
    return apiError(error, "Escalations could not be loaded.");
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const body = await request.json();
    const parsed = escalationSchema.parse(body);

    const { data, error } = await supabase
      .from("team_escalations")
      .insert({
        user_id: userId,
        source_entity_type: parsed.source_entity_type || null,
        source_entity_id: parsed.source_entity_id || null,
        person_id: parsed.person_id || null,
        reason: parsed.reason,
        severity: parsed.severity,
        status: parsed.status,
      })
      .select("*")
      .single();

    if (error) throw error;
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return apiError(error, "Escalation could not be created.");
  }
}
