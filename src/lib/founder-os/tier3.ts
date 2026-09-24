import type { Row } from "./repository";
import { daysUntil, isOpen, numberOrNull, type Severity, type Signal, type Sources } from "./intelligence";
import { founderBottlenecks, type StateFact } from "./tier1";

// 1. Experiment Engine Intelligence
export function experimentSignals(data: Sources, today: string): Signal[] {
  const signals: Signal[] = [];
  const experiments = data.experiments ?? [];

  for (const exp of experiments) {
    const endDays = daysUntil(exp.end_date, today);
    const isRunningOrPlanned = ["running", "planned", "idea"].includes(String(exp.status));

    // Overdue experiment review
    if (isRunningOrPlanned && endDays !== null && endDays < 0) {
      signals.push({
        id: `exp:overdue:${exp.id}`,
        sourceId: exp.id,
        type: "EXPERIMENT_REVIEW_DUE",
        domain: "learning",
        title: `Experiment review overdue: ${exp.name}`,
        severity: "high",
        reasons: [
          `Target review date ${exp.end_date} is ${Math.abs(endDays)} days overdue.`,
          `Hypothesis: "${exp.hypothesis}". Status: ${exp.status}.`,
          "Evaluate observations against baseline/target before drawing conclusions.",
        ],
        impact: "Decisions and strategies continue to operate on unvalidated assumptions.",
        action: "Record observed results and conclude experiment",
        route: `/experiments?record=${exp.id}`,
        companyId: exp.company_id ? String(exp.company_id) : undefined,
        deadline: exp.end_date ? String(exp.end_date) : undefined,
        detectedAt: today,
      });
    }

    // Inconclusive completed experiment
    if (exp.status === "completed" && (exp.outcome_result === "INCONCLUSIVE" || (!exp.outcome_result && exp.actual_value === null))) {
      signals.push({
        id: `exp:inconclusive:${exp.id}`,
        sourceId: exp.id,
        type: "EXPERIMENT_INCONCLUSIVE",
        domain: "learning",
        title: `Inconclusive experiment: ${exp.name}`,
        severity: "medium",
        reasons: [
          "Experiment ended without conclusive empirical verification.",
          `Target metric: ${exp.target_metric ?? "unspecified"}.`,
          "Review measurement methodology before repeating the hypothesis.",
        ],
        impact: "Resources were invested without resolving the strategic question.",
        action: "Review experiment design and formulate refined test",
        route: `/experiments?record=${exp.id}`,
        companyId: exp.company_id ? String(exp.company_id) : undefined,
        detectedAt: today,
      });
    }

    // Missing measurable target
    if (isRunningOrPlanned && exp.baseline === null && exp.target_value === null) {
      signals.push({
        id: `exp:nometric:${exp.id}`,
        sourceId: exp.id,
        type: "EXPERIMENT_MEASUREMENT_MISSING",
        domain: "learning",
        title: `Unmeasured experiment: ${exp.name}`,
        severity: "medium",
        reasons: [
          "No numeric baseline or target threshold is configured.",
          "Hypotheses without measurable criteria cannot provide definitive validation.",
        ],
        impact: "High risk of post-hoc rationalization when evaluating outcomes.",
        action: "Define baseline and target threshold",
        route: `/experiments?record=${exp.id}`,
        companyId: exp.company_id ? String(exp.company_id) : undefined,
        detectedAt: today,
      });
    }
  }

  // Detect repeated hypothesis failures per company
  const byCompany = new Map<string, Row[]>();
  for (const exp of experiments) {
    if (exp.company_id && exp.outcome_result === "NOT_SUPPORTED") {
      const list = byCompany.get(String(exp.company_id)) ?? [];
      list.push(exp);
      byCompany.set(String(exp.company_id), list);
    }
  }
  for (const [companyId, failedExps] of byCompany) {
    if (failedExps.length >= 2) {
      const company = (data.companies ?? []).find(c => c.id === companyId);
      signals.push({
        id: `exp:repeated_failures:${companyId}`,
        sourceId: companyId,
        type: "REPEATED_ASSUMPTION_FAILURE",
        domain: "learning",
        title: `Repeated hypothesis failures: ${company?.name ?? "Business"}`,
        severity: "high",
        reasons: [
          `${failedExps.length} experiments failed their hypotheses: ${failedExps.map(e => e.name).slice(0, 3).join(", ")}.`,
          "Underlying strategic assumptions in this domain appear consistently invalid.",
        ],
        impact: "Repeatedly testing variations of a disproven mental model wastes capital and focus.",
        action: "Re-evaluate core business assumptions in strategic planning",
        route: `/experiments`,
        companyId,
        detectedAt: today,
      });
    }
  }

  return signals;
}

