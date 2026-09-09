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
      .from("client_recovery_plans")
      .select("*, client:clients(id, name, company), owner_person:team_people(id, name)")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Recovery plan not found." }, { status: 404 });

    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error, "Recovery plan could not be loaded.");
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
      risk_summary: z.string().min(1).optional(),
      target_state: z.string().min(1).optional(),
      actions: z.string().min(1).optional(),
      owner_person_id: z.string().uuid().nullable().optional(),
      review_date: z.string().nullable().optional(),
      status: z.enum(["draft", "active", "monitoring", "resolved", "archived"]).optional(),
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
      .from("client_recovery_plans")
      .update(parsed as never)
      .eq("id", id)
      .eq("user_id", userId)
      .select("*, client:clients(id, name), owner_person:team_people(id, name)")
      .single();

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error, "Recovery plan could not be updated.");
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
      .from("client_recovery_plans")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error, "Recovery plan could not be deleted.");
  }
}
