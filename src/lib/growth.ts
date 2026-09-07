export type LeadQuality = "Hot" | "Warm" | "Cold" | "Unqualified";
export type OpportunityPriority = "Critical" | "High" | "Medium" | "Low";
export type OpportunityHealth = "Healthy" | "Needs attention" | "At risk" | "Stalled";
export type PipelineQualitySignal = "Healthy" | "Concentrated" | "Top-heavy" | "Stalled" | "Underfilled" | "Low-quality" | "Unbalanced";
export type ForecastBucket = "Committed" | "Likely" | "Possible";
export type ReactivationState = "Good candidate" | "Maybe" | "Do not pursue";

export interface LeadScoringInput {
  id: string;
  name: string;
  company?: string | null;
  status: string;
  source: string;
  potential_value?: number | null;
  currency?: string | null;
  last_contact_at?: string | null;
  next_follow_up_at?: string | null;
  created_at?: string | null;
}

export interface LeadScoreResult {
  score: number;
  quality: LeadQuality;
  reasons: string[];
  nextAction: string;
}

export function scoreLead(lead: LeadScoringInput, today = new Date().toISOString().slice(0, 10)): LeadScoreResult {
  if (["unqualified", "lost"].includes(lead.status)) {
    return {
      score: 10,
      quality: "Unqualified",
      reasons: [lead.status === "lost" ? "Lead marked as lost." : "Lead marked unqualified."],
      nextAction: "Archive or review reactivation feasibility later.",
    };
  }

  let score = 40;
  const reasons: string[] = [];

  if (lead.status === "qualified") {
    score += 25;
    reasons.push("Explicitly qualified prospect.");
  } else if (lead.status === "contacted") {
    score += 10;
    reasons.push("Initial contact established.");
  } else if (lead.status === "new") {
    score += 5;
    reasons.push("New inbound lead awaiting triage.");
  }

  const value = Number(lead.potential_value ?? 0);
  if (value >= 25000) {
    score += 20;
    reasons.push(`High potential value (${value} ${lead.currency ?? "MAD"}).`);
  } else if (value >= 10000) {
    score += 10;
    reasons.push(`Moderate potential value (${value} ${lead.currency ?? "MAD"}).`);
  }

  if (["referral", "existing_client"].includes(lead.source)) {
    score += 15;
    reasons.push(`High-intent source (${lead.source.replace("_", " ")}).`);
  } else if (["website", "whatsapp_manual"].includes(lead.source)) {
    score += 5;
    reasons.push(`Direct inbound channel (${lead.source.replace("_", " ")}).`);
  }

  if (lead.next_follow_up_at) {
    const followDate = lead.next_follow_up_at.slice(0, 10);
    if (followDate < today) {
      score -= 10;
      reasons.push("Scheduled follow-up is overdue.");
    } else {
      score += 5;
      reasons.push("Active follow-up scheduled.");
    }
  } else {
    score -= 5;
    reasons.push("No next follow-up date recorded.");
  }

  const boundedScore = Math.max(0, Math.min(100, score));
  let quality: LeadQuality = "Cold";
  let nextAction = "Schedule an initial discovery conversation.";

  if (boundedScore >= 75) {
    quality = "Hot";
    nextAction = lead.next_follow_up_at && lead.next_follow_up_at.slice(0, 10) < today
      ? "Execute overdue follow-up immediately."
      : "Send formal proposal or schedule closing call.";
  } else if (boundedScore >= 50) {
    quality = "Warm";
    nextAction = "Confirm budget, timeline, and commercial scope.";
  } else {
    quality = "Cold";
    nextAction = "Nurture with relevant case study or verify intent.";
  }

  return { score: boundedScore, quality, reasons, nextAction };
}

export interface OpportunityHealthInput {
  id: string;
  title: string;
  stage: string;
  estimated_value?: number | null;
  currency?: string | null;
  probability?: number | null;
  expected_close_date?: string | null;
  next_action?: string | null;
  next_action_date?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  proposal_status?: string | null;
  proposal_sent_at?: string | null;
  last_activity_date?: string | null;
}

export interface OpportunityScoringResult {
  priority: OpportunityPriority;
  health: OpportunityHealth;
  score: number;
  risks: string[];
  reasons: string[];
  nextAction: string;
  daysInStage: number;
}

