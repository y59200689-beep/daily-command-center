import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";
import {
  evaluateAccountHealth,
  evaluateChurnRisk,
  evaluateDeliveryHealth,
  evaluateOnboardingHealth,
  evaluateExpansionReadiness,
  evaluateClientEngagement,
  buildClientWaitingState,
  type ClientRecord,
  type ClientOutcome,
  type ClientRisk,
  type ClientRenewal,
  type ClientIssue,
  type ClientCommitment,
  type ClientSatisfactionSignal,
  type ClientMilestone,
} from "@/lib/success";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { supabase, userId } = await requireUser();

    const [
      clientRes,
      outcomesRes,
      plansRes,
      commitmentsRes,
      checkInsRes,
      signalsRes,
      risksRes,
      renewalsRes,
      milestonesRes,
      issuesRes,
      reviewsRes,
      recoveryRes,
      evidenceRes,
      projectsRes,
      runsRes,
      waitingRes,
      approvalsRes,
      teamLinksRes,
      contactsRes,
      invoicesRes,
    ] = await Promise.all([
      supabase.from("clients").select("*").eq("id", id).eq("user_id", userId).is("deleted_at", null).maybeSingle(),
      supabase.from("client_outcomes").select("*").eq("client_id", id).eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("client_success_plans").select("*").eq("client_id", id).eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("client_commitments").select("*").eq("client_id", id).eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("client_check_ins").select("*").eq("client_id", id).eq("user_id", userId).order("scheduled_at", { ascending: false }),
      supabase.from("client_satisfaction_signals").select("*").eq("client_id", id).eq("user_id", userId).order("recorded_at", { ascending: false }),
      supabase.from("client_risks").select("*").eq("client_id", id).eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("client_renewals").select("*").eq("client_id", id).eq("user_id", userId).order("renewal_date"),
      supabase.from("client_milestones").select("*").eq("client_id", id).eq("user_id", userId).order("achieved_date", { ascending: false }),
      supabase.from("client_issues").select("*").eq("client_id", id).eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("client_account_reviews").select("*").eq("client_id", id).eq("user_id", userId).order("reviewed_at", { ascending: false }),
      supabase.from("client_recovery_plans").select("*").eq("client_id", id).eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("client_evidence_links").select("*").eq("client_id", id).eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("projects").select("id,name,status,progress,start_date,target_date").eq("client_id", id).eq("user_id", userId).is("deleted_at", null),
      supabase.from("process_runs").select("id,title,status,priority").eq("client_id", id).eq("user_id", userId),
      supabase.from("waiting_items").select("*").eq("client_id", id).eq("user_id", userId).eq("status", "waiting"),
      supabase.from("approvals").select("*").eq("client_id", id).eq("user_id", userId).eq("status", "pending"),
      supabase.from("team_entity_ownership").select("*, person:team_people(id, name, role_title, email)").eq("entity_type", "client").eq("entity_id", id).eq("user_id", userId),
      supabase.from("client_contacts").select("*").eq("client_id", id).eq("user_id", userId),
      supabase.from("invoices").select("id,invoice_number,amount,currency,status,due_date").eq("client_id", id).eq("user_id", userId).is("deleted_at", null),
    ]);

    if (clientRes.error) throw clientRes.error;
    if (!clientRes.data) {
      return NextResponse.json({ error: "Client not found." }, { status: 404 });
    }

    const client = clientRes.data as ClientRecord;
    const outcomes = (outcomesRes.data ?? []) as ClientOutcome[];
    const plans = plansRes.data ?? [];
    const commitments = (commitmentsRes.data ?? []) as ClientCommitment[];
    const checkIns = checkInsRes.data ?? [];
    const signals = (signalsRes.data ?? []) as ClientSatisfactionSignal[];
    const risks = (risksRes.data ?? []) as ClientRisk[];
    const renewals = (renewalsRes.data ?? []) as ClientRenewal[];
    const milestones = (milestonesRes.data ?? []) as ClientMilestone[];
    const issues = (issuesRes.data ?? []) as ClientIssue[];
    const reviews = reviewsRes.data ?? [];
    const recoveryPlans = recoveryRes.data ?? [];
    const evidence = evidenceRes.data ?? [];
    const projects = projectsRes.data ?? [];
    const runs = runsRes.data ?? [];
    const waitingItems = waitingRes.data ?? [];
    const approvals = approvalsRes.data ?? [];
    const teamOwners = teamLinksRes.data ?? [];
    const contacts = contactsRes.data ?? [];
    const invoices = invoicesRes.data ?? [];

    const health = evaluateAccountHealth(
      client,
      outcomes,
      risks,
      renewals,
      issues,
      commitments,
      projects,
      runs,
      signals,
      client.last_contact_at
    );

    const churn = evaluateChurnRisk(
      client,
      health.state,
      risks,
      issues,
      renewals,
      signals
    );

    const delivery = evaluateDeliveryHealth(projects, [], runs, []);
    const onboarding = evaluateOnboardingHealth(runs, commitments, milestones);
    const expansion = evaluateExpansionReadiness(health.state, outcomes, delivery.state, issues.filter(i => i.status === "open").length);
    const engagement = evaluateClientEngagement(client.last_contact_at, client.tier ?? "standard", checkIns.length);

    const { waitingOnUs, waitingOnClient } = buildClientWaitingState(
      [client],
      commitments,
      [],
      waitingItems,
      approvals
    );

    return NextResponse.json({
      client,
      health,
      churn,
      delivery,
      onboarding,
      expansion,
      engagement,
      outcomes,
      plans,
      commitments,
      waitingOnUs,
      waitingOnClient,
      checkIns,
      signals,
      risks,
      renewals,
      milestones,
      issues,
      reviews,
      recoveryPlans,
      evidence,
      projects,
      runs,
      teamOwners,
      contacts,
      invoices,
    });
  } catch (error) {
    return apiError(error, "Client success profile could not be loaded.");
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { supabase, userId } = await requireUser();
    const body = await request.json();

    const patchSchema = z.object({
      tier: z.enum(["standard", "important", "strategic"]).optional(),
      notes: z.string().optional(),
      status: z.string().optional(),
    });

    const parsed = patchSchema.parse(body);

    const { data, error } = await supabase
      .from("clients")
      .update(parsed as never)
      .eq("id", id)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error) throw error;
    return NextResponse.json({ client: data });
  } catch (error) {
    return apiError(error, "Client could not be updated.");
  }
}
