import { personalSignals } from "./personal";
import { continuitySignals } from "./continuity";
import { evaluateKpi } from "./kpi";
import { founderBottlenecks, projectMomentum, strategicAlignment, waitingPerspectives } from "./tier1";
import type { Row } from "./repository";
export type Severity = "critical" | "high" | "medium";
export type Signal = { id: string; type: string; domain: string; title: string; severity: Severity; reasons: string[]; impact?: string; action: string; route: string; sourceId: string; companyId?: string; deadline?: string; detectedAt: string };
export type Sources = Record<string, Row[]>;
export type Coverage = { source: string; status: "available" | "unavailable" | "limited"; count: number };
const terminal = new Set(["completed", "cancelled", "canceled", "received", "fulfilled", "closed", "resolved", "archived", "deprecated", "reversed", "superseded", "validated"]);
export const isOpen = (r: Row) => !terminal.has(String(r.status));
export const numberOrNull = (v: unknown) => v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v);
export function daysUntil(value: unknown, today: string): number | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(value)) return null;
  const ms = Date.parse(`${value.slice(0, 10)}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`);
  return Number.isFinite(ms) ? Math.floor(ms / 86400000) : null;
}
export function waitingStatus(row: Row, today: string) {
  if (!isOpen(row)) return String(row.status);
  const days = daysUntil(row.expected_by ?? row.due_date, today);
  return days === null ? "waiting" : days < 0 ? "overdue" : days <= 3 ? "due_soon" : "waiting";
}
export function expiryWindow(value: unknown, today: string) {
  const days = daysUntil(value, today);
  return days === null ? "unknown" : days < 0 ? "expired" : [7, 14, 30, 90, 180].find(n => days <= n) ?? "later";
}
export function dependencyImpact(edges: Row[], type: string, id: string) {
  const seen = new Set([`${type}:${id}`]);
  const queue = [`${type}:${id}`];
  const downstream: string[] = [];
  while (queue.length) {
    const current = queue.shift();
    for (const edge of edges) {
      if (!["blocked", "waiting", "unavailable"].includes(String(edge.state))) continue;
      if (`${edge.dependency_type}:${edge.dependency_id}` !== current) continue;
      const next = `${edge.source_type}:${edge.source_id}`;
      if (seen.has(next)) continue;
      seen.add(next); queue.push(next); downstream.push(next);
    }
  }
  return downstream;
}
export function issuePriority(row: Row, downstreamCount: number, today: string) {
  const reasons: string[] = [];
  const impact = String(row.impact ?? row.severity);
  const days = daysUntil(row.target_resolution_date, today);
  if (["high", "critical"].includes(impact)) reasons.push(`${impact} impact recorded`);
  if (row.urgency === "immediate") reasons.push("Immediate response required");
  if (days !== null && days <= 2) reasons.push(days < 0 ? `Resolution is ${-days} days overdue` : `Resolution due in ${days} days`);
  if (downstreamCount) reasons.push(`${downstreamCount} downstream records blocked`);
  if (numberOrNull(row.revenue_exposure)! > 0) reasons.push(`${row.revenue_exposure} ${row.currency ?? "(currency unknown)"} revenue exposure`);
  if (row.founder_required) reasons.push("Founder intervention explicitly required");
  if (!row.owner_label) reasons.push("No owner assigned");
  const material = ["high", "critical"].includes(impact);
  const urgent = row.urgency === "immediate" || (days !== null && days <= 2);
  const severity: Severity = impact === "critical" && (urgent || downstreamCount > 0) ? "critical" : material || downstreamCount > 0 || row.founder_required === true ? "high" : "medium";
  return { severity, reasons: reasons.length ? reasons : ["An unresolved operational issue is recorded"] };
}
export const kpiEvaluation = evaluateKpi;

