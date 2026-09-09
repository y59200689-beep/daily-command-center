import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";

const delegationStatuses = [
  "draft", "assigned", "acknowledged", "in_progress", "blocked",
  "needs_review", "completed", "cancelled"
] as const;

const delegationPriorities = ["low", "medium", "high", "critical"] as const;

const createSchema = z.object({
  title: z.string().trim().min(1).max(240),
  description: z.string().max(3000).optional().nullable(),
  delegated_to_person_id: z.string().uuid(),
  delegated_by_person_id: z.string().uuid().optional().nullable(),
  source_entity_type: z.string().max(100).optional().nullable(),
  source_entity_id: z.string().uuid().optional().nullable(),
  expected_outcome: z.string().trim().min(1).max(3000),
  due_at: z.string().datetime().optional().nullable().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  review_at: z.string().datetime().optional().nullable().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  status: z.enum(delegationStatuses).default("assigned"),
  priority: z.enum(delegationPriorities).default("medium"),
  notes: z.string().max(3000).optional().nullable(),
});

export async function GET(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const personId = url.searchParams.get("person_id");
    const priority = url.searchParams.get("priority");
    const waiting = url.searchParams.get("waiting");

    let qb = supabase
      .from("team_delegations")
      .select("*, delegated_to:team_people!delegated_to_person_id(id, name, role_title, avatar_url)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (personId) {
      qb = qb.eq("delegated_to_person_id", personId);
    }
    if (priority && priority !== "all") {
      qb = qb.eq("priority", priority);
    }

    if (waiting === "team") {
      qb = qb.in("status", ["assigned", "acknowledged", "in_progress", "blocked"]);
    } else if (waiting === "me") {
      qb = qb.eq("status", "needs_review");
    } else if (status && status !== "all") {
      qb = qb.eq("status", status);
    }

    const { data, error } = await qb;
    if (error) throw error;

    return NextResponse.json({ data: data ?? [] });
  } catch (error) {
    return apiError(error, "Delegations could not be loaded.");
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const body = await request.json();
    const parsed = createSchema.parse(body);

    // Validate person belongs to user
    const { data: person } = await supabase
      .from("team_people")
      .select("id")
      .eq("id", parsed.delegated_to_person_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (!person) {
      return NextResponse.json({ error: "Assignee person does not belong to you." }, { status: 400 });
    }

    const { data: delegation, error } = await supabase
      .from("team_delegations")
      .insert({
        user_id: userId,
        title: parsed.title,
        description: parsed.description || null,
        delegated_to_person_id: parsed.delegated_to_person_id,
        delegated_by_person_id: parsed.delegated_by_person_id || null,
        source_entity_type: parsed.source_entity_type || null,
        source_entity_id: parsed.source_entity_id || null,
        expected_outcome: parsed.expected_outcome,
        due_at: parsed.due_at || null,
        review_at: parsed.review_at || null,
        status: parsed.status,
        priority: parsed.priority,
        notes: parsed.notes || null,
      })
      .select("*")
      .single();

    if (error) throw error;

    // Log history
    await supabase.from("team_delegation_history").insert({
      user_id: userId,
      delegation_id: delegation.id,
      action: "created",
      to_person_id: parsed.delegated_to_person_id,
      reason: "Delegation created",
    });

    return NextResponse.json({ data: delegation }, { status: 201 });
  } catch (error) {
    return apiError(error, "Delegation could not be created.");
  }
}
