import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";

const respSchema = z.object({
  name: z.string().trim().min(1).max(240),
  description: z.string().max(2000).optional().nullable(),
  primary_owner_id: z.string().uuid().optional().nullable(),
  backup_owner_id: z.string().uuid().optional().nullable(),
  role_id: z.string().uuid().optional().nullable(),
  criticality: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  status: z.enum(["active", "needs_owner", "needs_backup", "paused", "archived"]).default("active"),
  review_cadence: z.string().max(100).optional().nullable().default("monthly"),
  notes: z.string().max(2000).optional().nullable(),
});

export async function GET(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const url = new URL(request.url);
    const criticality = url.searchParams.get("criticality");
    const status = url.searchParams.get("status");

    let qb = supabase
      .from("team_responsibilities")
      .select("*, primary_owner:team_people!primary_owner_id(id, name, role_title), backup_owner:team_people!backup_owner_id(id, name, role_title), role:team_roles(id, name)")
      .eq("user_id", userId)
      .order("name", { ascending: true });

    if (criticality && criticality !== "all") {
      qb = qb.eq("criticality", criticality);
    }
    if (status && status !== "all") {
      qb = qb.eq("status", status);
    } else {
      qb = qb.neq("status", "archived");
    }

    const { data, error } = await qb;
    if (error) throw error;

    return NextResponse.json({ data: data ?? [] });
  } catch (error) {
    return apiError(error, "Responsibilities could not be loaded.");
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const body = await request.json();
    const parsed = respSchema.parse(body);

    if (parsed.primary_owner_id && parsed.backup_owner_id && parsed.primary_owner_id === parsed.backup_owner_id) {
      return NextResponse.json({ error: "Primary owner and backup owner cannot be the same person." }, { status: 400 });
    }

    // Validate person ownership
    if (parsed.primary_owner_id) {
      const { data: p } = await supabase.from("team_people").select("id").eq("id", parsed.primary_owner_id).eq("user_id", userId).maybeSingle();
      if (!p) return NextResponse.json({ error: "Primary owner does not belong to you." }, { status: 400 });
    }

    if (parsed.backup_owner_id) {
      const { data: p } = await supabase.from("team_people").select("id").eq("id", parsed.backup_owner_id).eq("user_id", userId).maybeSingle();
      if (!p) return NextResponse.json({ error: "Backup owner does not belong to you." }, { status: 400 });
    }

    let effectiveStatus = parsed.status;
    if (!parsed.primary_owner_id && effectiveStatus === "active") {
      effectiveStatus = "needs_owner";
    } else if (!parsed.backup_owner_id && (parsed.criticality === "critical" || parsed.criticality === "high") && effectiveStatus === "active") {
      effectiveStatus = "needs_backup";
    }

    const { data, error } = await supabase
      .from("team_responsibilities")
      .insert({
        user_id: userId,
        name: parsed.name,
        description: parsed.description || null,
        primary_owner_id: parsed.primary_owner_id || null,
        backup_owner_id: parsed.backup_owner_id || null,
        role_id: parsed.role_id || null,
        criticality: parsed.criticality,
        status: effectiveStatus,
        review_cadence: parsed.review_cadence || "monthly",
        notes: parsed.notes || null,
      })
      .select("*")
      .single();

    if (error) throw error;
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return apiError(error, "Responsibility could not be created.");
  }
}