// 2. Forecast Accuracy Intelligence
export function forecastSignals(data: Sources, today: string): Signal[] {
  const signals: Signal[] = [];
  const forecasts = data.forecasts ?? [];

  for (const fc of forecasts) {
    const resDays = daysUntil(fc.resolution_date, today);
    const isUnresolved = fc.resolution === "unresolved" || !fc.resolution;

    if (isUnresolved && resDays !== null && resDays <= 0) {
      signals.push({
        id: `forecast:due:${fc.id}`,
        sourceId: fc.id,
        type: "FORECAST_DUE",
        domain: "decisions",
        title: `Forecast resolution due: ${String(fc.prediction).slice(0, 60)}`,
        severity: resDays < -7 ? "high" : "medium",
        reasons: [
          `Resolution date ${fc.resolution_date} reached (${resDays < 0 ? `${Math.abs(resDays)} days ago` : "today"}).`,
          `Domain: ${fc.domain}. Confidence: ${fc.confidence}.`,
          `Predicted outcome: ${fc.predicted_outcome}.`,
        ],
        impact: "Predictions left unresolved fail to calibrate the founder's estimation accuracy.",
        action: "Record actual outcome and calibration notes",
        route: `/forecasts?record=${fc.id}`,
        companyId: fc.company_id ? String(fc.company_id) : undefined,
        deadline: fc.resolution_date ? String(fc.resolution_date) : undefined,
        detectedAt: today,
      });
    }

    if (fc.confidence === "high" && fc.resolution === "incorrect") {
      signals.push({
        id: `forecast:miss:${fc.id}`,
        sourceId: fc.id,
        type: "HIGH_CONFIDENCE_FORECAST_MISSED",
        domain: "learning",
        title: `High-confidence forecast missed: ${String(fc.prediction).slice(0, 60)}`,
        severity: "high",
        reasons: [
          `Prediction was rated high confidence but resolved incorrect.`,
          `Domain: ${fc.domain}. Predicted: "${fc.predicted_outcome}".`,
          fc.calibration_notes ? `Calibration: ${fc.calibration_notes}` : "No calibration notes recorded yet.",
        ],
        impact: "High confidence coupled with incorrect outcomes indicates overconfidence bias.",
        action: "Capture lesson into Operating Memory",
        route: `/forecasts?record=${fc.id}`,
        companyId: fc.company_id ? String(fc.company_id) : undefined,
        detectedAt: today,
      });
    }
  }

  // Domain bias check: e.g. delivery or revenue with repeated misses
  const byDomain = new Map<string, Row[]>();
  for (const fc of forecasts) {
    if (fc.resolution === "incorrect") {
      const list = byDomain.get(String(fc.domain)) ?? [];
      list.push(fc);
      byDomain.set(String(fc.domain), list);
    }
  }
  for (const [dom, misses] of byDomain) {
    if (misses.length >= 2) {
      signals.push({
        id: `forecast:bias:${dom}`,
        sourceId: dom,
        type: "REPEATED_ASSUMPTION_FAILURE",
        domain: "learning",
        title: `Forecasting bias detected in ${dom}`,
        severity: "medium",
        reasons: [
          `${misses.length} incorrect forecasts recorded in ${dom}.`,
          "Consistently missing outcomes indicates systematic optimism or model error.",
        ],
        impact: "Strategic timelines and commitments anchor to unrealistic projections.",
        action: "Add conservative buffer and adjust estimation heuristic",
        route: `/forecasts`,
        detectedAt: today,
      });
    }
  }

  return signals;
}

