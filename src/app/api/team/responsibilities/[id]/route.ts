import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(240).optional(),
  description: z.string().max(2000).optional().nullable(),
  primary_owner_id: z.string().uuid().optional().nullable(),
  backup_owner_id: z.string().uuid().optional().nullable(),
  role_id: z.string().uuid().optional().nullable(),
  criticality: z.enum(["low", "medium", "high", "critical"]).optional(),
  status: z.enum(["active", "needs_owner", "needs_backup", "paused", "archived"]).optional(),
  review_cadence: z.string().max(100).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { supabase, userId } = await requireUser();
    const { id } = await params;

    const { data, error } = await supabase
      .from("team_responsibilities")
      .select("*, primary_owner:team_people!primary_owner_id(id, name, role_title), backup_owner:team_people!backup_owner_id(id, name, role_title), role:team_roles(id, name)")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Responsibility not found." }, { status: 404 });

    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error, "Responsibility could not be loaded.");
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { supabase, userId } = await requireUser();
    const { id } = await params;
    const body = await request.json();
    const parsed = patchSchema.parse(body);

    const { data: existing } = await supabase
      .from("team_responsibilities")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();

    if (!existing) return NextResponse.json({ error: "Responsibility not found." }, { status: 404 });

    const nextPrimary = parsed.primary_owner_id !== undefined ? parsed.primary_owner_id : existing.primary_owner_id;
    const nextBackup = parsed.backup_owner_id !== undefined ? parsed.backup_owner_id : existing.backup_owner_id;

    if (nextPrimary && nextBackup && nextPrimary === nextBackup) {
      return NextResponse.json({ error: "Primary owner and backup owner cannot be the same person." }, { status: 400 });
    }

    if (parsed.primary_owner_id) {
      const { data: p } = await supabase.from("team_people").select("id").eq("id", parsed.primary_owner_id).eq("user_id", userId).maybeSingle();
      if (!p) return NextResponse.json({ error: "Primary owner does not belong to you." }, { status: 400 });
    }

    if (parsed.backup_owner_id) {
      const { data: p } = await supabase.from("team_people").select("id").eq("id", parsed.backup_owner_id).eq("user_id", userId).maybeSingle();
      if (!p) return NextResponse.json({ error: "Backup owner does not belong to you." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("team_responsibilities")
      .update(parsed)
      .eq("id", id)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error, "Responsibility could not be updated.");
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { supabase, userId } = await requireUser();
    const { id } = await params;

    const { error } = await supabase
      .from("team_responsibilities")
      .update({ status: "archived" })
      .eq("id", id)
      .eq("user_id", userId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error, "Responsibility could not be archived.");
  }
}