export function scoreOpportunity(opp: OpportunityHealthInput, today = new Date().toISOString().slice(0, 10)): OpportunityScoringResult {
  const updated = opp.updated_at ? opp.updated_at.slice(0, 10) : today;
  const daysInStage = Math.max(0, Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${updated}T00:00:00Z`)) / 86400000));
  const value = Number(opp.estimated_value ?? 0);

  const risks: string[] = [];
  const reasons: string[] = [];
  let frictionScore = 0;
  let momentumScore = 50;

  if (!opp.next_action || !opp.next_action.trim()) {
    risks.push("No next sales action scheduled.");
    frictionScore += 30;
  } else {
    reasons.push(`Next action planned: ${opp.next_action}`);
  }

  if (opp.expected_close_date && opp.expected_close_date < today) {
    risks.push(`Expected close date was ${opp.expected_close_date} (overdue).`);
    frictionScore += 25;
  }

  if (opp.proposal_status === "sent" && opp.proposal_sent_at) {
    const daysSinceProposal = Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${opp.proposal_sent_at.slice(0, 10)}T00:00:00Z`)) / 86400000);
    if (daysSinceProposal >= 5) {
      risks.push(`Proposal sent ${daysSinceProposal} days ago with no response.`);
      frictionScore += 20;
    }
  }

  if (daysInStage >= 30) {
    risks.push(`Stage unchanged for ${daysInStage} days.`);
    frictionScore += 25;
  } else if (daysInStage <= 7) {
    momentumScore += 20;
    reasons.push("Recent activity in past 7 days.");
  }

  if (value >= 30000) {
    reasons.push(`High commercial value (${value} ${opp.currency ?? "MAD"}).`);
  }

  let health: OpportunityHealth = "Healthy";
  if (daysInStage >= 45 || frictionScore >= 60) {
    health = "Stalled";
  } else if (risks.length >= 2 || (frictionScore >= 35 && value >= 20000)) {
    health = "At risk";
  } else if (risks.length === 1 || daysInStage >= 21) {
    health = "Needs attention";
  } else {
    health = "Healthy";
  }

  let priority: OpportunityPriority = "Low";
  if (value >= 30000 || (value >= 15000 && health === "At risk")) {
    priority = "Critical";
  } else if (value >= 15000 || (value >= 5000 && health === "Needs attention")) {
    priority = "High";
  } else if (value >= 5000) {
    priority = "Medium";
  } else {
    priority = "Low";
  }

  let nextAction = opp.next_action?.trim() ?? "";
  if (!nextAction) {
    if (opp.stage === "proposal") {
      nextAction = "Schedule proposal follow-up call.";
    } else if (opp.stage === "negotiation") {
      nextAction = "Clarify commercial terms or closing timeline.";
    } else if (opp.stage === "qualified" || opp.stage === "meeting") {
      nextAction = "Prepare formal proposal or scope document.";
    } else {
      nextAction = "Schedule qualification meeting.";
    }
  }

  const compositeScore = Math.max(0, Math.min(100, momentumScore - frictionScore + (value > 20000 ? 20 : 0)));

  return {
    priority,
    health,
    score: compositeScore,
    risks,
    reasons,
    nextAction,
    daysInStage,
  };
}

export interface NextGrowthMove {
  id: string;
  title: string;
  subtitle: string;
  value?: number | null;
  currency?: string | null;
  reason: string;
  actionLabel: string;
  route: string;
  priorityScore: number;
}