export function forecastCalibration(forecasts: Row[]) {
  const resolved = forecasts.filter(f => f.resolution && f.resolution !== "unresolved");
  const correct = resolved.filter(f => f.resolution === "correct").length;
  const partial = resolved.filter(f => f.resolution === "partially_correct").length;
  const incorrect = resolved.filter(f => f.resolution === "incorrect").length;
  const total = resolved.length;
  const accuracyRate = total > 0 ? ((correct + partial * 0.5) / total) * 100 : null;

  const byDomain: Record<string, { total: number; correct: number; incorrect: number }> = {};
  for (const f of resolved) {
    const d = String(f.domain || "general");
    const entry = byDomain[d] ??= { total: 0, correct: 0, incorrect: 0 };
    entry.total += 1;
    if (f.resolution === "correct") entry.correct += 1;
    if (f.resolution === "incorrect") entry.incorrect += 1;
  }

  return { total, correct, partial, incorrect, accuracyRate, byDomain };
}

// 3. Content Pipeline Intelligence
export function contentSignals(data: Sources, today: string): Signal[] {
  const signals: Signal[] = [];
  const items = (data.content ?? []).filter(c => !c.deleted_at);

  for (const c of items) {
    const ageDays = daysUntil(c.created_at, today);
    // Stalled ideas: idea stage > 14 days without progressing
    if (c.status === "idea" && ageDays !== null && ageDays <= -14) {
      signals.push({
        id: `content:stalled:${c.id}`,
        sourceId: c.id,
        type: "CONTENT_PIPELINE_STALLED",
        domain: "growth",
        title: `Stalled content idea: ${c.title}`,
        severity: "medium",
        reasons: [
          `Content idea has remained in idea stage for ${Math.abs(ageDays)} days.`,
          c.content_pillar ? `Pillar: ${c.content_pillar}.` : "No content pillar assigned.",
          "Archive or outline into production.",
        ],
        impact: "Pipeline accumulation without execution creates attention drag.",
        action: "Advance to brief or archive idea",
        route: `/content/${c.id}`,
        companyId: c.company_id ? String(c.company_id) : undefined,
        detectedAt: today,
      });
    }

    // Stuck in review > 5 days
    if (c.status === "review" && ageDays !== null && ageDays <= -5) {
      signals.push({
        id: `content:review_blocked:${c.id}`,
        sourceId: c.id,
        type: "CONTENT_PIPELINE_STALLED",
        domain: "growth",
        title: `Content awaiting review: ${c.title}`,
        severity: "high",
        reasons: [
          `Content draft has been waiting in review for over 5 days.`,
          c.due_date ? `Due date: ${c.due_date}.` : "No due date specified.",
        ],
        impact: "Production cycle delay blocks downstream publishing and distribution.",
        action: "Review and approve or request changes",
        route: `/content/${c.id}`,
        companyId: c.company_id ? String(c.company_id) : undefined,
        detectedAt: today,
      });
    }
  }

  return signals;
}