export function wealthSummary(rows: Row[]) {
  const currencies: Record<string, { assets: number; liabilities: number; liquid: number; equity: number; net: number }> = {};
  for (const row of rows) {
    const amount = numberOrNull(row.amount);
    if (amount === null || !row.currency) continue;
    const sum = currencies[String(row.currency)] ??= { assets: 0, liabilities: 0, liquid: 0, equity: 0, net: 0 };
    if (row.kind === "liability") sum.liabilities += amount;
    else { sum.assets += amount; if (row.liquid) sum.liquid += amount; if (row.category === "business_equity") sum.equity += amount; }
    sum.net = sum.assets - sum.liabilities;
  }
  return currencies;
}
export function mobilityState(row: Row, today: string) {
  const elapsed = daysUntil(row.start_date, today), allowed = numberOrNull(row.allowed_stay_days);
  // Entry day counts as day one. Completed stays stop at recorded departure.
  const end = row.actual_departure ? String(row.actual_departure) : row.status === "completed" && row.end_date ? String(row.end_date) : today;
  const used = elapsed === null || elapsed > 0 ? null : Math.max(0, -(daysUntil(row.start_date, end) ?? 0) + 1);
  return { used, remaining: used === null || allowed === null ? null : allowed - used, visaDays: daysUntil(row.visa_expiry, today) };
}
export function experimentOutcome(row: Row) {
  const target = numberOrNull(row.target_value), actual = numberOrNull(row.actual_value);
  if (target === null || actual === null) return "Insufficient outcome data";
  if (row.status !== "completed") return "Awaiting completed experiment";
  return (row.direction === "lower" ? actual <= target : actual >= target) ? "Defined target met" : "Defined target not met";
}
export function buildFounderState(data: Sources, today: string, coverage: Coverage[] = [], previous: Signal[] | null = null, dismissed: string[] = []) {
  const signals: Signal[] = personalSignals(data, today);
  const rows = (key: string) => data[key] ?? [];
  const add = (key: string, r: Row, type: string, domain: string, severity: Severity, reasons: string[], action: string, route: string, deadline?: unknown) => signals.push({ id: `${key}:${r.id}:${type}`, sourceId: r.id, type, domain, title: String(r.title ?? r.name ?? r.label ?? type), severity, reasons, impact: domain === "business" ? "Recorded business performance needs review against its operating targets." : domain === "technical" ? "System availability or operational continuity may be affected." : domain === "personal" ? "Personal readiness or an administrative obligation may need action." : "The linked work, obligation or decision may be delayed without action.", action, route, companyId: r.company_id ? String(r.company_id) : undefined, deadline: typeof deadline === "string" ? deadline : undefined, detectedAt: today });
  for (const r of rows("issues").filter(isOpen)) {
    const p = issuePriority(r, dependencyImpact(rows("dependencies"), "issue", r.id).length, today);
    add("issues", r, "UNRESOLVED_INCIDENT", "execution", p.severity, p.reasons, "Review resolution and owner", `/issues?record=${r.id}`, r.target_resolution_date);
  }
  for (const r of rows("waiting").filter(isOpen)) {
    const status = waitingStatus(r, today), followup = daysUntil(r.followup_date, today);
    if (status === "overdue" || (followup !== null && followup <= 0) || r.blocking_revenue) add("waiting", r, status === "overdue" ? "WAITING_OVERDUE" : "FOLLOWUP_DUE", "execution", r.blocking_revenue || ["high", "critical"].includes(String(r.importance)) ? "high" : "medium", [status === "overdue" ? `Expected by ${String(r.expected_by).slice(0, 10)}` : `Follow-up ${r.followup_date ?? "needed"}`, ...(r.contact ? [`${r.direction === "owed_by_me" ? "Waiting on you for" : "Awaiting"} ${r.contact}`] : []), ...(r.blocking_revenue ? ["Explicitly marked as blocking revenue"] : [])], "Review follow-up", "/waiting", r.expected_by);
  }
  for (const r of rows("decisions").filter(isOpen)) {
    const review = daysUntil(r.review_date, today), deadline = daysUntil(r.deadline, today);
    if (review !== null && review <= 0) add("decisions", r, "DECISION_REVIEW_DUE", "decisions", "high", [`Review date ${r.review_date} reached`, "Compare the expected and actual outcomes"], "Review decision and record a lesson", "/decisions", r.review_date);
    else if (["proposed", "under_review"].includes(String(r.status)) && deadline !== null && deadline <= 3) add("decisions", r, "DECISION_DUE", "decisions", "high", [`Decision deadline ${r.deadline}`, ...(r.owner_label ? [`Owner: ${r.owner_label}`] : ["No decision owner assigned"])], "Choose the next decision step", "/decisions", r.deadline);
  }
  for (const r of rows("risks").filter(r => !["closed", "mitigated", "accepted"].includes(String(r.status)))) {
    const probability = numberOrNull(r.probability), impact = numberOrNull(r.impact), review = daysUntil(r.review_date, today);
    const issue = rows("issues").find(i => i.id === r.issue_id && isOpen(i));
    if (issue || r.status === "materialized" || (probability !== null && impact !== null && probability >= 4 && impact >= 4) || (review !== null && review <= 0)) add("risks", r, "RISK_ESCALATION", String(r.category), issue || r.status === "materialized" ? "high" : "medium", [issue ? `Linked issue is unresolved: ${issue.title}` : r.status === "materialized" ? "Risk recorded as materialized" : `Probability ${probability ?? "unknown"}/5; impact ${impact ?? "unknown"}/5`, ...(review !== null && review <= 0 ? [`Review due ${r.review_date}`] : [])], String(r.mitigation || "Review mitigation and contingency"), "/risks/register", r.review_date);
  }
  for (const r of rows("tasks").filter(isOpen)) {
    const days = daysUntil(r.due_date, today), downstream = dependencyImpact(rows("dependencies"), "task", r.id).length;
    if ((days !== null && days < 0 && ["high", "urgent"].includes(String(r.priority))) || (r.status === "blocked" && (downstream || ["high", "urgent"].includes(String(r.priority))))) add("tasks", r, r.status === "blocked" ? "BLOCKED" : "OVERDUE", "execution", "high", [`${r.priority} priority task is ${r.status === "blocked" ? "blocked" : "overdue"}`, ...(downstream ? [`${downstream} downstream records blocked`] : [])], "Review task and dependency", "/tasks", r.due_date);
  }
  for (const r of rows("documents")) {
    const days = daysUntil(r.expires_at, today);
    if (days !== null && days <= Number(r.reminder_days ?? 30)) add("documents", r, "DOCUMENT_EXPIRING", "personal", days <= 7 ? "high" : "medium", [days < 0 ? `Expired ${-days} days ago` : `Expires in ${days} days`, "Based on the recorded expiry date"], "Review renewal requirements", `/life/documents?record=${r.id}`, r.expires_at);
  }
  for (const r of rows("systems").filter(isOpen)) {
    const critical = ["high", "critical"].includes(String(r.criticality));
    if (["degraded", "unavailable"].includes(String(r.status))) add("systems", r, "PRODUCTION_FAILURE", "technical", critical ? "critical" : "medium", [`Recorded system status: ${r.status}`, `Criticality: ${r.criticality}`, `Last verified: ${r.last_verified_date ?? "not recorded"}`], "Investigate system health", "/infrastructure");
    if (critical && r.backup_status === "failed") add("systems", r, "BACKUP_FAILURE", "technical", "high", ["Backup verification recorded as failed"], "Review backup recovery", "/infrastructure");
  }
  for (const r of rows("subscriptions").filter(r => r.status === "active")) {
    const days = daysUntil(r.next_billing_date, today);
    if (days !== null && days <= 7 && !rows("systems").some(s => s.subscription_id === r.id && s.renewal_date === r.next_billing_date)) add("subscriptions", r, "RENEWAL_SOON", "finance", "medium", [`Billing due ${r.next_billing_date}`, `${r.amount} ${r.currency}`], "Review subscription", "/subscriptions", r.next_billing_date);
  }
  for (const r of rows("invoices")) {
    const days = daysUntil(r.due_date, today), amount = numberOrNull(r.amount_remaining);
    if (days !== null && days < 0 && amount !== null && amount > 0 && !["draft", "paid", "cancelled"].includes(String(r.status))) add("invoices", { ...r, title: r.title || r.invoice_number || "Overdue receivable" }, "RECEIVABLE_OVERDUE", "finance", days <= -14 ? "high" : "medium", [`${amount} ${r.currency} unpaid`, `${-days} days overdue`], "Review collection and payment promises", "/financial-control/collections", r.due_date);
  }
  for (const r of rows("commitments").filter(isOpen)) {
    const days = daysUntil(r.due_date, today), followup = daysUntil(r.follow_up_date, today);
    const material = ["high", "critical"].includes(String(r.importance));
    if (material && !r.waiting_id && ((days !== null && days <= 3) || (followup !== null && followup <= 0))) {
      const overdue = (days !== null && days < 0) || (followup !== null && followup < 0);
      add("commitments", r, overdue ? "COMMITMENT_OVERDUE" : "COMMITMENT_DUE", "execution", "high", [`${r.direction === "owed_by_me" ? "You owe" : "Owed to you by"}: ${r.person_label}`, ...(days !== null && days <= 3 ? [`Due ${r.due_date}${days < 0 ? ` (${Math.abs(days)} days overdue)` : ""}`] : []), ...(followup !== null && followup <= 0 ? [`Follow-up ${r.follow_up_date}${followup < 0 ? ` (${Math.abs(followup)} days overdue)` : ""}`] : []), `Importance: ${r.importance}.`], "Review promise", `/commitments?record=${r.id}`, String(r.follow_up_date ?? r.due_date ?? ""));
    }
  }
  for (const r of rows("relationships").filter(r => r.status !== "inactive")) {
    const days = daysUntil(r.next_followup, today);
    if (r.status === "attention" || (days !== null && days <= 3)) {
      const high = ["high", "critical"].includes(String(r.importance));
      add("relationships", r, "RELATIONSHIP_FOLLOWUP_DUE", "relationships", high || r.status === "attention" ? "high" : "medium", [r.status === "attention" ? "Relationship health is explicitly marked for attention." : `Recorded follow-up date ${r.next_followup} is ${days === null ? "not dated" : days < 0 ? `${-days} days overdue` : days === 0 ? "today" : `in ${days} days`}.`, `Importance: ${r.importance ?? "unknown"}.`], "Review the relationship and next step", `/relationships?record=${r.id}`, String(r.next_followup ?? ""));
    }
  }
  for (const r of rows("trips").filter(isOpen)) {
    const mobility = mobilityState(r, today);
    if ((mobility.remaining !== null && mobility.remaining <= 14) || (mobility.visaDays !== null && mobility.visaDays <= 14)) add("trips", r, "TRAVEL_DEADLINE", "personal", "high", [mobility.remaining !== null ? `${mobility.remaining} days remain in the entered stay allowance` : "Stay allowance unknown", `Recorded visa expiry: ${r.visa_expiry ?? "unknown"}`, "Verify against the entered source; no legal eligibility determination"], "Review travel documentation", "/travel/mobility", r.visa_expiry);
  }
  for (const r of rows("kpis")) {
    const kpi = typeof r.reason === "string" && typeof r.status === "string" ? { status: r.status, reason: r.reason, event: r.event } : kpiEvaluation(r, numberOrNull(r.current_value), numberOrNull(r.previous_value));
    if (["critical", "attention"].includes(kpi.status) || ["KPI_RECOVERY", "KPI_TARGET_REACHED"].includes(String(kpi.event))) add("kpis", r, String(kpi.event ?? "KPI_DECLINE"), "business", kpi.status === "critical" ? "high" : "medium", [kpi.reason, `Source: ${r.source}; period: ${r.frequency}`, "Current period may be incomplete; interpret the configured threshold in that context"], "Review KPI evidence", "/business-pulse");
  }
  for (const r of rows("obligations")) {
    const days = daysUntil(r.due_at, today);
    if (days !== null && days <= 7 && !["paid", "cancelled", "deferred"].includes(String(r.status))) add("obligations", r, "OBLIGATION_DUE", "finance", r.criticality === "critical" || days < 0 ? "high" : "medium", [`${r.amount} ${r.currency} due ${r.due_at}`, `Recorded criticality: ${r.criticality}`], "Review payment timing and liquidity", "/financial-control/obligations", r.due_at);
  }
  for (const r of rows("incidents").filter(isOpen)) {
    if (rows("issues").some(i => i.linked_entity_id === r.id && i.linked_entity_type === "incident")) continue;
    add("incidents", r, "PRODUCTION_INCIDENT", "technical", r.severity === "critical" ? "critical" : r.severity === "major" ? "high" : "medium", [`Unresolved production incident since ${String(r.started_at).slice(0, 10)}`, `Reported severity: ${r.severity}`, ...(r.customer_impact ? [String(r.customer_impact)] : [])], "Review production incident", "/founder/development");
  }
  const latestDeployments = new Map<string, Row>();
  for (const r of [...rows("deployments")].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))) if (!latestDeployments.has(String(r.company_id))) latestDeployments.set(String(r.company_id), r);
  for (const r of latestDeployments.values()) if (r.status === "failed") add("deployments", { ...r, title: "Latest production deployment failed" }, "DEPLOYMENT_FAILED", "technical", "high", [`Latest recorded production deployment on ${String(r.created_at).slice(0, 10)} failed`, "A failed deployment does not by itself establish a production outage"], "Inspect deployment and current production health", "/founder/development");
  for (const r of rows("projects")) {
    const days = daysUntil(r.target_date, today), blocked = rows("tasks").filter(t => t.project_id === r.id && t.status === "blocked").length;
    if ((days !== null && days < 0) || (blocked > 0 && days !== null && days <= 7)) add("projects", r, "PROJECT_SLIPPAGE", "execution", ["high", "urgent"].includes(String(r.priority)) || blocked > 0 ? "high" : "medium", [`Recorded progress ${r.progress ?? "unknown"}%`, `Target date ${r.target_date}`, ...(blocked ? [`${blocked} high-priority tasks are blocked`] : [])], "Review milestone and blocked work", `/projects/${r.id}`, r.target_date);
  }
  for (const r of rows("access")) {
    const system = rows("systems").find(s => s.id === r.system_id && ["high", "critical"].includes(String(s.criticality)));
    if (!system || !["owner", "admin"].includes(String(r.access_level))) continue;
    const reasons = [...(r.two_factor_enabled === false ? ["2FA is recorded as disabled"] : []), ...(r.recovery_path_exists === false ? ["No recovery path recorded"] : [])];
    if (reasons.length) add("access", { ...r, title: `${system.name}: access continuity`, company_id: system.company_id }, "ACCESS_CONTINUITY", "technical", "high", reasons, "Review administrator access safeguards", "/infrastructure/access");
  }
  for (const r of rows("financialRisks")) {
    add("financial", r, "FINANCIAL_EXPOSURE", "finance", r.severity === "critical" ? "critical" : r.severity === "important" ? "high" : "medium", [String(r.evidence), ...(r.amount != null ? [`${r.amount} ${r.currency}`] : [])], String(r.action), String(r.route), r.date);
  }
  for (const r of rows("trainingSignals")) add("training", r, "TRAINING_REVIEW", "personal", "medium", [String(r.reason), "Based on logged activity and your chosen plan; review data completeness before changing training"], "Review training evidence", "/state/review");
  signals.push(...continuitySignals(data, today));
  const founderBlockers = rows("waiting").filter(r => isOpen(r) && r.direction === "owed_by_me");
  if (founderBlockers.length >= 3) add("founder", { id: "bottleneck", title: "Others are waiting on you" }, "FOUNDER_BOTTLENECK", "execution", "high", [`${founderBlockers.length} active waiting items explicitly mark you as the blocker`], "Review what others are waiting on", "/waiting");
  for (const bottleneck of founderBottlenecks(data, today).filter(b => !b.id.startsWith("issue-owner:") && !b.id.startsWith("owner:") && !b.id.startsWith("admin:"))) add("founder", { id: bottleneck.id, title: bottleneck.title }, "FOUNDER_BOTTLENECK", "execution", "high", bottleneck.reasons, "Review ownership and next action", bottleneck.route);
  for (const project of rows("projects").filter(r => ["active", "planning"].includes(String(r.status)))) {
    const momentum = projectMomentum(project, data, today);
    if (["attention", "stalled"].includes(momentum.status) && !signals.some(s => s.sourceId === project.id && s.type === "PROJECT_SLIPPAGE")) add("momentum", project, "PROJECT_MOMENTUM", "execution", momentum.status === "attention" && ["high", "urgent"].includes(String(project.priority)) ? "high" : "medium", momentum.reasons, "Review project momentum", momentum.route);
  }
  for (const work of strategicAlignment(data).filter(r => r.review)) add("alignment", { id: work.id, title: work.title }, "ALIGNMENT_REVIEW", "strategy", "medium", [work.reason], "Review strategic contribution", work.route);
  for (const commitment of rows("strategicCommitments")) if (commitment.status === "at_risk" || (daysUntil(commitment.target_date, today) ?? 999) <= 3) add("strategy", commitment, "STRATEGIC_COMMITMENT", "strategy", "high", [`Commitment status: ${commitment.status}`, `Target: ${commitment.target_date ?? "not recorded"}`], "Review strategic commitment", "/strategy", commitment.target_date);
  const perspectives = waitingPerspectives(data, today);
  const severityRank = { critical: 3, high: 2, medium: 1 };
  const active = signals.filter(s => !dismissed.includes(s.id)).sort((a, b) => severityRank[b.severity] - severityRank[a.severity] || (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999") || a.id.localeCompare(b.id));
  const attention = active.filter(s => s.severity !== "medium").slice(0, 5);
  const changes = previous === null ? null : [
    ...active.filter(s => !previous.some(p => p.id === s.id)).map(s => ({ id: s.id, title: s.title, change: "new", route: s.route })),
    ...active.filter(s => previous.some(p => p.id === s.id && (p.severity !== s.severity || p.deadline !== s.deadline))).map(s => ({ id: s.id, title: s.title, change: "changed", route: s.route })),
    ...previous.filter(p => !signals.some(s => s.id === p.id) && !coverage.some(c => c.status !== "available")).map(s => ({ id: s.id, title: s.title, change: "no longer detected", route: s.route })),
  ];
  return { today, queues: { issues: active.filter(s => ["UNRESOLVED_INCIDENT", "PRODUCTION_INCIDENT"].includes(s.type) && s.severity !== "medium").length, decisions: active.filter(s => s.domain === "decisions").length }, status: active.some(s => s.severity === "critical") ? "critical" : attention.length ? "attention" : coverage.some(c => c.status !== "available") ? "incomplete" : "clear", attention, signals: active, changes, coverage, waiting: { active: perspectives.others.active, overdue: perspectives.others.overdue, onMe: perspectives.me.active, onMeOverdue: perspectives.me.overdue, revenue: perspectives.others.revenue, onMeRevenue: perspectives.me.revenue }, companies: rows("companies").map(c => ({ id: c.id, name: String(c.name), signals: active.filter(s => s.companyId === c.id).length })), monitoredAt: today };
}
export type FounderState = ReturnType<typeof buildFounderState> & { signalCount?: number };
export function compactFounderState(state: FounderState): FounderState {
  return { today: state.today, queues: state.queues, monitoredAt: state.monitoredAt, status: state.status, waiting: state.waiting, coverage: state.coverage, attention: state.attention.slice(0, 3), signalCount: state.signals.length, signals: [], changes: null, companies: [] };
}
