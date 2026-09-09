import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";

const reassignSchema = z.object({
  new_person_id: z.string().uuid(),
  reason: z.string().trim().max(1000).optional().nullable(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { supabase, userId } = await requireUser();
    const { id } = await params;
    const body = await request.json();
    const parsed = reassignSchema.parse(body);

    const { data: delegation } = await supabase
      .from("team_delegations")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();

    if (!delegation) {
      return NextResponse.json({ error: "Delegation not found." }, { status: 404 });
    }

    const { data: newPerson } = await supabase
      .from("team_people")
      .select("id, name")
      .eq("id", parsed.new_person_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (!newPerson) {
      return NextResponse.json({ error: "New assignee person not found or not owned by you." }, { status: 400 });
    }

    const previousPersonId = delegation.delegated_to_person_id;

    const { data: updated, error } = await supabase
      .from("team_delegations")
      .update({
        delegated_to_person_id: parsed.new_person_id,
        status: "assigned",
        acknowledged_at: null, // Reset acknowledgement on new assignment
      })
      .eq("id", id)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error) throw error;

    // Record in history
    await supabase.from("team_delegation_history").insert({
      user_id: userId,
      delegation_id: id,
      action: "reassigned",
      from_person_id: previousPersonId,
      to_person_id: parsed.new_person_id,
      reason: parsed.reason || `Reassigned to ${newPerson.name}`,
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    return apiError(error, "Delegation could not be reassigned.");
  }
}
