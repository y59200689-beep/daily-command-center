import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";
import {
  detectTeamRisks,
  evaluatePersonCapacity,
  type TeamPerson,
  type TeamDelegation,
  type TeamResponsibility,
  type TeamEscalation,
} from "@/lib/team";

export async function GET() {
  try {
    const { supabase, userId } = await requireUser();

    const [
      peopleRes,
      delegationsRes,
      responsibilitiesRes,
      escalationsRes,
      handoffsRes,
      availabilityRes,
    ] = await Promise.all([
      supabase.from("team_people").select("*").eq("user_id", userId).neq("status", "archived"),
      supabase.from("team_delegations").select("*").eq("user_id", userId),
      supabase.from("team_responsibilities").select("*").eq("user_id", userId).neq("status", "archived"),
      supabase.from("team_escalations").select("*").eq("user_id", userId),
      supabase.from("operational_handoffs").select("id,accepted,expected_handoff_time").eq("user_id", userId),
      supabase.from("team_availability").select("*").eq("user_id", userId),
    ]);

    const people = (peopleRes.data ?? []) as TeamPerson[];
    const delegations = (delegationsRes.data ?? []) as TeamDelegation[];
    const responsibilities = (responsibilitiesRes.data ?? []) as TeamResponsibility[];
    const escalations = (escalationsRes.data ?? []) as TeamEscalation[];
    const handoffs = handoffsRes.data ?? [];
    const availabilities = availabilityRes.data ?? [];

    const capacityResults = people.map((p) => {
      const pAvail = availabilities.find((a) => a.person_id === p.id);
      const pDels = delegations.filter((d) => d.delegated_to_person_id === p.id);
      return evaluatePersonCapacity(p, [], [], pDels, [], pAvail);
    });

    const risks = detectTeamRisks(people, delegations, responsibilities, escalations, capacityResults, handoffs);

    return NextResponse.json({
      risks,
      criticalCount: risks.filter((r) => r.severity === "critical").length,
      highCount: risks.filter((r) => r.severity === "high").length,
      mediumCount: risks.filter((r) => r.severity === "medium").length,
    });
  } catch (error) {
    return apiError(error, "Team risks could not be loaded.");
  }
}
