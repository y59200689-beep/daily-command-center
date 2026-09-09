import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";
import {
  rankNextTeamAction,
  evaluateWaitingState,
  evaluatePersonCapacity,
  detectOwnershipGaps,
  detectBackupGaps,
  detectTeamRisks,
  type TeamPerson,
  type TeamRole,
  type TeamCommitment,
  type TeamDelegation,
  type TeamResponsibility,
  type TeamEscalation,
} from "@/lib/team";

export async function GET() {
  try {
    const { supabase, userId } = await requireUser();

    const [
      peopleRes,
      rolesRes,
      responsibilitiesRes,
      delegationsRes,
      escalationsRes,
      commitmentsRes,
      handoffsRes,
      approvalsRes,
      availabilityRes,
      sopsRes,
    ] = await Promise.all([
      supabase.from("team_people").select("*").eq("user_id", userId).neq("status", "archived"),
      supabase.from("team_roles").select("*").eq("user_id", userId).eq("status", "active"),
      supabase.from("team_responsibilities").select("*").eq("user_id", userId).neq("status", "archived"),
      supabase.from("team_delegations").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("team_escalations").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("team_commitments").select("*").eq("user_id", userId).eq("status", "open"),
      supabase.from("operational_handoffs").select("*").eq("user_id", userId).limit(20),
      supabase.from("approvals").select("id,title,status,requester_name,created_at").eq("user_id", userId).eq("status", "pending").limit(20),
      supabase.from("team_availability").select("*").eq("user_id", userId),
      supabase.from("operational_sops").select("id,title,criticality,owner_label").eq("user_id", userId).eq("status", "active"),
    ]);

    const people = (peopleRes.data ?? []) as TeamPerson[];
    const delegations = (delegationsRes.data ?? []) as TeamDelegation[];
    const responsibilities = (responsibilitiesRes.data ?? []) as TeamResponsibility[];
    const escalations = (escalationsRes.data ?? []) as TeamEscalation[];
    const commitments = (commitmentsRes.data ?? []) as TeamCommitment[];
    const roles = (rolesRes.data ?? []) as TeamRole[];
    const handoffs = handoffsRes.data ?? [];
    const approvals = approvalsRes.data ?? [];
    const availabilities = availabilityRes.data ?? [];
    const sops = sopsRes.data ?? [];

    const { waitingOnTeam, waitingOnMe } = evaluateWaitingState(delegations, handoffs, approvals, people);

    const capacityResults = people.map((p) => {
      const pAvail = availabilities.find((a) => a.person_id === p.id);
      const pDels = delegations.filter((d) => d.delegated_to_person_id === p.id);
      const pCommits = commitments.filter((c) => c.from_person_id === p.id);
      return evaluatePersonCapacity(p, [], [], pDels, pCommits, pAvail);
    });

    const nextAction = rankNextTeamAction(
      delegations,
      responsibilities,
      waitingOnMe,
      capacityResults,
      escalations,
      people
    );

    const ownershipGaps = detectOwnershipGaps(responsibilities, { sops }, people);
    const backupGaps = detectBackupGaps(responsibilities, people);
    const risks = detectTeamRisks(people, delegations, responsibilities, escalations, capacityResults, handoffs);

    const activeDelegations = delegations.filter((d) => !["completed", "cancelled"].includes(d.status));

    return NextResponse.json({
      metrics: {
        totalPeople: people.length,
        totalRoles: roles.length,
        activeDelegations: activeDelegations.length,
        openCommitmentsCount: commitments.length,
        waitingOnTeamCount: waitingOnTeam.length,
        waitingOnMeCount: waitingOnMe.length,
        ownershipGapsCount: ownershipGaps.length,
        backupGapsCount: backupGaps.length,
        openEscalationsCount: escalations.filter((e) => e.status === "open").length,
        criticalRisksCount: risks.filter((r) => r.severity === "critical").length,
      },
      nextTeamAction: nextAction,
      waitingOnTeam: waitingOnTeam.slice(0, 5),
      waitingOnMe: waitingOnMe.slice(0, 5),
      recentDelegations: delegations.slice(0, 6),
      ownershipGaps: ownershipGaps.slice(0, 4),
      backupGaps: backupGaps.slice(0, 4),
      risks: risks.slice(0, 4),
      peopleCount: people.length,
    });
  } catch (error) {
    return apiError(error, "Team Command Center overview could not be loaded.");
  }
}