// 4. Asset Intelligence
export function assetSignals(data: Sources, today: string): Signal[] {
  const signals: Signal[] = [];
  const assets = data.assets ?? [];

  for (const asset of assets) {
    if (asset.status === "archived") continue;

    const maintenanceDays = daysUntil(asset.maintenance_due_date, today);
    const expiryDays = daysUntil(asset.expiry_date, today);
    const reviewDays = daysUntil(asset.review_date, today);
    const lastUsedDays = daysUntil(asset.last_used_date, today);

    // Maintenance due
    if ((maintenanceDays !== null && maintenanceDays <= 7) || (expiryDays !== null && expiryDays <= 14)) {
      const days = maintenanceDays !== null && maintenanceDays <= 7 ? maintenanceDays : expiryDays!;
      signals.push({
        id: `asset:maint:${asset.id}`,
        sourceId: asset.id,
        type: "ASSET_MAINTENANCE_DUE",
        domain: "operations",
        title: `Asset maintenance due: ${asset.name}`,
        severity: days <= 0 ? "high" : "medium",
        reasons: [
          days < 0 ? `Maintenance/renewal was due ${Math.abs(days)} days ago.` : `Due in ${days} days.`,
          `Category: ${asset.value_category ?? "core"}. Type: ${asset.type}.`,
          asset.maintenance_requirement ? `Requirement: ${asset.maintenance_requirement}.` : "Review needed.",
        ],
        impact: "Neglected asset maintenance leads to deprecation, broken dependencies, or license lapse.",
        action: "Perform maintenance or renew asset",
        route: `/assets?record=${asset.id}`,
        companyId: asset.company_id ? String(asset.company_id) : undefined,
        detectedAt: today,
      });
    }

    // Underused valuable asset
    const isValuable = ["core", "differentiating"].includes(String(asset.value_category));
    if (isValuable && lastUsedDays !== null && lastUsedDays <= -60) {
      signals.push({
        id: `asset:underused:${asset.id}`,
        sourceId: asset.id,
        type: "UNDERUSED_ASSET",
        domain: "growth",
        title: `Underused ${asset.value_category} asset: ${asset.name}`,
        severity: "medium",
        reasons: [
          `Marked as ${asset.value_category} value, but has not been used in ${Math.abs(lastUsedDays)} days.`,
          asset.reuse_potential ? `Reuse potential: ${asset.reuse_potential}.` : "High potential leverage.",
          "Identify active projects or campaigns that can repurpose this asset.",
        ],
        impact: "Valuable intellectual property and tools sit idle instead of generating leverage.",
        action: "Link to active project or campaign",
        route: `/assets?record=${asset.id}`,
        companyId: asset.company_id ? String(asset.company_id) : undefined,
        detectedAt: today,
      });
    }

    // Stale asset needing review
    if (asset.status === "active" && reviewDays !== null && reviewDays < 0) {
      signals.push({
        id: `asset:stale:${asset.id}`,
        sourceId: asset.id,
        type: "STALE_ASSET",
        domain: "operations",
        title: `Asset review overdue: ${asset.name}`,
        severity: "medium",
        reasons: [
          `Review date ${asset.review_date} passed ${Math.abs(reviewDays)} days ago.`,
          "Verify asset accuracy, active links, and relevance.",
        ],
        impact: "Outdated assets lead to team confusion or degraded operational quality.",
        action: "Review asset and update verification",
        route: `/assets?record=${asset.id}`,
        companyId: asset.company_id ? String(asset.company_id) : undefined,
        detectedAt: today,
      });
    }
  }

  return signals;
}