export function rankNextGrowthMove(
  opportunities: OpportunityHealthInput[],
  leads: LeadScoringInput[],
  proposals: Array<{ id: string; title: string; total: number; currency: string; valid_until?: string | null; status: string; updated_at?: string | null }>,
  today = new Date().toISOString().slice(0, 10)
): NextGrowthMove | null {
  const candidates: NextGrowthMove[] = [];

  for (const opp of opportunities.filter((o) => !["won", "lost"].includes(o.stage))) {
    const scored = scoreOpportunity(opp, today);
    const val = Number(opp.estimated_value ?? 0);
    let score = val;

    if (scored.priority === "Critical") score += 100000;
    else if (scored.priority === "High") score += 50000;
    if (scored.health === "At risk") score += 30000;
    else if (scored.health === "Needs attention") score += 15000;

    candidates.push({
      id: `opp:${opp.id}`,
      title: opp.title,
      subtitle: scored.nextAction,
      value: val,
      currency: opp.currency ?? "MAD",
      reason: scored.risks[0] ?? scored.reasons[0] ?? "Active opportunity requiring attention.",
      actionLabel: "Open Opportunity",
      route: `/pipeline?opportunity=${opp.id}`,
      priorityScore: score,
    });
  }

  for (const prop of proposals.filter((p) => p.status === "sent")) {
    const val = Number(prop.total ?? 0);
    const expiringSoon = prop.valid_until && prop.valid_until <= new Date(Date.now() + 4 * 86400000).toISOString().slice(0, 10);
    const score = val + (expiringSoon ? 60000 : 25000);

    candidates.push({
      id: `prop:${prop.id}`,
      title: `Follow up on proposal: ${prop.title}`,
      subtitle: expiringSoon ? `Proposal expires ${prop.valid_until}.` : "Proposal awaiting client response.",
      value: val,
      currency: prop.currency ?? "MAD",
      reason: expiringSoon ? "Proposal expires within 4 days." : "Proposal sent to client without active scheduled follow-up.",
      actionLabel: "View Proposal",
      route: `/proposals?proposal=${prop.id}`,
      priorityScore: score,
    });
  }

  for (const lead of leads.filter((l) => !["unqualified", "lost", "converted"].includes(l.status))) {
    const scored = scoreLead(lead, today);
    const val = Number(lead.potential_value ?? 0);
    if (scored.quality === "Hot" || scored.quality === "Warm") {
      const score = val + (scored.quality === "Hot" ? 40000 : 10000);
      candidates.push({
        id: `lead:${lead.id}`,
        title: `Progress lead: ${lead.name}`,
        subtitle: scored.nextAction,
        value: val,
        currency: lead.currency ?? "MAD",
        reason: scored.reasons[0] ?? "Qualified inbound lead.",
        actionLabel: "Open Lead",
        route: `/leads?lead=${lead.id}`,
        priorityScore: score,
      });
    }
  }

  candidates.sort((a, b) => b.priorityScore - a.priorityScore);
  return candidates[0] ?? null;
}

export interface PipelineQualitySummary {
  totalOpenValue: number;
  openCount: number;
  stalledValue: number;
  noNextActionValue: number;
  closingThisMonthValue: number;
  overdueCloseDateValue: number;
  weightedPipelineValue: number | null;
  stageDistribution: Record<string, { count: number; value: number }>;
  serviceDistribution: Record<string, { count: number; value: number }>;
  sourceDistribution: Record<string, { count: number; value: number }>;
  qualitySignals: PipelineQualitySignal[];
  explanation: string;
}

