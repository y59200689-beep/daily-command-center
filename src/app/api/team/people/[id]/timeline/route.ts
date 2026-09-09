import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { supabase, userId } = await requireUser();
    const { id } = await params;

    const [historyRes, commitmentsRes] = await Promise.all([
      supabase
        .from("team_delegation_history")
        .select("*, delegation:team_delegations(id, title)")
        .eq("user_id", userId)
        .or(`from_person_id.eq.${id},to_person_id.eq.${id}`)
        .order("created_at", { ascending: false })
        .limit(30),
      supabase
        .from("team_commitments")
        .select("*")
        .eq("user_id", userId)
        .or(`from_person_id.eq.${id},to_person_id.eq.${id}`)
        .not("completed_at", "is", null)
        .order("completed_at", { ascending: false })
        .limit(20),
    ]);

    const events: Array<{
      id: string;
      event_type: string;
      title: string;
      description?: string | null;
      timestamp: string;
    }> = [];

    for (const h of historyRes.data ?? []) {
      events.push({
        id: `h:${h.id}`,
        event_type: `delegation_${h.action}`,
        title: `Delegation ${h.action}: ${h.delegation?.title ?? "item"}`,
        description: h.reason ?? undefined,
        timestamp: h.created_at,
      });
    }

    for (const c of commitmentsRes.data ?? []) {
      events.push({
        id: `c:${c.id}`,
        event_type: "commitment_resolved",
        title: `Commitment resolved: ${c.statement}`,
        description: c.notes ?? undefined,
        timestamp: c.completed_at ?? c.updated_at ?? c.created_at,
      });
    }

    events.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));

    return NextResponse.json({ events: events.slice(0, 30) });
  } catch (error) {
    return apiError(error, "Timeline could not be loaded.");
  }
}