// 5. Founder Energy & Attention Intelligence
export function energyAndAttentionSignals(data: Sources, today: string): Signal[] {
  const signals: Signal[] = [];
  const dailyStates = data.dailyStates ?? [];
  const todayState = dailyStates.find(d => d.date === today) ?? dailyStates[0];
  const decisions = (data.decisions ?? []).filter(isOpen);
  const tasks = (data.tasks ?? []).filter(isOpen);
  const sessions = (data.sessions ?? []).filter(s => {
    const age = daysUntil(s.started_at, today);
    return age !== null && age >= -1 && age <= 0;
  });

  // Decision fatigue / high load
  const founderDecisions = decisions.filter(d => d.founder_required === true && ["proposed", "under_review"].includes(String(d.status)));
  if (founderDecisions.length >= 3) {
    signals.push({
      id: "founder:decision_load",
      sourceId: "decisions",
      type: "FOUNDER_DECISION_LOAD_HIGH",
      domain: "attention",
      title: "High founder decision load",
      severity: "high",
      reasons: [
        `${founderDecisions.length} pending decisions explicitly require founder intervention.`,
        `Decisions: ${founderDecisions.map(d => d.title).slice(0, 3).join(", ")}.`,
        "Heavy pending decision queues degrade judgment quality and bottleneck execution.",
      ],
      impact: "Multiple strategic threads are stalled awaiting the same executive bandwidth.",
      action: "Prioritize and resolve top 2 decision gates or delegate framing",
      route: "/decisions",
      detectedAt: today,
    });
  }

  // Context switching detection
  const projectIds = new Set(sessions.map(s => s.project_id).filter(Boolean));
  if (sessions.length >= 6 || projectIds.size >= 4) {
    signals.push({
      id: "founder:context_switching",
      sourceId: "sessions",
      type: "FOUNDER_CONTEXT_SWITCHING_HIGH",
      domain: "attention",
      title: "Excessive context switching",
      severity: "high",
      reasons: [
        `${sessions.length} focus sessions across ${projectIds.size} distinct projects recorded recently.`,
        "Frequent multi-domain fragmentation diminishes deep cognitive bandwidth.",
      ],
      impact: "High fragmentation increases error rate and reduces completion of primary initiatives.",
      action: "Consolidate schedule into dedicated half-day thematic focus blocks",
      route: "/today",
      detectedAt: today,
    });
  }

  // Energy & load correlation
  if (todayState) {
    const isLowEnergy = todayState.energy === "low" || todayState.stress_load === "high";
    const highWorkload = tasks.filter(t => t.priority === "high" || t.priority === "urgent").length >= 5 || sessions.length >= 5;
    if (isLowEnergy && highWorkload) {
      signals.push({
        id: "founder:energy_depleted",
        sourceId: todayState.id,
        type: "FOUNDER_ENERGY_LOW",
        domain: "attention",
        title: "Sustained high load during depleted energy",
        severity: "high",
        reasons: [
          `Self-reported energy: ${todayState.energy}; stress/load: ${todayState.stress_load}.`,
          `Workload includes ${tasks.length} open tasks and high operational pressure.`,
          todayState.cognitive_notes ? `Notes: "${todayState.cognitive_notes}"` : "Cognitive strain reported.",
        ],
        impact: "Pushing through low-energy states on critical decisions yields poor trade-off selections.",
        action: "Reschedule non-urgent meetings and defer low-leverage tasks",
        route: "/state",
        detectedAt: today,
      });
    }
  }

  return signals;
}

// 6. Cross-Domain Executive Synthesis Engine
export type ExecutiveSynthesis = {
  id: string;
  title: string;
  domain: "growth" | "capacity" | "operations" | "continuity";
  observation: string;
  evidence: string[];
  whyItMatters: string;
  suggestedNextStep: string;
  route: string;
};