export function evaluatePipelineQuality(
  opportunities: Array<OpportunityHealthInput & { service_id?: string | null; source?: string | null }>,
  today = new Date().toISOString().slice(0, 10)
): PipelineQualitySummary {
  const open = opportunities.filter((o) => !["won", "lost"].includes(o.stage));
  let totalOpenValue = 0;
  let stalledValue = 0;
  let noNextActionValue = 0;
  let closingThisMonthValue = 0;
  let overdueCloseDateValue = 0;
  let hasExplicitProbabilities = false;
  let weightedSum = 0;

  const currentMonth = today.slice(0, 7);
  const stageDistribution: Record<string, { count: number; value: number }> = {};
  const serviceDistribution: Record<string, { count: number; value: number }> = {};
  const sourceDistribution: Record<string, { count: number; value: number }> = {};

  for (const opp of open) {
    const val = Number(opp.estimated_value ?? 0);
    totalOpenValue += val;

    stageDistribution[opp.stage] = stageDistribution[opp.stage] ?? { count: 0, value: 0 };
    stageDistribution[opp.stage].count += 1;
    stageDistribution[opp.stage].value += val;

    const srv = opp.service_id ?? "unassigned";
    serviceDistribution[srv] = serviceDistribution[srv] ?? { count: 0, value: 0 };
    serviceDistribution[srv].count += 1;
    serviceDistribution[srv].value += val;

    const src = opp.source ?? "unknown";
    sourceDistribution[src] = sourceDistribution[src] ?? { count: 0, value: 0 };
    sourceDistribution[src].count += 1;
    sourceDistribution[src].value += val;

    const scored = scoreOpportunity(opp, today);
    if (scored.health === "Stalled") stalledValue += val;
    if (!opp.next_action || !opp.next_action.trim()) noNextActionValue += val;

    if (opp.expected_close_date) {
      if (opp.expected_close_date < today) overdueCloseDateValue += val;
      else if (opp.expected_close_date.slice(0, 7) === currentMonth) closingThisMonthValue += val;
    }

    if (opp.probability != null) {
      hasExplicitProbabilities = true;
      weightedSum += (val * Number(opp.probability)) / 100;
    }
  }

  const signals: PipelineQualitySignal[] = [];
  const explanations: string[] = [];

  if (open.length === 0) {
    signals.push("Underfilled");
    explanations.push("Pipeline is currently empty.");
  } else {
    if (stalledValue > 0 && totalOpenValue > 0 && stalledValue / totalOpenValue >= 0.35) {
      signals.push("Stalled");
      explanations.push(`${Math.round((stalledValue / totalOpenValue) * 100)}% of pipeline value is stalled.`);
    }

    const values = Object.values(serviceDistribution).map((s) => s.value);
    const maxServiceVal = Math.max(...values, 0);
    if (totalOpenValue > 0 && maxServiceVal / totalOpenValue >= 0.6) {
      signals.push("Concentrated");
      explanations.push("Heavy value concentration in a single service category.");
    }

    const proposalVal = (stageDistribution.proposal?.value ?? 0) + (stageDistribution.negotiation?.value ?? 0);
    const earlyVal = (stageDistribution.new?.value ?? 0) + (stageDistribution.qualified?.value ?? 0);
    if (totalOpenValue > 20000 && earlyVal < totalOpenValue * 0.15 && proposalVal > totalOpenValue * 0.7) {
      signals.push("Top-heavy");
      explanations.push("Pipeline is top-heavy with insufficient new inbound qualification.");
    } else if (totalOpenValue > 0 && earlyVal > totalOpenValue * 0.8) {
      signals.push("Underfilled");
      explanations.push("Most pipeline is in early stages with few qualified proposals.");
    }

    if (noNextActionValue > 0 && totalOpenValue > 0 && noNextActionValue / totalOpenValue >= 0.4) {
      signals.push("Unbalanced");
      explanations.push("Substantial open deal value lacks scheduled next actions.");
    }

    if (signals.length === 0) {
      signals.push("Healthy");
      explanations.push("Pipeline has balanced stage progression and active next steps.");
    }
  }

  return {
    totalOpenValue,
    openCount: open.length,
    stalledValue,
    noNextActionValue,
    closingThisMonthValue,
    overdueCloseDateValue,
    weightedPipelineValue: hasExplicitProbabilities ? Math.round(weightedSum) : null,
    stageDistribution,
    serviceDistribution,
    sourceDistribution,
    qualitySignals: signals,
    explanation: explanations.join(" "),
  };
}

export interface ExpansionCandidate {
  clientId: string;
  clientName: string;
  expansionType: "Upsell" | "Cross-sell" | "Renewal" | "Maintenance" | "Retainer" | "Referral opportunity" | "New project";
  evidence: string;
  potentialService?: string | null;
  suggestedAction: string;
}

