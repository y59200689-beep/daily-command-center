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
      .from("client_issues")
      .select("*, client:clients(id, name, company), owner_person:team_people(id, name)")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Issue not found." }, { status: 404 });

    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error, "Issue could not be loaded.");
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
      title: z.string().min(1).max(240).optional(),
      description: z.string().min(1).optional(),
      severity: z.enum(["low", "medium", "high", "critical"]).optional(),
      source: z.string().optional(),
      owner_person_id: z.string().uuid().nullable().optional(),
      status: z.enum([
        "open",
        "investigating",
        "waiting_on_client",
        "waiting_on_us",
        "resolved",
        "closed",
      ]).optional(),
      resolution: z.string().nullable().optional(),
      resolved_at: z.string().nullable().optional(),
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

    const updatePayload: Record<string, unknown> = { ...parsed };
    if ((parsed.status === "resolved" || parsed.status === "closed") && !parsed.resolved_at) {
      updatePayload.resolved_at = new Date().toISOString();
    } else if (parsed.status && parsed.status !== "resolved" && parsed.status !== "closed") {
      updatePayload.resolved_at = null;
    }

    const { data, error } = await supabase
      .from("client_issues")
      .update(updatePayload as never)
      .eq("id", id)
      .eq("user_id", userId)
      .select("*, client:clients(id, name), owner_person:team_people(id, name)")
      .single();

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error, "Issue could not be updated.");
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
      .from("client_issues")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error, "Issue could not be deleted.");
  }
}