export function crossDomainSynthesis(data: Sources, today: string): ExecutiveSynthesis[] {
  const syntheses: ExecutiveSynthesis[] = [];

  // RULE 1: Growth Friction Synthesis
  // Revenue / Customer KPI decline + Experiment failed/inconclusive + Content pipeline stalled
  const deterioratingKpis = (data.kpis ?? []).filter(k => k.trend === "deteriorating" || k.status === "critical" || k.status === "attention");
  const failedExperiments = (data.experiments ?? []).filter(e => ["NOT_SUPPORTED", "INCONCLUSIVE"].includes(String(e.outcome_result)));
  const contentStalled = (data.content ?? []).filter(c => c.status === "idea" && (daysUntil(c.created_at, today) ?? 0) <= -14);

  if (deterioratingKpis.length > 0 && (failedExperiments.length > 0 || contentStalled.length > 0)) {
    const kpi = deterioratingKpis[0];
    syntheses.push({
      id: "synth:growth_friction",
      title: "Growth loop deceleration detected",
      domain: "growth",
      observation: "Key commercial metric is slipping while active growth experiments and content output are stalled or inconclusive.",
      evidence: [
        `KPI: ${kpi.name} is ${kpi.trend ?? kpi.status} (${kpi.reason || "off target"}).`,
        ...(failedExperiments.length ? [`Experiment: "${failedExperiments[0].name}" resulted in ${failedExperiments[0].outcome_result}.`] : []),
        ...(contentStalled.length ? [`${contentStalled.length} content ideas have stalled for over 14 days.`] : []),
      ],
      whyItMatters: "When metrics soften while acquisition experiments fail and content pauses, pipeline atrophy accelerates silently.",
      suggestedNextStep: "Review root cause in Business Pulse and formulate a fresh hypothesis in Experiments.",
      route: "/business-pulse",
    });
  }

  // RULE 2: Founder Execution Capacity Bottleneck
  // Stalled project + 2+ founder-required decisions/approvals + high context switching/recurring founder tasks
  const stalledProjects = (data.projects ?? []).filter(p => isOpen(p) && (p.status === "paused" || (daysUntil(p.target_date, today) ?? 0) < 0));
  const founderDecisions = (data.decisions ?? []).filter(d => isOpen(d) && d.founder_required === true);
  const bottlenecks = founderBottlenecks(data, today);

  if (stalledProjects.length > 0 && (founderDecisions.length >= 2 || bottlenecks.length >= 2)) {
    const project = stalledProjects[0];
    syntheses.push({
      id: "synth:founder_bottleneck",
      title: "Execution velocity constrained by founder bandwidth",
      domain: "capacity",
      observation: `Critical delivery on "${project.name}" is delayed while founder attention is divided across multiple gating decisions and operational loops.`,
      evidence: [
        `Project "${project.name}" target date was ${project.target_date ?? "missed"}.`,
        `${founderDecisions.length} pending decisions explicitly require founder signoff.`,
        ...bottlenecks.slice(0, 2).map(b => b.title),
      ],
      whyItMatters: "Team members and projects cannot maintain momentum when the founder is the serialized gate for routine progress.",
      suggestedNextStep: "Unblock pending decisions in Decision Journal and delegate secondary responsibilities.",
      route: "/decisions",
    });
  }

  // RULE 3: Upstream Dependency & Operations Risk
  // Overdue commitment from supplier/partner + degraded system or open incident + active client commitment
  const overdueVendorCommitments = (data.commitments ?? []).filter(c => isOpen(c) && c.direction === "owed_to_me" && (daysUntil(c.due_date, today) ?? 0) < 0);
  const degradedSystems = (data.systems ?? []).filter(s => isOpen(s) && ["degraded", "unavailable"].includes(String(s.status)));
  const clientCommitments = (data.commitments ?? []).filter(c => isOpen(c) && c.direction === "owed_by_me");

  if (overdueVendorCommitments.length > 0 && (degradedSystems.length > 0 || clientCommitments.length > 0)) {
    syntheses.push({
      id: "synth:operational_exposure",
      title: "Upstream vendor failure compounding downstream commitment risk",
      domain: "operations",
      observation: "External partner delays and system fragility directly jeopardize promises made to clients or key stakeholders.",
      evidence: [
        `Overdue from partner: "${overdueVendorCommitments[0].title}" (${overdueVendorCommitments[0].person_label}).`,
        ...(degradedSystems.length ? [`System degraded: ${degradedSystems[0].name} (${degradedSystems[0].status}).`] : []),
        ...(clientCommitments.length ? [`${clientCommitments.length} open commitments owed to clients/team.`] : []),
      ],
      whyItMatters: "External delays become your reputation damage if not escalated or buffered early.",
      suggestedNextStep: "Follow up with counterparty in Relationships and communicate realistic timeline adjustment.",
      route: "/commitments",
    });
  }

  // RULE 4: Uncalibrated Estimation & Strategic Drift
  // Multiple missed forecasts + unreviewed decision + high-impact materialized risk
  const missedForecasts = (data.forecasts ?? []).filter(f => f.resolution === "incorrect");
  const unreviewedDecisions = (data.decisions ?? []).filter(d => isOpen(d) && d.review_date && (daysUntil(d.review_date, today) ?? 0) < 0);

  if (missedForecasts.length >= 2 && unreviewedDecisions.length >= 1) {
    syntheses.push({
      id: "synth:estimation_calibration",
      title: "Systematic prediction bias affecting strategic planning",
      domain: "continuity",
      observation: "Repeated forecast misses combined with unreviewed past decisions suggest strategy is anchoring on inaccurate predictive models.",
      evidence: [
        `${missedForecasts.length} forecasts resolved incorrect across recent domains.`,
        `Past decision "${unreviewedDecisions[0].title}" reached review date ${unreviewedDecisions[0].review_date} without outcome validation.`,
      ],
      whyItMatters: "Without closing the feedback loop on past predictions, upcoming commitments will repeat the same delivery and budget misses.",
      suggestedNextStep: "Conduct Decision & Forecast Review to update estimation heuristics and push lessons to Operating Memory.",
      route: "/forecasts",
    });
  }

  return syntheses;
}