export function identifyExpansionCandidates(
  clients: Array<{ id: string; name: string; status?: string }>,
  projects: Array<{ id: string; client_id: string; status: string; updated_at?: string | null; name: string }>,
  invoices: Array<{ id: string; client_id: string; total_amount: number; status: string }>,
  servicesDelivered: Array<{ client_id: string; service_id?: string | null; service_name?: string }>,
  today = new Date().toISOString().slice(0, 10)
): ExpansionCandidate[] {
  const results: ExpansionCandidate[] = [];

  const completedProjectsByClient = new Map<string, Array<{ id: string; name: string; updated_at?: string | null }>>();
  for (const p of projects) {
    if (p.status === "completed" && p.client_id) {
      const list = completedProjectsByClient.get(p.client_id) ?? [];
      list.push(p);
      completedProjectsByClient.set(p.client_id, list);
    }
  }

  const activeServicesByClient = new Map<string, Set<string>>();
  for (const s of servicesDelivered) {
    if (s.client_id && s.service_name) {
      const set = activeServicesByClient.get(s.client_id) ?? new Set();
      set.add(s.service_name.toLowerCase());
      activeServicesByClient.set(s.client_id, set);
    }
  }

  for (const client of clients) {
    if (client.status === "archived") continue;
    const completed = completedProjectsByClient.get(client.id) ?? [];
    const clientServices = activeServicesByClient.get(client.id) ?? new Set();

    for (const project of completed) {
      const monthsSinceCompletion = project.updated_at
        ? Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${project.updated_at.slice(0, 10)}T00:00:00Z`)) / (30 * 86400000))
        : 0;

      const isWebProject = /web|site|portal|landing/i.test(project.name);
      const hasMaintenance = Array.from(clientServices).some((s) => /maintenance|retainer|support/i.test(s));

      if (isWebProject && !hasMaintenance && monthsSinceCompletion >= 2) {
        results.push({
          clientId: client.id,
          clientName: client.name,
          expansionType: "Maintenance",
          evidence: `Client completed ${project.name} ${monthsSinceCompletion} months ago with no ongoing maintenance package attached.`,
          potentialService: "Website Maintenance Retainer",
          suggestedAction: "Propose quarterly maintenance and security support package.",
        });
        break;
      }

      if (monthsSinceCompletion >= 6) {
        results.push({
          clientId: client.id,
          clientName: client.name,
          expansionType: "New project",
          evidence: `Client successfully completed ${project.name} over 6 months ago with no active project since.`,
          suggestedAction: "Reach out for follow-up review on project outcomes and discuss roadmap items.",
        });
        break;
      }
    }
  }

  return results;
}

export interface DormantClientCandidate {
  clientId: string;
  clientName: string;
  lastActivityDate: string;
  historicalValue: number;
  currency: string;
  reason: string;
  suggestedAction: string;
}

export function identifyDormantClients(
  clients: Array<{ id: string; name: string; last_contact_at?: string | null; updated_at?: string | null }>,
  projects: Array<{ client_id: string; updated_at?: string | null }>,
  invoices: Array<{ client_id: string; total_amount: number; currency?: string; paid_at?: string | null; updated_at?: string | null }>,
  today = new Date().toISOString().slice(0, 10)
): DormantClientCandidate[] {
  const candidates: DormantClientCandidate[] = [];

  for (const client of clients) {
    const clientProjects = projects.filter((p) => p.client_id === client.id);
    const clientInvoices = invoices.filter((i) => i.client_id === client.id);
    const totalValue = clientInvoices.reduce((sum, i) => sum + Number(i.total_amount ?? 0), 0);

    const dates = [
      client.last_contact_at?.slice(0, 10),
      client.updated_at?.slice(0, 10),
      ...clientProjects.map((p) => p.updated_at?.slice(0, 10)),
      ...clientInvoices.map((i) => i.paid_at?.slice(0, 10) ?? i.updated_at?.slice(0, 10)),
    ].filter((d): d is string => Boolean(d));

    if (!dates.length) continue;
    dates.sort().reverse();
    const lastActive = dates[0];
    const daysSince = Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${lastActive}T00:00:00Z`)) / 86400000);

    if (daysSince >= 90 && totalValue > 0) {
      candidates.push({
        clientId: client.id,
        clientName: client.name,
        lastActivityDate: lastActive,
        historicalValue: totalValue,
        currency: clientInvoices[0]?.currency ?? "MAD",
        reason: `Dormant for ${daysSince} days with past spend of ${totalValue} ${clientInvoices[0]?.currency ?? "MAD"}.`,
        suggestedAction: "Send a personalized relationship check-in sharing recent work or insights.",
      });
    }
  }

  candidates.sort((a, b) => b.historicalValue - a.historicalValue);
  return candidates;
}

export interface DormantLeadCandidate {
  leadId: string;
  name: string;
  company?: string | null;
  state: ReactivationState;
  potentialValue?: number | null;
  currency?: string | null;
  reason: string;
  suggestedAction: string;
}

