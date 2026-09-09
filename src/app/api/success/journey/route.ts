import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";
import {
  evaluateOnboardingHealth,
  evaluateDeliveryHealth,
  evaluateExpansionReadiness,
  evaluateClientEngagement,
  evaluateAccountHealth,
  type ClientRecord,
  type ClientOutcome,
  type ClientCommitment,
  type ClientRisk,
  type ClientRenewal,
  type ClientIssue,
  type ClientMilestone,
  type ClientSatisfactionSignal,
} from "@/lib/success";

type JourneyPhaseId =
  | "onboarding"
  | "early_delivery"
  | "active_delivery"
  | "renewal_phase"
  | "expansion_phase"
  | "offboarding";

interface JourneyPhase {
  phase_id: JourneyPhaseId;
  label: string;
  active: boolean;
  state: "complete" | "active" | "at_risk" | "not_started";
  summary: string;
}

function deriveJourneyPhases(
  client: ClientRecord,
  outcomes: ClientOutcome[],
  commitments: ClientCommitment[],
  milestones: ClientMilestone[],
  risks: ClientRisk[],
  renewals: ClientRenewal[],
  issues: ClientIssue[],
  signals: ClientSatisfactionSignal[],
  projects: Array<{ id: string; status: string }>,
  runs: Array<{ id: string; status: string; title?: string }>
): JourneyPhase[] {
  const onboarding = evaluateOnboardingHealth(runs, commitments, milestones);
  const delivery = evaluateDeliveryHealth(projects, [], runs, []);

  const openIssues = issues.filter((i) => i.status !== "resolved" && i.status !== "closed");
  const health = evaluateAccountHealth(
    client,
    outcomes,
    risks,
    renewals,
    issues,
    commitments,
    projects,
    runs,
    signals
  );

  const expansion = evaluateExpansionReadiness(health.state, outcomes, delivery.state, openIssues.length);

  const recentCheckInsCount = 0;
  const engagement = evaluateClientEngagement(
    client.last_contact_at,
    (client.tier as "standard" | "important" | "strategic") ?? "standard",
    recentCheckInsCount
  );

  const hasUpcomingRenewals = renewals.some((r) =>
    ["upcoming", "preparing", "discussing"].includes(r.status)
  );

  const hasNotRenewing = renewals.some((r) => r.status === "not_renewing");

  // Onboarding phase
  const onboardingPhase: JourneyPhase = {
    phase_id: "onboarding",
    label: "Onboarding",
    active: onboarding.state !== "complete" && onboarding.state !== "not_started",
    state:
      onboarding.state === "complete"
        ? "complete"
        : onboarding.state === "blocked" || onboarding.state === "at_risk"
        ? "at_risk"
        : onboarding.state === "not_started"
        ? "not_started"
        : "active",
    summary: onboarding.reasons[0] ?? "Onboarding in progress.",
  };

  // Early delivery phase (first outcome + first delivery milestone)
  const firstDeliveryMilestone = milestones.find(
    (m) => m.milestone_type === "first_delivery" && m.status === "achieved"
  );
  const earlyDelivery: JourneyPhase = {
    phase_id: "early_delivery",
    label: "Early Delivery",
    active:
      onboarding.state === "complete" &&
      !firstDeliveryMilestone &&
      delivery.state !== "complete",
    state:
      firstDeliveryMilestone
        ? "complete"
        : delivery.state === "at_risk" || delivery.state === "blocked"
        ? "at_risk"
        : delivery.state === "unknown"
        ? "not_started"
        : "active",
    summary: firstDeliveryMilestone
      ? "First delivery milestone achieved."
      : `Delivery state: ${delivery.state}.`,
  };

  // Active delivery phase
  const achievedOutcomes = outcomes.filter((o) => o.status === "achieved");
  const activeDelivery: JourneyPhase = {
    phase_id: "active_delivery",
    label: "Active Delivery",
    active:
      firstDeliveryMilestone !== undefined &&
      achievedOutcomes.length === 0 &&
      !hasUpcomingRenewals,
    state:
      achievedOutcomes.length > 0
        ? "complete"
        : delivery.state === "at_risk" || delivery.state === "blocked"
        ? "at_risk"
        : delivery.state === "unknown"
        ? "not_started"
        : "active",
    summary: achievedOutcomes.length > 0
      ? `${achievedOutcomes.length} outcome(s) achieved.`
      : "Delivery in progress toward first outcome.",
  };

  // Renewal phase
  const renewalPhase: JourneyPhase = {
    phase_id: "renewal_phase",
    label: "Renewal",
    active: hasUpcomingRenewals && !hasNotRenewing,
    state: hasNotRenewing
      ? "at_risk"
      : renewals.some((r) => r.status === "renewed")
      ? "complete"
      : hasUpcomingRenewals
      ? "active"
      : "not_started",
    summary: hasNotRenewing
      ? "Client has indicated non-renewal. Recovery needed."
      : renewals.some((r) => r.status === "renewed")
      ? "Contract renewed."
      : hasUpcomingRenewals
      ? "Renewal discussion in progress."
      : "No renewal tracked yet.",
  };

  // Expansion phase
  const expansionPhase: JourneyPhase = {
    phase_id: "expansion_phase",
    label: "Expansion",
    active: expansion.state === "ready" || expansion.state === "potential",
    state:
      expansion.state === "do_not_pursue"
        ? "at_risk"
        : expansion.state === "ready" || expansion.state === "potential"
        ? "active"
        : "not_started",
    summary: expansion.reasons[0] ?? "Expansion not yet evaluated.",
  };

  // Offboarding phase
  const offboardingPhase: JourneyPhase = {
    phase_id: "offboarding",
    label: "Offboarding",
    active: hasNotRenewing,
    state: client.status === "inactive" ? "complete" : hasNotRenewing ? "active" : "not_started",
    summary: hasNotRenewing
      ? "Client has indicated non-renewal. Manage transition."
      : client.status === "inactive"
      ? "Client relationship concluded."
      : "Not applicable.",
  };

  const engagementSummary = engagement.summary;

  return [
    onboardingPhase,
    earlyDelivery,
    activeDelivery,
    renewalPhase,
    expansionPhase,
    offboardingPhase,
  ].map((p) => ({
    ...p,
    engagement_summary: engagementSummary,
  })) as JourneyPhase[];
}