// 7. Communication → Action Extractor
export type ExtractedAction = {
  kind: "commitment" | "task" | "waiting" | "decision" | "followup" | "risk";
  title: string;
  counterpart?: string;
  direction?: "owed_to_me" | "owed_by_me";
  dueDate?: string;
  confidence: number;
  reason: string;
};

export function extractActionsFromCommunication(text: string, now = new Date()): ExtractedAction[] {
  const actions: ExtractedAction[] = [];
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

  // Pattern 1: Someone promised to deliver something (owed_to_me)
  // e.g. "Ahmed said he will send supplier pricing by Friday"
  // Two-phase: first capture the named subject, then the delivery verb.
  const owedToMeMatch = text.match(/([A-Z][a-z]+)\s+(?:said\s+(?:he|she|they)\s+(?:will|would)|promised(?:\s+to)?|agreed\s+to)\s+(?:send|provide|deliver|share|email)\s+([^.]+?)(?:\s+by\s+([A-Za-z]+|\d{4}-\d{2}-\d{2}))?(?:\.|$)/);
  if (owedToMeMatch) {
    const person = owedToMeMatch[1].trim();
    const item = owedToMeMatch[2].trim();
    actions.push({
      kind: "commitment",
      title: `${item} (${person} → Me)`,
      counterpart: person,
      direction: "owed_to_me",
      dueDate: parseDateFromText(owedToMeMatch[3], now),
      confidence: 0.92,
      reason: `Detected promise by ${person} to deliver "${item}".`,
    });
  }

  // Pattern 2: Founder promised to do something (owed_by_me)
  // e.g. "I promised Sarah I will review the agreement tomorrow"
  const owedByMeMatch = text.match(/I\s+(?:promised|told|agreed\s+to)\s+([A-Z][a-z]+)?\s*(?:(?:to|I\s+will|that\s+I\s+will)\s+)?(review|send|complete|call|deliver|write)\s+([^.]+?)(?:\s+(?:by|before)\s+(tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{4}-\d{2}-\d{2}))?(?:\.|$)/i);
  if (owedByMeMatch) {
    const person = owedByMeMatch[1]?.trim() || "Counterpart";
    const verb = owedByMeMatch[2].trim();
    const rawItem = owedByMeMatch[3].trim();
    // Strip trailing relative-date words that weren't caught by group 4
    const item = rawItem.replace(/\s+(?:tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i, "");
    const dateHint = owedByMeMatch[4] ?? rawItem.match(/\b(tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i)?.[1];
    actions.push({
      kind: "commitment",
      title: `${verb} ${item} (Me → ${person})`,
      counterpart: person,
      direction: "owed_by_me",
      dueDate: parseDateFromText(dateHint, now),
      confidence: 0.90,
      reason: `Detected promise made by you to ${person}.`,
    });
  }

  // Pattern 3: Explicit waiting on someone
  // e.g. "Waiting for supplier quote from TechCorp"
  const waitingMatch = text.match(/waiting\s+(?:for|on)\s+([A-Za-z0-9\s]+?)\s+(?:for|from)\s+([A-Z][a-z]+)?/i);
  if (waitingMatch && !actions.some(a => a.kind === "commitment")) {
    actions.push({
      kind: "waiting",
      title: `Waiting on ${waitingMatch[1].trim()}`,
      counterpart: waitingMatch[2]?.trim(),
      confidence: 0.88,
      reason: "Detected waiting perspective.",
    });
  }

  // Pattern 4: Decision identified
  // e.g. "Need to decide between AWS and GCP by next week"
  const decisionMatch = text.match(/(?:need\s+to\s+decide|decision:?)\s+([^.]+?)(?:\s+by\s+([A-Za-z]+))?(?:\.|$)/i);
  if (decisionMatch) {
    actions.push({
      kind: "decision",
      title: decisionMatch[1].trim(),
      dueDate: parseDateFromText(decisionMatch[2], now),
      confidence: 0.85,
      reason: "Detected decision requirement.",
    });
  }

  // Fallback: If no action extracted but text is substantive, propose a task
  if (actions.length === 0 && text.trim().length > 10) {
    actions.push({
      kind: "task",
      title: text.slice(0, 100),
      confidence: 0.60,
      reason: "General action item extracted from text.",
    });
  }

  return actions;
}

function parseDateFromText(rawDate: string | undefined, now = new Date()): string | undefined {
  if (!rawDate) return undefined;
  const lower = rawDate.toLowerCase().trim();
  if (lower === "tomorrow") {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const dayIndex = days.indexOf(lower);
  if (dayIndex >= 0) {
    const d = new Date(now);
    let delta = (dayIndex - d.getDay() + 7) % 7;
    if (delta === 0) delta = 7;
    d.setDate(d.getDate() + delta);
    return d.toISOString().slice(0, 10);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(lower)) return lower;
  return undefined;
}

// 8. Meaningful Facts Delta for Tier 3 objects
export function tier3MeaningfulFacts(data: Sources, today: string): StateFact[] {
  const facts: StateFact[] = [];

  // Experiments facts
  for (const exp of data.experiments ?? []) {
    facts.push({
      id: `Experiment:${exp.id}`,
      domain: "Learning",
      title: String(exp.name),
      state: `${exp.status}; outcome ${exp.outcome_result ?? "pending"}`,
      route: `/experiments?record=${exp.id}`,
    });
  }

  // Forecasts facts
  for (const fc of data.forecasts ?? []) {
    facts.push({
      id: `Forecast:${fc.id}`,
      domain: "Forecasting",
      title: String(fc.prediction),
      state: `${fc.resolution}; confidence ${fc.confidence}`,
      route: `/forecasts?record=${fc.id}`,
    });
  }

  // Assets facts
  for (const asset of data.assets ?? []) {
    facts.push({
      id: `Asset:${asset.id}`,
      domain: "Assets",
      title: String(asset.name),
      state: `${asset.status}; ${asset.value_category ?? "core"}; reuse ${asset.reuse_potential ?? "medium"}`,
      route: `/assets?record=${asset.id}`,
    });
  }

  // Content facts
  for (const c of (data.content ?? []).filter(item => !item.deleted_at)) {
    facts.push({
      id: `Content:${c.id}`,
      domain: "Content",
      title: String(c.title),
      state: `${c.status}; due ${c.due_date ?? "no date"}`,
      route: `/content/${c.id}`,
    });
  }

  // Founder Daily Energy state
  const latestState = (data.dailyStates ?? [])[0];
  if (latestState) {
    facts.push({
      id: `Energy:${latestState.id}`,
      domain: "Attention",
      title: `Founder Energy (${latestState.date})`,
      state: `Energy ${latestState.energy}; Focus ${latestState.focus}; Load ${latestState.stress_load}`,
      route: "/state",
    });
  }

  return facts;
}