export function identifyLeadReactivations(
  leads: Array<{ id: string; name: string; company?: string | null; status: string; potential_value?: number | null; currency?: string | null; last_contact_at?: string | null; notes?: string | null }>,
  opportunities: Array<{ lead_id?: string | null; lost_reason?: string | null; stage: string }>,
  today = new Date().toISOString().slice(0, 10)
): DormantLeadCandidate[] {
  const results: DormantLeadCandidate[] = [];

  for (const lead of leads) {
    const opp = opportunities.find((o) => o.lead_id === lead.id);
    const reason = opp?.lost_reason ?? "";

    if (reason === "timing" || reason === "budget") {
      results.push({
        leadId: lead.id,
        name: lead.name,
        company: lead.company,
        state: "Good candidate",
        potentialValue: lead.potential_value,
        currency: lead.currency,
        reason: `Previously lost due to ${reason}. Timing or fiscal budget may have cleared.`,
        suggestedAction: "Reach out to check if project timing or priorities have reopened.",
      });
    } else if (reason === "no_response" || (lead.status === "contacted" && lead.last_contact_at && (Date.parse(`${today}T00:00:00Z`) - Date.parse(lead.last_contact_at.slice(0, 10) + "T00:00:00Z")) > 60 * 86400000)) {
      results.push({
        leadId: lead.id,
        name: lead.name,
        company: lead.company,
        state: "Maybe",
        potentialValue: lead.potential_value,
        currency: lead.currency,
        reason: "Went quiet previously; gentle re-engagement may uncover revived interest.",
        suggestedAction: "Send short value-add case study.",
      });
    } else if (reason === "not_a_fit" || reason === "competitor" || lead.status === "unqualified") {
      results.push({
        leadId: lead.id,
        name: lead.name,
        company: lead.company,
        state: "Do not pursue",
        potentialValue: lead.potential_value,
        currency: lead.currency,
        reason: reason ? `Explicitly closed due to ${reason}.` : "Lead unqualified.",
        suggestedAction: "Do not pursue unless inbound interest returns.",
      });
    }
  }

  return results;
}

export interface ServiceOfferMetric {
  serviceId: string;
  serviceName: string;
  category?: string | null;
  proposalCount: number;
  winCount: number;
  lossCount: number;
  revenue: number;
  averageDealSize: number | null;
  acceptanceRate: number | null;
  averageDiscount: number | null;
  pipelineValue: number;
  insufficientSample: boolean;
}

export function computeOfferIntelligence(
  services: Array<{ id: string; name: string; category?: string | null }>,
  proposalItems: Array<{ service_id?: string | null; total: number; proposal_id: string }>,
  proposals: Array<{ id: string; status: string; total: number; discount_amount?: number | null; opportunity_id?: string | null }>,
  opportunities?: Array<{ id: string; stage: string; estimated_value?: number | null }>
): ServiceOfferMetric[] {
  const proposalStatusMap = new Map(proposals.map((p) => [p.id, p]));
  const oppMap = new Map((opportunities ?? []).map((o) => [o.id, o]));

  return services.map((service) => {
    const items = proposalItems.filter((item) => item.service_id === service.id);
    const proposalIds = new Set(items.map((i) => i.proposal_id));
    const linkedProposals = Array.from(proposalIds).map((id) => proposalStatusMap.get(id)).filter((p): p is NonNullable<typeof p> => Boolean(p));

    const proposalCount = linkedProposals.length;
    const wins = linkedProposals.filter((p) => p.status === "accepted");
    const losses = linkedProposals.filter((p) => ["rejected", "expired"].includes(p.status));
    const winCount = wins.length;
    const lossCount = losses.length;

    const revenue = wins.reduce((sum, p) => sum + Number(p.total ?? 0), 0);
    const averageDealSize = winCount > 0 ? Math.round(revenue / winCount) : null;
    const totalDecided = winCount + lossCount;
    const acceptanceRate = totalDecided >= 3 ? Math.round((winCount / totalDecided) * 100) : null;

    const discounts = linkedProposals.map((p) => Number(p.discount_amount ?? 0));
    const totalDiscount = discounts.reduce((a, b) => a + b, 0);
    const averageDiscount = linkedProposals.length > 0 ? Math.round(totalDiscount / linkedProposals.length) : null;

    const pipelineValue = linkedProposals
      .filter((p) => !["accepted", "rejected", "expired"].includes(p.status))
      .reduce((sum, p) => sum + (p.opportunity_id ? Number(oppMap.get(p.opportunity_id)?.estimated_value ?? p.total ?? 0) : Number(p.total ?? 0)), 0);

    return {
      serviceId: service.id,
      serviceName: service.name,
      category: service.category,
      proposalCount,
      winCount,
      lossCount,
      revenue,
      averageDealSize,
      acceptanceRate,
      averageDiscount,
      pipelineValue,
      insufficientSample: proposalCount < 3,
    };
  });
}

