import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(240).optional(),
  description: z.string().max(2000).optional().nullable(),
  responsibility_summary: z.string().max(2000).optional().nullable(),
  default_capacity: z.string().max(100).optional().nullable(),
  status: z.enum(["active", "archived"]).optional(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { supabase, userId } = await requireUser();
    const { id } = await params;

    const { data, error } = await supabase
      .from("team_roles")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Role not found." }, { status: 404 });

    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error, "Role could not be loaded.");
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

    const { data, error } = await supabase
      .from("team_roles")
      .update(parsed)
      .eq("id", id)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error, "Role could not be updated.");
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
      .from("team_roles")
      .update({ status: "archived" })
      .eq("id", id)
      .eq("user_id", userId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error, "Role could not be archived.");
  }
}
