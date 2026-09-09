import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";

const roleSchema = z.object({
  name: z.string().trim().min(1).max(240),
  description: z.string().max(2000).optional().nullable(),
  responsibility_summary: z.string().max(2000).optional().nullable(),
  default_capacity: z.string().max(100).optional().nullable(),
  status: z.enum(["active", "archived"]).default("active"),
});

export async function GET() {
  try {
    const { supabase, userId } = await requireUser();
    const { data, error } = await supabase
      .from("team_roles")
      .select("*")
      .eq("user_id", userId)
      .order("name", { ascending: true });

    if (error) throw error;
    return NextResponse.json({ data: data ?? [] });
  } catch (error) {
    return apiError(error, "Roles could not be loaded.");
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const body = await request.json();
    const parsed = roleSchema.parse(body);

    const { data, error } = await supabase
      .from("team_roles")
      .insert({
        user_id: userId,
        name: parsed.name,
        description: parsed.description || null,
        responsibility_summary: parsed.responsibility_summary || null,
        default_capacity: parsed.default_capacity || null,
        status: parsed.status,
      })
      .select("*")
      .single();

    if (error) throw error;
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return apiError(error, "Role could not be created.");
  }
}
