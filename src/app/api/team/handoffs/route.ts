import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";

const createHandoffSchema = z.object({
  from_label: z.string().trim().min(1).max(240),
  to_label: z.string().trim().min(1).max(240),
  handoff_description: z.string().trim().min(1).max(2000),
  expected_handoff_time: z.string().datetime().optional().nullable(),
  run_id: z.string().uuid().optional().nullable(),
  from_person_id: z.string().uuid().optional().nullable(),
  to_person_id: z.string().uuid().optional().nullable(),
  handoff_type: z.enum(["project", "client", "process", "sales", "content", "finance", "operational", "other"]).default("operational"),
  notes: z.string().max(2000).optional().nullable(),
});

export async function GET() {
  try {
    const { supabase, userId } = await requireUser();

    const [handoffsRes, linksRes, peopleRes] = await Promise.all([
      supabase.from("operational_handoffs").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("team_handoff_links").select("*").eq("user_id", userId),
      supabase.from("team_people").select("id, name, role_title").eq("user_id", userId),
    ]);

    if (handoffsRes.error) throw handoffsRes.error;

    const peopleMap = new Map((peopleRes.data ?? []).map((p) => [p.id, p]));
    const links = linksRes.data ?? [];

    const data = (handoffsRes.data ?? []).map((h) => {
      const link = links.find((l) => l.handoff_id === h.id);
      const fromPerson = link?.from_person_id ? peopleMap.get(link.from_person_id) : null;
      const toPerson = link?.to_person_id ? peopleMap.get(link.to_person_id) : null;

      const isOverdue = !h.accepted && h.expected_handoff_time && h.expected_handoff_time < new Date().toISOString();

      return {
        ...h,
        handoff_type: link?.handoff_type ?? "operational",
        from_person: fromPerson,
        to_person: toPerson,
        is_overdue: Boolean(isOverdue),
      };
    });

    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error, "Handoffs could not be loaded.");
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const body = await request.json();
    const parsed = createHandoffSchema.parse(body);

    const { data: handoff, error } = await supabase
      .from("operational_handoffs")
      .insert({
        user_id: userId,
        run_id: parsed.run_id || null,
        from_label: parsed.from_label,
        to_label: parsed.to_label,
        handoff_description: parsed.handoff_description,
        expected_handoff_time: parsed.expected_handoff_time || null,
        notes: parsed.notes || null,
      })
      .select("*")
      .single();

    if (error) throw error;

    if (parsed.from_person_id || parsed.to_person_id || parsed.handoff_type) {
      await supabase.from("team_handoff_links").insert({
        user_id: userId,
        handoff_id: handoff.id,
        from_person_id: parsed.from_person_id || null,
        to_person_id: parsed.to_person_id || null,
        handoff_type: parsed.handoff_type,
      });
    }

    return NextResponse.json({ data: handoff }, { status: 201 });
  } catch (error) {
    return apiError(error, "Handoff could not be created.");
  }
}

export async function PATCH(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const body = await request.json();
    const schema = z.object({
      id: z.string().uuid(),
      accepted: z.boolean().optional(),
      notes: z.string().max(2000).optional().nullable(),
    });
    const parsed = schema.parse(body);

    const updates: Record<string, unknown> = {};
    if (parsed.accepted !== undefined) {
      updates.accepted = parsed.accepted;
      if (parsed.accepted) {
        updates.accepted_at = new Date().toISOString();
      } else {
        updates.accepted_at = null;
      }
    }
    if (parsed.notes !== undefined) {
      updates.notes = parsed.notes;
    }

    const { data, error } = await supabase
      .from("operational_handoffs")
      .update(updates)
      .eq("id", parsed.id)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error, "Handoff could not be updated.");
  }
}