export interface ChannelPerformanceMetric {
  channel: string;
  leadCount: number;
  qualifiedLeadCount: number;
  opportunityCount: number;
  proposalCount: number;
  winCount: number;
  revenue: number;
  cost?: number | null;
  cac?: number | null;
}

export function computeChannelPerformance(
  leads: Array<{ id: string; source: string; status: string }>,
  opportunities: Array<{ id: string; source?: string | null; stage: string; estimated_value?: number | null }>,
  proposals: Array<{ id: string; opportunity_id?: string | null; status: string; total: number }>,
  attributionRecords?: Array<{ channel: string; cost_amount?: number | null }>
): {
  channels: ChannelPerformanceMetric[];
  knownAttributedRevenue: number;
  unattributedRevenue: number;
  unknownSourceCount: number;
} {
  const channelBuckets = new Map<string, ChannelPerformanceMetric>();
  const oppById = new Map(opportunities.map((o) => [o.id, o]));

  const getBucket = (channel: string) => {
    const key = channel || "other";
    if (!channelBuckets.has(key)) {
      channelBuckets.set(key, {
        channel: key,
        leadCount: 0,
        qualifiedLeadCount: 0,
        opportunityCount: 0,
        proposalCount: 0,
        winCount: 0,
        revenue: 0,
      });
    }
    return channelBuckets.get(key)!;
  };

  let unknownSourceCount = 0;
  for (const lead of leads) {
    if (!lead.source || lead.source === "other") unknownSourceCount += 1;
    const bucket = getBucket(lead.source);
    bucket.leadCount += 1;
    if (["qualified", "converted"].includes(lead.status)) bucket.qualifiedLeadCount += 1;
  }

  for (const opp of opportunities) {
    const bucket = getBucket(opp.source ?? "other");
    bucket.opportunityCount += 1;
    if (opp.stage === "won") {
      bucket.winCount += 1;
      bucket.revenue += Number(opp.estimated_value ?? 0);
    }
  }

  for (const prop of proposals) {
    const opp = prop.opportunity_id ? oppById.get(prop.opportunity_id) : null;
    const bucket = getBucket(opp?.source ?? "other");
    bucket.proposalCount += 1;
  }

  let knownAttributedRevenue = 0;
  let unattributedRevenue = 0;

  if (attributionRecords?.length) {
    for (const record of attributionRecords) {
      const bucket = getBucket(record.channel);
      if (record.cost_amount != null && bucket.winCount > 0) {
        bucket.cac = Math.round(Number(record.cost_amount) / bucket.winCount);
      }
    }
  }

  for (const [key, b] of channelBuckets) {
    if (key === "other" || key === "unknown") {
      unattributedRevenue += b.revenue;
    } else {
      knownAttributedRevenue += b.revenue;
    }
  }

  return {
    channels: Array.from(channelBuckets.values()).sort((a, b) => b.revenue - a.revenue),
    knownAttributedRevenue,
    unattributedRevenue,
    unknownSourceCount,
  };
}

export interface GrowthForecastItem {
  id: string;
  title: string;
  value: number;
  currency: string;
  bucket: ForecastBucket;
  stage: string;
  expectedCloseDate?: string | null;
  ruleReason: string;
}

