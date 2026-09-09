import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";
import {
  evaluateAccountHealth,
  rankNextCustomerSuccessAction,
  buildClientWaitingState,
  evaluateRenewalReadiness,
  type ClientRecord,
  type ClientOutcome,
  type ClientRisk,
  type ClientRenewal,
  type ClientIssue,
  type ClientCommitment,
  type ClientSatisfactionSignal,
} from "@/lib/success";

export async function GET() {
  try {
    const { supabase, userId } = await requireUser();

    const [
      clientsRes,
      outcomesRes,
      risksRes,
      renewalsRes,
      issuesRes,
      commitmentsRes,
      signalsRes,
      projectsRes,
      runsRes,
      waitingItemsRes,
      approvalsRes,
      plansRes,
    ] = await Promise.all([
      supabase.from("clients").select("*").eq("user_id", userId).is("deleted_at", null),
      supabase.from("client_outcomes").select("*").eq("user_id", userId),
      supabase.from("client_risks").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("client_renewals").select("*").eq("user_id", userId).order("renewal_date"),
      supabase.from("client_issues").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("client_commitments").select("*").eq("user_id", userId),
      supabase.from("client_satisfaction_signals").select("*").eq("user_id", userId).order("recorded_at", { ascending: false }).limit(30),
      supabase.from("projects").select("id,client_id,name,status").eq("user_id", userId).is("deleted_at", null),
      supabase.from("process_runs").select("id,client_id,title,status").eq("user_id", userId),
      supabase.from("waiting_items").select("id,client_id,title,status,requested_at,expected_by").eq("user_id", userId).eq("status", "waiting"),
      supabase.from("approvals").select("id,client_id,title,status,created_at").eq("user_id", userId).eq("status", "pending"),
      supabase.from("client_success_plans").select("id,client_id,status,next_review_at").eq("user_id", userId),
    ]);

    const clients = (clientsRes.data ?? []) as ClientRecord[];
    const outcomes = (outcomesRes.data ?? []) as ClientOutcome[];
    const risks = (risksRes.data ?? []) as ClientRisk[];
    const renewals = (renewalsRes.data ?? []) as ClientRenewal[];
    const issues = (issuesRes.data ?? []) as ClientIssue[];
    const commitments = (commitmentsRes.data ?? []) as ClientCommitment[];
    const signals = (signalsRes.data ?? []) as ClientSatisfactionSignal[];
    const projects = projectsRes.data ?? [];
    const runs = runsRes.data ?? [];
    const waitingItems = waitingItemsRes.data ?? [];
    const approvals = approvalsRes.data ?? [];
    const plans = plansRes.data ?? [];

    const { waitingOnUs, waitingOnClient } = buildClientWaitingState(
      clients,
      commitments,
      [],
      waitingItems,
      approvals
    );

    const nextAction = rankNextCustomerSuccessAction(
      clients,
      outcomes,
      risks,
      renewals,
      issues,
      commitments,
      waitingOnUs
    );

    // Evaluate health for each client
    const clientHealthMap = clients.map((c) => {
      const cOutcomes = outcomes.filter((o) => o.client_id === c.id);
      const cRisks = risks.filter((r) => r.client_id === c.id);
      const cRenewals = renewals.filter((r) => r.client_id === c.id);
      const cIssues = issues.filter((i) => i.client_id === c.id);
      const cCommitments = commitments.filter((comm) => comm.client_id === c.id);
      const cProjects = projects.filter((p) => p.client_id === c.id);
      const cRuns = runs.filter((r) => r.client_id === c.id);
      const cSignals = signals.filter((s) => s.client_id === c.id);

      const health = evaluateAccountHealth(
        c,
        cOutcomes,
        cRisks,
        cRenewals,
        cIssues,
        cCommitments,
        cProjects,
        cRuns,
        cSignals
      );

      return {
        client: c,
        health,
        activeRisksCount: cRisks.filter((r) => ["open", "monitoring", "mitigating"].includes(r.status)).length,
        openIssuesCount: cIssues.filter((i) => ["open", "investigating", "waiting_on_us"].includes(i.status)).length,
      };
    });

    const atRiskClients = clientHealthMap.filter(
      (ch) => ch.health.state === "at_risk" || ch.health.state === "critical"
    );

    const upcomingRenewals = renewals
      .filter((r) => ["upcoming", "preparing", "discussing"].includes(r.status))
      .map((r) => {
        const client = clients.find((c) => c.id === r.client_id);
        const readiness = evaluateRenewalReadiness(r, "healthy");
        return {
          ...r,
          client_name: client?.name ?? "Client",
          readiness,
        };
      });

    return NextResponse.json({
      metrics: {
        totalClients: clients.length,
        healthyCount: clientHealthMap.filter((ch) => ch.health.state === "healthy").length,
        needsAttentionCount: clientHealthMap.filter((ch) => ch.health.state === "needs_attention").length,
        atRiskCount: atRiskClients.length,
        criticalCount: clientHealthMap.filter((ch) => ch.health.state === "critical").length,
        upcomingRenewalsCount: upcomingRenewals.length,
        waitingOnUsCount: waitingOnUs.length,
        waitingOnClientCount: waitingOnClient.length,
        activePlansCount: plans.filter((p) => p.status === "active").length,
        openIssuesCount: issues.filter((i) => ["open", "investigating", "waiting_on_us"].includes(i.status)).length,
      },
      nextAction,
      atRiskClients: atRiskClients.slice(0, 5),
      upcomingRenewals: upcomingRenewals.slice(0, 5),
      waitingOnUs: waitingOnUs.slice(0, 5),
      waitingOnClient: waitingOnClient.slice(0, 5),
      recentSignals: signals.slice(0, 5),
    });
  } catch (error) {
    return apiError(error, "Customer Success overview could not be loaded.");
  }
}
