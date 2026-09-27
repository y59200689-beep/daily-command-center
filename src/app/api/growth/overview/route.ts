import { NextResponse } from "next/server";
import { growthTotals } from "@/lib/growth-dashboard";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";
import {
  rankNextGrowthMove,
  scoreOpportunity,
  scoreLead,
  evaluatePipelineQuality,
  identifyExpansionCandidates,
  identifyDormantClients,
  identifyLeadReactivations,
  computeOfferIntelligence,
  computeChannelPerformance,
  detectGrowthRisks,
} from "@/lib/growth";

export async function GET() {
  try {
    const { supabase, userId } = await requireUser();
    const today = new Date().toISOString().slice(0, 10);

    const [
      oppsRes,
      leadsRes,
      proposalsRes,
      clientsRes,
      projectsRes,
      servicesRes,
      proposalItemsRes,
      invoicesRes,
      paymentsRes,
      experimentsRes,
    ] = await Promise.all([
      supabase.from("opportunities").select("*").eq("user_id", userId).is("archived_at", null).order("updated_at", { ascending: false }),
      supabase.from("leads").select("*").eq("user_id", userId).is("archived_at", null).order("created_at", { ascending: false }),
      supabase.from("proposals").select("*").eq("user_id", userId).is("archived_at", null).order("updated_at", { ascending: false }),
      supabase.from("clients").select("id,name,status,last_contact_at,updated_at").eq("user_id", userId).is("deleted_at", null),
      supabase.from("projects").select("id,client_id,name,status,updated_at").eq("user_id", userId).is("deleted_at", null),
      supabase.from("services").select("id,name,category,default_price,pricing_type,active").eq("user_id", userId).is("archived_at", null),
      supabase.from("proposal_items").select("id,proposal_id,service_id,title,quantity,unit_price,total").eq("user_id", userId),
      supabase.from("invoices").select("id,invoice_number,client_id,total_amount,amount_remaining,currency,status,due_date,paid_at,updated_at").eq("user_id", userId).is("deleted_at", null),
      supabase.from("payments").select("id,amount,currency,payment_date").eq("user_id", userId).is("deleted_at", null),
      supabase.from("growth_experiments").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(10),
    ]);

    const failure = [oppsRes, leadsRes, proposalsRes, clientsRes, projectsRes, servicesRes, proposalItemsRes, invoicesRes, paymentsRes].find((r) => r.error);
    if (failure?.error) throw failure.error;
    if (experimentsRes.error && !isMissingOptionalRelation(experimentsRes.error)) throw experimentsRes.error;

    const opportunities = oppsRes.data ?? [];
    const leads = leadsRes.data ?? [];
    const proposals = proposalsRes.data ?? [];
    const clients = clientsRes.data ?? [];
    const projects = projectsRes.data ?? [];
    const services = servicesRes.data ?? [];
    const proposalItems = proposalItemsRes.data ?? [];
    const invoices = invoicesRes.data ?? [];
    const payments = paymentsRes.data ?? [];
    const experiments = experimentsRes.data ?? [];

    const nextGrowthMove = rankNextGrowthMove(opportunities, leads, proposals, today);
    const pipelineQuality = evaluatePipelineQuality(opportunities, today);

    const scoredOpportunities = opportunities
      .filter((o) => !["won", "lost"].includes(o.stage))
      .map((opp) => ({
        ...opp,
        intelligence: scoreOpportunity(opp, today),
      }))
      .sort((a, b) => b.intelligence.score - a.intelligence.score);

    const scoredLeads = leads.slice(0, 8).map((lead) => ({
      ...lead,
      intelligence: scoreLead(lead, today),
    }));

    const expansionCandidates = identifyExpansionCandidates(
      clients,
      projects,
      invoices,
      services.map((s) => ({ client_id: "", service_name: s.name })),
      today
    );

    const dormantClients = identifyDormantClients(clients, projects, invoices, today);
    const leadReactivations = identifyLeadReactivations(leads, opportunities, today);
    const offerMetrics = computeOfferIntelligence(services, proposalItems, proposals, opportunities);
    const channelMetrics = computeChannelPerformance(leads, opportunities, proposals);
    const growthRisks = Array.from(new Set(opportunities.map(row => row.currency || "MAD"))).flatMap(currency =>
      detectGrowthRisks(opportunities.filter(row => (row.currency || "MAD") === currency), clients, proposals.filter(row => (row.currency || "MAD") === currency), today).map(risk => ({ ...risk, id: `${risk.id}:${currency}`, currency, evidence: risk.evidence.replaceAll("MAD", currency) }))
    );

    const dashboard = { opportunities, invoices, payments, proposals, proposalItems, clients, services };
    const totals = growthTotals(dashboard, "MAD");
    return NextResponse.json({
      dashboard,
      nextGrowthMove,
      revenueInMotion: {
        ...totals,
        currency: "MAD",
      },
      pipelineQuality,
      scoredOpportunities,
      scoredLeads,
      expansionCandidates: expansionCandidates.slice(0, 6),
      dormantClients: dormantClients.slice(0, 6),
      leadReactivations: leadReactivations.slice(0, 6),
      offerMetrics: offerMetrics.slice(0, 6),
      channelMetrics,
      growthRisks,
      activeExperiments: experiments.filter((e) => ["running", "planned"].includes(e.status)),
    });
  } catch (error) {
    return apiError(error, "Growth overview could not be loaded.");
  }
}

function isMissingOptionalRelation(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      ((error as { code?: unknown }).code === "PGRST205" ||
        (error as { code?: unknown }).code === "42P01"),
  );
}
