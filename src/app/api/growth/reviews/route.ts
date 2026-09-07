import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";
import {
  rankNextGrowthMove,
  scoreOpportunity,
  evaluatePipelineQuality,
  identifyExpansionCandidates,
  identifyDormantClients,
  identifyLeadReactivations,
  computeOfferIntelligence,
  computeChannelPerformance,
  detectGrowthRisks,
} from "@/lib/growth";

export async function GET(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const url = new URL(request.url);
    const period = url.searchParams.get("period") === "month" ? "month" : "week";
    const today = new Date().toISOString().slice(0, 10);

    const periodDays = period === "month" ? 30 : 7;
    const periodStart = new Date(Date.now() - periodDays * 86400000).toISOString().slice(0, 10);
    const periodStartIso = `${periodStart}T00:00:00.000Z`;

    const [
      oppsRes,
      leadsRes,
      proposalsRes,
      clientsRes,
      projectsRes,
      servicesRes,
      itemsRes,
      invoicesRes,
      experimentsRes,
      targetsRes,
      dealReviewsRes,
    ] = await Promise.all([
      supabase.from("opportunities").select("*").eq("user_id", userId).is("archived_at", null),
      supabase.from("leads").select("*").eq("user_id", userId).is("archived_at", null),
      supabase.from("proposals").select("*").eq("user_id", userId).is("archived_at", null),
      supabase.from("clients").select("id,name,status,last_contact_at,updated_at").eq("user_id", userId).is("deleted_at", null),
      supabase.from("projects").select("id,client_id,name,status,updated_at").eq("user_id", userId).is("deleted_at", null),
      supabase.from("services").select("id,name,category").eq("user_id", userId).is("archived_at", null),
      supabase.from("proposal_items").select("id,proposal_id,service_id,total").eq("user_id", userId),
      supabase.from("invoices").select("id,client_id,total_amount,currency,status,paid_at,updated_at").eq("user_id", userId).is("deleted_at", null),
      supabase.from("growth_experiments").select("*").eq("user_id", userId),
      supabase.from("sales_targets").select("*").eq("user_id", userId),
      supabase.from("deal_reviews").select("*").eq("user_id", userId).order("review_date", { ascending: false }),
    ]);

    const failure = [oppsRes, leadsRes, proposalsRes, clientsRes, projectsRes, servicesRes, itemsRes, invoicesRes, experimentsRes, targetsRes, dealReviewsRes].find((r) => r.error);
    if (failure?.error) throw failure.error;

    const opportunities = oppsRes.data ?? [];
    const leads = leadsRes.data ?? [];
    const proposals = proposalsRes.data ?? [];
    const clients = clientsRes.data ?? [];
    const projects = projectsRes.data ?? [];
    const services = servicesRes.data ?? [];
    const proposalItems = itemsRes.data ?? [];
    const invoices = invoicesRes.data ?? [];
    const experiments = experimentsRes.data ?? [];
    const targets = targetsRes.data ?? [];
    const dealReviews = dealReviewsRes.data ?? [];

    const newLeads = leads.filter((l) => l.created_at && l.created_at >= periodStartIso);
    const qualifiedLeads = newLeads.filter((l) => ["qualified", "converted"].includes(l.status));
    const proposalsSent = proposals.filter((p) => p.sent_at && p.sent_at >= periodStartIso);
    const wins = opportunities.filter((o) => o.stage === "won" && o.won_at && o.won_at >= periodStartIso);
    const losses = opportunities.filter((o) => o.stage === "lost" && o.lost_at && o.lost_at >= periodStartIso);

    const nextGrowthMove = rankNextGrowthMove(opportunities, leads, proposals, today);
    const pipelineQuality = evaluatePipelineQuality(opportunities, today);
    const dealsAtRisk = opportunities
      .filter((o) => !["won", "lost"].includes(o.stage))
      .map((opp) => ({ ...opp, intelligence: scoreOpportunity(opp, today) }))
      .filter((o) => o.intelligence.health === "At risk" || o.intelligence.health === "Stalled");

    const expansion = identifyExpansionCandidates(clients, projects, invoices, services.map((s) => ({ client_id: "", service_name: s.name })), today);
    const dormantClients = identifyDormantClients(clients, projects, invoices, today);
    const dormantLeads = identifyLeadReactivations(leads, opportunities, today);
    const channels = computeChannelPerformance(leads, opportunities, proposals);
    const offers = computeOfferIntelligence(services, proposalItems, proposals, opportunities);
    const risks = detectGrowthRisks(opportunities, clients, proposals, today);

    return NextResponse.json({
      period,
      periodStart,
      periodEnd: today,
      nextGrowthMove,
      pipeline: pipelineQuality,
      dealsAtRisk,
      activitySummary: {
        newLeadsCount: newLeads.length,
        qualifiedLeadsCount: qualifiedLeads.length,
        proposalsSentCount: proposalsSent.length,
        winsCount: wins.length,
        wonRevenue: wins.reduce((sum, o) => sum + Number(o.estimated_value ?? 0), 0),
        lossesCount: losses.length,
      },
      expansion,
      dormantClients,
      dormantLeads,
      channels,
      offers,
      experiments,
      targets,
      risks,
      dealReviews,
    });
  } catch (error) {
    return apiError(error, "Growth review could not be prepared.");
  }
}

const dealReviewSchema = z.object({
  opportunity_id: z.string().uuid(),
  review_type: z.enum(["lost", "won"]),
  reason: z.enum(["price", "timing", "budget", "scope", "no_response", "internal_decision", "not_a_fit", "competitor", "other"]).optional().nullable(),
  competitor: z.string().trim().max(240).optional().nullable(),
  lessons: z.string().trim().max(4000).optional().nullable(),
  could_reactivate_later: z.boolean().default(false),
  why_we_won: z.string().trim().max(4000).optional().nullable(),
  what_helped: z.string().trim().max(4000).optional().nullable(),
  potential_expansion: z.string().trim().max(4000).optional().nullable(),
  discount_given: z.coerce.number().finite().nonnegative().optional().nullable(),
  final_value: z.coerce.number().finite().nonnegative().optional().nullable(),
  notes: z.string().trim().max(4000).optional().nullable(),
});

export async function POST(request: Request) {
  try {
    const input = dealReviewSchema.parse(await request.json());
    const { supabase, userId } = await requireUser();

    const { data: opp, error: oppErr } = await supabase
      .from("opportunities")
      .select("id")
      .eq("id", input.opportunity_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (oppErr) throw oppErr;
    if (!opp) return NextResponse.json({ error: "Opportunity not found." }, { status: 404 });

    const { data, error } = await supabase
      .from("deal_reviews")
      .upsert(
        {
          user_id: userId,
          opportunity_id: input.opportunity_id,
          review_type: input.review_type,
          reason: input.reason,
          competitor: input.competitor,
          lessons: input.lessons,
          could_reactivate_later: input.could_reactivate_later,
          review_date: new Date().toISOString().slice(0, 10),
          why_we_won: input.why_we_won,
          what_helped: input.what_helped,
          potential_expansion: input.potential_expansion,
          discount_given: input.discount_given,
          final_value: input.final_value,
          notes: input.notes,
        },
        { onConflict: "user_id,opportunity_id,review_type" }
      )
      .select("*")
      .single();

    if (error) throw error;
    return NextResponse.json({ review: data }, { status: 201 });
  } catch (error) {
    return apiError(error, "Deal review could not be saved.");
  }
}