export async function GET(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("client_id");

    if (!clientId) {
      return NextResponse.json({ error: "client_id is required." }, { status: 400 });
    }

    const [
      clientRes,
      outcomesRes,
      commitmentsRes,
      milestonesRes,
      risksRes,
      renewalsRes,
      issuesRes,
      signalsRes,
      projectsRes,
      runsRes,
    ] = await Promise.all([
      supabase
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .eq("user_id", userId)
        .is("deleted_at", null)
        .maybeSingle(),
      supabase.from("client_outcomes").select("*").eq("client_id", clientId).eq("user_id", userId),
      supabase.from("client_commitments").select("*").eq("client_id", clientId).eq("user_id", userId),
      supabase.from("client_milestones").select("*").eq("client_id", clientId).eq("user_id", userId),
      supabase.from("client_risks").select("*").eq("client_id", clientId).eq("user_id", userId),
      supabase.from("client_renewals").select("*").eq("client_id", clientId).eq("user_id", userId),
      supabase.from("client_issues").select("*").eq("client_id", clientId).eq("user_id", userId),
      supabase
        .from("client_satisfaction_signals")
        .select("*")
        .eq("client_id", clientId)
        .eq("user_id", userId),
      supabase
        .from("projects")
        .select("id, name, status, progress")
        .eq("client_id", clientId)
        .eq("user_id", userId)
        .is("deleted_at", null),
      supabase
        .from("process_runs")
        .select("id, title, status")
        .eq("client_id", clientId)
        .eq("user_id", userId),
    ]);

    if (clientRes.error) throw clientRes.error;
    if (!clientRes.data) {
      return NextResponse.json({ error: "Client not found." }, { status: 404 });
    }

    const phases = deriveJourneyPhases(
      clientRes.data as ClientRecord,
      (outcomesRes.data ?? []) as ClientOutcome[],
      (commitmentsRes.data ?? []) as ClientCommitment[],
      (milestonesRes.data ?? []) as ClientMilestone[],
      (risksRes.data ?? []) as ClientRisk[],
      (renewalsRes.data ?? []) as ClientRenewal[],
      (issuesRes.data ?? []) as ClientIssue[],
      (signalsRes.data ?? []) as ClientSatisfactionSignal[],
      projectsRes.data ?? [],
      runsRes.data ?? []
    );

    const activePhase = phases.find((p) => p.active) ?? phases.find((p) => p.state === "active");

    return NextResponse.json({
      data: {
        phases,
        activePhase: activePhase?.phase_id ?? null,
        client: clientRes.data,
      },
    });
  } catch (error) {
    return apiError(error, "Client journey could not be loaded.");
  }
}
