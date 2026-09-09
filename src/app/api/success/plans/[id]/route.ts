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
      .from("client_success_plans")
      .select("*, client:clients(id, name, company)")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Success plan not found." }, { status: 404 });

    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error, "Success plan could not be loaded.");
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
      period: z.string().optional(),
      objective: z.string().min(1).optional(),
      key_outcomes: z.string().nullable().optional(),
      risks: z.string().nullable().optional(),
      stakeholders: z.string().nullable().optional(),
      responsibilities: z.string().nullable().optional(),
      review_cadence: z.enum(["weekly", "monthly", "quarterly", "semi_annual", "annual", "none"]).optional(),
      next_review_at: z.string().nullable().optional(),
      status: z.enum(["draft", "active", "needs_review", "completed", "archived"]).optional(),
    });

    const parsed = schema.parse(body);

    const { data, error } = await supabase
      .from("client_success_plans")
      .update(parsed as never)
      .eq("id", id)
      .eq("user_id", userId)
      .select("*, client:clients(id, name)")
      .single();

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error, "Success plan could not be updated.");
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
      .from("client_success_plans")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error, "Success plan could not be deleted.");
  }
}
