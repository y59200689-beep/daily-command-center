import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";
import {
  evaluateAccountHealth,
  evaluateChurnRisk,
  evaluateDeliveryHealth,
  evaluateExpansionReadiness,
  evaluateClientEngagement,
  rankNextCustomerSuccessAction,
  buildClientWaitingState,
  type ClientRecord,
  type ClientOutcome,
  type ClientCommitment,
  type ClientCheckIn,
  type ClientSatisfactionSignal,
  type ClientRisk,
  type ClientRenewal,
  type ClientIssue,
} from "@/lib/success";

export async function GET() {
  try {
    const { supabase, userId } = await requireUser();

    const [
      clientsRes,
      outcomesRes,
      commitmentsRes,
      checkInsRes,
      signalsRes,
      risksRes,
      renewalsRes,
      issuesRes,
      invoicesRes,
      projectsRes,
    ] = await Promise.all([
      supabase.from("clients").select("*").eq("user_id", userId).is("deleted_at", null).order("name"),
      supabase.from("client_outcomes").select("*").eq("user_id", userId),
      supabase.from("client_commitments").select("*").eq("user_id", userId),
      supabase.from("client_check_ins").select("*").eq("user_id", userId),
      supabase.from("client_satisfaction_signals").select("*").eq("user_id", userId),
      supabase.from("client_risks").select("*").eq("user_id", userId),
      supabase.from("client_renewals").select("*").eq("user_id", userId),
      supabase.from("client_issues").select("*").eq("user_id", userId),
      supabase
        .from("invoices")
        .select("id, client_id, status, due_date, total_amount")
        .eq("user_id", userId),
      supabase
        .from("projects")
        .select("id, client_id, name, status, target_date, progress")
        .eq("user_id", userId),
    ]);

    if (clientsRes.error) throw clientsRes.error;

    const clients = (clientsRes.data ?? []) as ClientRecord[];
    const outcomes = (outcomesRes.data ?? []) as ClientOutcome[];
    const commitments = (commitmentsRes.data ?? []) as ClientCommitment[];
    const checkIns = (checkInsRes.data ?? []) as ClientCheckIn[];
    const signals = (signalsRes.data ?? []) as ClientSatisfactionSignal[];
    const risks = (risksRes.data ?? []) as ClientRisk[];
    const renewals = (renewalsRes.data ?? []) as ClientRenewal[];
    const issues = (issuesRes.data ?? []) as ClientIssue[];
    const invoices = (invoicesRes.data ?? []) as Array<{
      id: string;
      client_id?: string | null;
      status: string;
      due_date?: string | null;
      total_amount?: number | null;
    }>;
    const projects = (projectsRes.data ?? []) as Array<{
      id: string;
      client_id?: string | null;
      name: string;
      status: string;
      target_date?: string | null;
      progress?: number;
    }>;

    const portfolioAccounts = clients.map((client) => {
      const cOutcomes = outcomes.filter((o) => o.client_id === client.id);
      const cCommitments = commitments.filter((c) => c.client_id === client.id);
      const cCheckIns = checkIns.filter((ci) => ci.client_id === client.id);
      const cSignals = signals.filter((s) => s.client_id === client.id);
      const cRisks = risks.filter((r) => r.client_id === client.id);
      const cRenewals = renewals.filter((r) => r.client_id === client.id);
      const cIssues = issues.filter((i) => i.client_id === client.id);
      const cInvoices = invoices.filter((i) => i.client_id === client.id);
      const cProjects = projects.filter((p) => p.client_id === client.id);

      const health = evaluateAccountHealth(
        client,
        cOutcomes,
        cRisks,
        cRenewals,
        cIssues,
        cCommitments,
        cProjects,
        [],
        cSignals,
        client.last_contact_at
      );

      const lastContactAt = cCheckIns
        .filter((ci) => ci.status === "completed" && ci.completed_at)
        .sort((a, b) =>
          (b.completed_at ?? "").localeCompare(a.completed_at ?? "")
        )[0]?.completed_at;

      const contactDate = lastContactAt ?? client.last_contact_at;
      const daysSinceInteraction = contactDate
        ? Math.floor((Date.now() - new Date(contactDate).getTime()) / (1000 * 60 * 60 * 24))
        : null;

      const churn = evaluateChurnRisk(
        client,
        health.state,
        cRisks,
        cIssues,
        cRenewals,
        cSignals,
        daysSinceInteraction
      );

      const delivery = evaluateDeliveryHealth(cProjects, [], [], []);

      const openIssuesCount = cIssues.filter(
        (i) => i.status !== "resolved" && i.status !== "closed"
      ).length;
      const expansion = evaluateExpansionReadiness(
        health.state,
        cOutcomes,
        delivery.state,
        openIssuesCount
      );

      const recentActivitiesCount = cCheckIns.filter((ci) => {
        if (!ci.completed_at) return false;
        const days = Math.floor(
          (Date.now() - new Date(ci.completed_at).getTime()) / (1000 * 60 * 60 * 24)
        );
        return days <= 30;
      }).length;

      const engagement = evaluateClientEngagement(
        contactDate,
        (client.tier as "standard" | "important" | "strategic") ?? "standard",
        recentActivitiesCount
      );

      return {
        client,
        health,
        churn,
        delivery,
        expansion,
        engagement,
        counts: {
          outcomes: cOutcomes.length,
          openCommitments: cCommitments.filter((c) => c.status === "open").length,
          openRisks: cRisks.filter((r) => r.status === "open" || r.status === "mitigating").length,
          openIssues: openIssuesCount,
          openInvoices: cInvoices.filter((i) => i.status !== "paid" && i.status !== "cancelled").length,
          renewals: cRenewals.length,
        },
      };
    });

    // Portfolio-wide next action
    const waitingState = buildClientWaitingState(clients, commitments, [], [], []);
    const nextAction = rankNextCustomerSuccessAction(
      clients,
      outcomes,
      risks,
      renewals,
      issues,
      commitments,
      waitingState.waitingOnUs
    );

    const healthBreakdown = {
      healthy: portfolioAccounts.filter((a) => a.health.state === "healthy").length,
      needs_attention: portfolioAccounts.filter((a) => a.health.state === "needs_attention").length,
      at_risk: portfolioAccounts.filter((a) => a.health.state === "at_risk").length,
      critical: portfolioAccounts.filter((a) => a.health.state === "critical").length,
      insufficient_data: portfolioAccounts.filter((a) => a.health.state === "insufficient_data").length,
    };

    const highChurnRiskCount = portfolioAccounts.filter(
      (a) => a.churn.state === "high" || a.churn.state === "elevated"
    ).length;

    const nowStr = new Date().toISOString().slice(0, 10);
    const in60dStr = new Date(Date.now() + 60 * 86400 * 1000).toISOString().slice(0, 10);
    const upcomingRenewalsCount = renewals.filter(
      (r) =>
        r.renewal_date >= nowStr &&
        r.renewal_date <= in60dStr &&
        r.status !== "renewed" &&
        r.status !== "not_renewing"
    ).length;

    const unfulfilledCommitmentsCount = commitments.filter((c) => c.status === "open").length;
    const criticalIssuesCount = issues.filter(
      (i) =>
        (i.severity === "critical" || i.severity === "high") &&
        i.status !== "resolved" &&
        i.status !== "closed"
    ).length;

    return NextResponse.json({
      data: {
        portfolioAccounts,
        nextAction,
        summary: {
          totalClients: clients.length,
          healthBreakdown,
          highChurnRiskCount,
          upcomingRenewalsCount,
          unfulfilledCommitmentsCount,
          criticalIssuesCount,
        },
      },
    });
  } catch (error) {
    return apiError(error, "Portfolio health could not be loaded.");
  }
}
