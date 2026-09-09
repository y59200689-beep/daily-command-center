import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";

const commitmentSchema = z.object({
  from_person_id: z.string().uuid().optional().nullable(),
  to_person_id: z.string().uuid().optional().nullable(),
  statement: z.string().trim().min(1).max(500),
  source: z.string().max(200).optional().nullable(),
  due_at: z.string().datetime().optional().nullable().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  status: z.enum(["open", "done", "cancelled", "unclear"]).default("open"),
  notes: z.string().max(2000).optional().nullable(),
});

export async function GET(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const personId = url.searchParams.get("person_id");

    let qb = supabase
      .from("team_commitments")
      .select("*, from_person:team_people!from_person_id(id, name), to_person:team_people!to_person_id(id, name)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (status && status !== "all") {
      qb = qb.eq("status", status);
    }
    if (personId) {
      qb = qb.or(`from_person_id.eq.${personId},to_person_id.eq.${personId}`);
    }

    const { data, error } = await qb;
    if (error) throw error;

    return NextResponse.json({ data: data ?? [] });
  } catch (error) {
    return apiError(error, "Commitments could not be loaded.");
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const body = await request.json();
    const parsed = commitmentSchema.parse(body);

    const { data, error } = await supabase
      .from("team_commitments")
      .insert({
        user_id: userId,
        from_person_id: parsed.from_person_id || null,
        to_person_id: parsed.to_person_id || null,
        statement: parsed.statement,
        source: parsed.source || null,
        due_at: parsed.due_at || null,
        status: parsed.status,
        notes: parsed.notes || null,
      })
      .select("*")
      .single();

    if (error) throw error;
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return apiError(error, "Commitment could not be created.");
  }
}