export function buildGrowthForecast(
  opportunities: Array<{ id: string; title: string; stage: string; estimated_value?: number | null; currency?: string | null; expected_close_date?: string | null; probability?: number | null }>,
  proposals: Array<{ id: string; opportunity_id?: string | null; status: string; total: number; currency?: string | null }>
): {
  items: GrowthForecastItem[];
  totalsByBucket: Record<ForecastBucket, number>;
  totalOpenValue: number;
} {
  const proposalByOpp = new Map(proposals.map((p) => [p.opportunity_id, p]));
  const items: GrowthForecastItem[] = [];
  const totalsByBucket: Record<ForecastBucket, number> = { Committed: 0, Likely: 0, Possible: 0 };
  let totalOpenValue = 0;

  for (const opp of opportunities.filter((o) => !["won", "lost"].includes(o.stage))) {
    const val = Number(opp.estimated_value ?? 0);
    totalOpenValue += val;
    const linkedProp = opp.id ? proposalByOpp.get(opp.id) : null;

    let bucket: ForecastBucket = "Possible";
    let ruleReason = "Early-stage discovery pipeline.";

    if (opp.probability != null && opp.probability >= 80) {
      bucket = "Committed";
      ruleReason = `High explicit probability (${opp.probability}%).`;
    } else if (opp.stage === "negotiation" || linkedProp?.status === "accepted") {
      bucket = "Committed";
      ruleReason = "In final commercial negotiation or proposal accepted.";
    } else if (opp.probability != null && opp.probability >= 50) {
      bucket = "Likely";
      ruleReason = `Moderate explicit probability (${opp.probability}%).`;
    } else if (opp.stage === "proposal" || linkedProp?.status === "sent") {
      bucket = "Likely";
      ruleReason = "Formal proposal sent and undergoing review.";
    } else if (opp.stage === "qualified" || opp.stage === "meeting") {
      bucket = "Possible";
      ruleReason = "Qualified commercial lead moving through early stages.";
    }

    totalsByBucket[bucket] += val;
    items.push({
      id: opp.id,
      title: opp.title,
      value: val,
      currency: opp.currency ?? "MAD",
      bucket,
      stage: opp.stage,
      expectedCloseDate: opp.expected_close_date,
      ruleReason,
    });
  }

  return { items, totalsByBucket, totalOpenValue };
}

export interface GrowthRisk {
  id: string;
  risk: string;
  severity: "critical" | "important" | "attention";
  evidence: string;
  affectedValue?: number | null;
  currency?: string | null;
  recommendedAction: string;
}

export function detectGrowthRisks(
  opportunities: OpportunityHealthInput[],
  clients: Array<{ id: string; name: string }>,
  proposals: Array<{ id: string; total: number; status: string; valid_until?: string | null }>,
  today = new Date().toISOString().slice(0, 10)
): GrowthRisk[] {
  const risks: GrowthRisk[] = [];
  const openOpps = opportunities.filter((o) => !["won", "lost"].includes(o.stage));
  const totalOpenVal = openOpps.reduce((sum, o) => sum + Number(o.estimated_value ?? 0), 0);

  const noNextAction = openOpps.filter((o) => !o.next_action || !o.next_action.trim());
  const noNextActionVal = noNextAction.reduce((sum, o) => sum + Number(o.estimated_value ?? 0), 0);
  if (noNextAction.length >= 2 && noNextActionVal > 0) {
    risks.push({
      id: "risk:no-next-action",
      risk: "Opportunities without scheduled next actions",
      severity: noNextActionVal >= 30000 ? "critical" : "important",
      evidence: `${noNextAction.length} open opportunities worth ${noNextActionVal} MAD have no scheduled next step.`,
      affectedValue: noNextActionVal,
      currency: "MAD",
      recommendedAction: "Assign clear next sales actions and due dates on open opportunities.",
    });
  }

  const overdueOpps = openOpps.filter((o) => o.expected_close_date && o.expected_close_date < today);
  const overdueVal = overdueOpps.reduce((sum, o) => sum + Number(o.estimated_value ?? 0), 0);
  if (overdueOpps.length > 0) {
    risks.push({
      id: "risk:overdue-close-dates",
      risk: "Overdue expected close dates",
      severity: "attention",
      evidence: `${overdueOpps.length} opportunities have expected close dates in the past.`,
      affectedValue: overdueVal,
      currency: "MAD",
      recommendedAction: "Review and update expected close dates or adjust pipeline timing.",
    });
  }

  const stalledOpps = openOpps.filter((o) => {
    const updated = o.updated_at ? o.updated_at.slice(0, 10) : today;
    const days = Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${updated}T00:00:00Z`)) / 86400000);
    return days >= 30;
  });
  const stalledVal = stalledOpps.reduce((sum, o) => sum + Number(o.estimated_value ?? 0), 0);
  if (totalOpenVal > 0 && stalledVal / totalOpenVal >= 0.35) {
    risks.push({
      id: "risk:stalled-pipeline",
      risk: "High stalled pipeline concentration",
      severity: "important",
      evidence: `${Math.round((stalledVal / totalOpenVal) * 100)}% of pipeline value has not moved in >30 days.`,
      affectedValue: stalledVal,
      currency: "MAD",
      recommendedAction: "Conduct pipeline hygiene: qualify out unpromising deals or send check-ins.",
    });
  }

  return risks;
}
