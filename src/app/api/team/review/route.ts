import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";
import {
  buildTeamReview,
  evaluateWaitingState,
  evaluatePersonCapacity,
  detectTeamRisks,
  rankNextTeamAction,
  type TeamPerson,
  type TeamDelegation,
  type TeamResponsibility,
  type TeamEscalation,
} from "@/lib/team";

export async function GET(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const url = new URL(request.url);
    const period = (url.searchParams.get("period") === "month" ? "month" : "week") as "week" | "month";

    const [
      peopleRes,
      responsibilitiesRes,
      delegationsRes,
      escalationsRes,
      handoffsRes,
      approvalsRes,
      availabilityRes,
    ] = await Promise.all([
      supabase.from("team_people").select("*").eq("user_id", userId).neq("status", "archived"),
      supabase.from("team_responsibilities").select("*").eq("user_id", userId).neq("status", "archived"),
      supabase.from("team_delegations").select("*").eq("user_id", userId),
      supabase.from("team_escalations").select("*").eq("user_id", userId),
      supabase.from("operational_handoffs").select("*").eq("user_id", userId).limit(20),
      supabase.from("approvals").select("id,title,status,requester_name,created_at").eq("user_id", userId).eq("status", "pending").limit(20),
      supabase.from("team_availability").select("*").eq("user_id", userId),
    ]);

    const people = (peopleRes.data ?? []) as TeamPerson[];
    const delegations = (delegationsRes.data ?? []) as TeamDelegation[];
    const responsibilities = (responsibilitiesRes.data ?? []) as TeamResponsibility[];
    const escalations = (escalationsRes.data ?? []) as TeamEscalation[];
    const handoffs = handoffsRes.data ?? [];
    const approvals = approvalsRes.data ?? [];
    const availabilities = availabilityRes.data ?? [];

    const { waitingOnTeam, waitingOnMe } = evaluateWaitingState(delegations, handoffs, approvals, people);

    const capacityResults = people.map((p) => {
      const pAvail = availabilities.find((a) => a.person_id === p.id);
      const pDels = delegations.filter((d) => d.delegated_to_person_id === p.id);
      return evaluatePersonCapacity(p, [], [], pDels, [], pAvail);
    });

    const nextAction = rankNextTeamAction(
      delegations,
      responsibilities,
      waitingOnMe,
      capacityResults,
      escalations,
      people
    );

    const reviewData = buildTeamReview(delegations, responsibilities, people, escalations, handoffs, period);
    const risks = detectTeamRisks(people, delegations, responsibilities, escalations, capacityResults, handoffs);

    return NextResponse.json({
      period,
      nextTeamAction: nextAction,
      review: reviewData,
      waitingOnTeam: waitingOnTeam.slice(0, 10),
      waitingOnMe: waitingOnMe.slice(0, 10),
      capacity: capacityResults,
      risks: risks.slice(0, 10),
    });
  } catch (error) {
    return apiError(error, "Team review could not be prepared.");
  }
}
