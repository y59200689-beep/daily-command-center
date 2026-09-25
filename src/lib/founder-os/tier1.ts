import { personalSignals } from "./personal";
import { continuitySignals } from "./continuity";
import { daysUntil, dependencyImpact, isOpen, waitingStatus, type Sources } from "./intelligence";
import type { Row } from "./repository";
import { decisionReviewStatus } from "./workflows";
const important = (r: Row) => ["high", "urgent", "critical"].includes(String(r.priority ?? r.importance ?? r.impact));
const recent = (date: unknown, today: string, days: number) => { const age = daysUntil(date, today); return age !== null && age <= 0 && age > -days; };
export function waitingPerspectives(data: Sources, today: string) {
  const waiting = (data.waiting ?? []).filter(isOpen);
  const ids = new Set(waiting.map(r => r.id));
  const records: (Row & { route: string })[] = [...waiting.map(r => ({ ...r, route: `/waiting/${r.id}` })), ...(data.commitments ?? []).filter(r => isOpen(r) && !ids.has(String(r.waiting_id))).map(r => ({ ...r, route: `/commitments?record=${r.id}` }))];
  const summarize = (direction: string) => { const items = records.filter(r => (r.direction ?? "owed_to_me") === direction); return { items, active: items.length, overdue: items.filter(r => waitingStatus(r, today) === "overdue").length, revenue: items.filter(r => r.blocking_revenue === true).length, team: items.filter(r => r.blocking_team === true || Boolean(r.contact || r.person_label)).length }; };
  return { others: summarize("owed_to_me"), me: summarize("owed_by_me") };
}
export function founderBottlenecks(data: Sources, today: string) {
  const results: { id: string; title: string; reasons: string[]; route: string }[] = [];
  const decisions = (data.decisions ?? []).filter(r => isOpen(r) && r.founder_required === true && ["proposed", "under_review"].includes(String(r.status)));
  const projects = new Set(decisions.map(r => r.project_id).filter(Boolean));
  if (projects.size >= 2) results.push({ id: "decisions", title: "Projects await founder decisions", reasons: [`${projects.size} distinct projects have ${decisions.length} pending decisions explicitly requiring the founder.`], route: "/decisions" });
  const blocked = (data.delegations ?? []).filter(r => r.status === "blocked" && r.founder_approval_required === true);
  if (blocked.length) results.push({ id: "approvals", title: "Delegations await founder approval", reasons: [`${blocked.length} blocked delegations; ${new Set(blocked.map(r => r.delegated_to_person_id)).size} team members.`, "Founder approval is explicitly marked on these records."], route: "/team/delegations" });
  for (const system of (data.systems ?? []).filter(r => ["high", "critical"].includes(String(r.criticality)) && r.status !== "deprecated")) {
    const admins = (data.access ?? []).filter(r => r.system_id === system.id && ["owner", "admin"].includes(String(r.access_level)));
    if (admins.length === 1 && !admins[0].backup_admin) results.push({ id: `admin:${system.id}`, title: `${system.name}: one recorded administrator`, reasons: [`${admins[0].person_label} is the only recorded administrator.`, "No backup administrator is recorded; this does not establish who holds unrecorded access."], route: "/infrastructure/access" });
    if (!system.owner_label) results.push({ id: `owner:${system.id}`, title: `${system.name}: no responsible owner`, reasons: ["Critical system with no owner recorded."], route: "/infrastructure" });
  }
  for (const responsibility of (data.responsibilities ?? []).filter(r =>
    ["high", "critical"].includes(String(r.criticality)) &&
    r.status !== "archived" &&
    (r.status === "needs_owner" || !r.primary_owner_id)
  )) {
    results.push({
      id: `responsibility:${responsibility.id}`,
      title: `${responsibility.name}: no primary owner`,
      reasons: [`${responsibility.criticality} criticality responsibility has no primary owner recorded.`, ...(responsibility.status === "needs_owner" ? ["The responsibility is explicitly marked as needing an owner."] : [])],
      route: "/team/responsibilities",
    });
  }
  for (const issue of (data.issues ?? []).filter(r => isOpen(r) && !r.owner_label && ["high", "critical"].includes(String(r.impact ?? r.severity)))) results.push({ id: `issue-owner:${issue.id}`, title: `${issue.title}: no resolution owner`, reasons: ["An unresolved high-impact issue has no owner recorded."], route: `/issues/${issue.id}` });
  const repetitive = (data.tasks ?? []).filter(r => r.work_classification === "founder_only" && r.recurrence_frequency && important(r) && isOpen(r));
  if (repetitive.length >= 2) results.push({ id: "repeated", title: "Repeated important work remains founder-only", reasons: [`${repetitive.length} high-impact recurring tasks are explicitly classified founder-only.`, "Review whether any can be delegated or automated; classifications have not been changed."], route: "/tasks" });
  const sessions = (data.sessions ?? []).filter(r => recent(r.started_at, today, 30) && typeof r.ended_at === "string" && Number(r.duration_seconds) > 0);
  const byTask = new Map<string, Row[]>();
  for (const s of sessions) if (s.task_id) byTask.set(String(s.task_id), [...(byTask.get(String(s.task_id)) ?? []), s]);
  for (const [id, rows] of byTask) if (rows.length >= 5) {
    const task = (data.tasks ?? []).find(r => r.id === id && r.work_classification === "founder_only");
    if (task) results.push({ id: `activity:${id}`, title: `${task.title}: delegation candidate for review`, reasons: [`${rows.length} completed focus sessions totaling ${(rows.reduce((sum, s) => sum + Number(s.duration_seconds), 0) / 3600).toFixed(1)} recorded hours in 30 days on work marked founder-only.`, "Frequency is evidence for a review, not proof that this work should be delegated. No ownership is changed automatically."], route: `/tasks/${id}` });
  }
  return results;
}
export function projectMomentum(project: Row, data: Sources, today: string) {
  const tasks = (data.tasks ?? []).filter(r => r.project_id === project.id);
  const completions = tasks.filter(r => r.status === "completed" && recent(r.completed_at, today, 7)).length;
  const blocked = tasks.filter(r => r.status === "blocked").length;
  const overdue = tasks.filter(r => isOpen(r) && important(r) && (daysUntil(r.due_date, today) ?? 0) < 0).length;
  const issues = (data.issues ?? []).filter(r => r.project_id === project.id && isOpen(r));
  const endpoints = new Set([`project:${project.id}`, ...tasks.filter(isOpen).map(r => `task:${r.id}`)]);
  const dependencies = (data.dependencies ?? []).filter(r => endpoints.has(`${r.source_type}:${r.source_id}`) && ["blocked", "waiting", "unavailable"].includes(String(r.state))).length;
  const milestones = (data.milestones ?? []).filter(r => r.source_type === "project" && r.source_id === project.id && ["upcoming", "at_risk", "missed"].includes(String(r.status)));
  const due = milestones.map(r => daysUntil(r.milestone_date, today)).filter((v): v is number => v !== null);
  const recentActivity = tasks.some(r => recent(r.updated_at, today, 7));
  const reasons = [`${completions} completed tasks in the last 7 days`, ...(blocked ? [`${blocked} blocked tasks`] : []), ...(overdue ? [`${overdue} overdue important tasks`] : []), ...(issues.length ? [`${issues.length} unresolved issues`] : []), ...(dependencies ? [`${dependencies} unhealthy dependencies`] : []), ...(due.length ? [`Nearest milestone ${Math.min(...due) < 0 ? `${-Math.min(...due)} days overdue` : `due in ${Math.min(...due)} days`}`] : []), ...(!recentActivity ? ["No recorded task activity in 7 days"] : []), ...(project.goal_id ? ["Linked to a strategic objective"] : [])];
  const pressure = blocked + overdue + dependencies + issues.length > 0 || due.some(d => d <= 7) || (daysUntil(project.target_date, today) ?? 0) < 0;
  return { id: project.id, title: String(project.name), progress: project.progress ?? null, status: pressure ? "attention" : !completions && !recentActivity ? "stalled" : completions ? "healthy" : "unproven", reasons, route: `/projects/${project.id}` };
}
export function strategicAlignment(data: Sources) {
  return ([['tasks', 'task'], ['projects', 'project'], ['decisions', 'decision'], ['risks', 'risk']] as const).flatMap(([key, type]) => (data[key] ?? []).filter(isOpen).map(r => {
    const links = (data.strategyLinks ?? []).filter(l => l.source_type === type && l.source_id === r.id);
    const project = type === "task" ? (data.projects ?? []).find(p => p.id === r.project_id) : undefined;
    const aligned = Boolean(r.goal_id || links.length || project?.goal_id || (project && (data.strategyLinks ?? []).some(l => l.source_type === "project" && l.source_id === project.id)));
    return { id: r.id, type, title: String(r.title ?? r.name), aligned, review: !aligned && (Number(r.estimated_minutes ?? 0) >= 120 || important(r)), reason: aligned ? `${links.length} explicit strategic links${r.goal_id || project?.goal_id ? '; objective linked directly or through project' : ''}` : "No strategic objective, commitment, milestone or KPI link recorded. Review the context before changing this work.", route: type === "risk" ? `/risks/register?record=${r.id}` : `/${key}/${r.id}` };
  }));
}
export type StateFact = { id: string; domain: string; title: string; state: string; route: string };
export function meaningfulFacts(data: Sources, today: string): StateFact[] {
  const withinWindow = (value: unknown, date: string, days: number) => { const age = daysUntil(value, date); return age !== null && age <= 0 && age >= -days; };
  const facts: StateFact[] = [];
  const push = (domain: string, row: Row, state: string, route: string) => facts.push({ id: `${domain}:${row.id}`, domain, title: String(row.title ?? row.name ?? row.invoice_number ?? "Recorded item"), state, route });
  for (const r of data.issues ?? []) push("Issues", r, String(r.status), `/issues/${r.id}`);
  for (const r of data.risks ?? []) push("Risks", r, `${r.status}; probability ${r.probability}; impact ${r.impact}`, `/risks/register?record=${r.id}`);
  for (const r of data.decisions ?? []) push("Decisions", r, decisionReviewStatus(r, today), `/decisions/${r.id}`);
  for (const r of data.invoices ?? []) push("Finance", r, isOpen(r) && !["paid", "draft"].includes(String(r.status)) && (daysUntil(r.due_date, today) ?? 0) < 0 ? "overdue" : String(r.status), "/invoices");
  for (const r of data.milestones ?? []) push("Strategy", r, ["upcoming", "at_risk"].includes(String(r.status)) && (daysUntil(r.milestone_date, today) ?? 0) < 0 ? "late" : String(r.status), "/strategy");
  for (const r of [...waitingPerspectives(data, today).others.items, ...waitingPerspectives(data, today).me.items]) push("Waiting", r, waitingStatus(r, today), r.route);
  for (const r of data.incidents ?? []) push("Technology", r, String(r.status), "/founder/development");
  for (const r of data.relationships ?? []) if (r.status !== "inactive") push("Relationships", r, `${r.status}; next follow-up ${r.next_followup ?? "not scheduled"}`, `/relationships?record=${r.id}`);
  for (const r of data.commitments ?? []) if (isOpen(r)) push("Commitments", r, `${r.direction === "owed_by_me" ? "I owe them" : "They owe me"}; due ${r.due_date ?? "not scheduled"}`, `/commitments?record=${r.id}`);
  for (const r of data.customerOutcomes ?? []) if (withinWindow(r.updated_at, today, 30)) push("Customers", r, String(r.status), `/clients/${r.client_id}`);
  for (const r of data.kpis ?? []) if (r.current_value !== null && r.current_value !== undefined) push("KPIs", r, `${r.current_value} ${r.unit ?? ""} (${r.frequency ?? "recorded"} period)`, "/business-pulse");
  return facts;
}
export function compareFacts(current: StateFact[], previous: StateFact[] | null) {
  if (!previous) return null;
  const old = new Map(previous.map(r => [r.id, r]));
  return current.flatMap(r => { const before = old.get(r.id); return !before ? [{ ...r, before: "not previously recorded" }] : before.state !== r.state ? [{ ...r, before: before.state }] : []; });
}
export function weeklyBriefing(data: Sources, today: string) {
  const row = (r: Row, route: string, why?: string) => ({ id: r.id, title: String(r.title ?? r.name ?? r.statement ?? r.metric ?? "Recorded item"), route, why: why ?? String(r.status ?? "recorded") });
  const within = (r: Row) => recent(r.created_at, today, 7);
  const waiting = waitingPerspectives(data, today);
  return {
    "Personal administration": [...personalSignals(data,today).map(s=>({id:s.id,title:s.title,route:s.route,why:s.reasons.join(" ")})), ...(data.documents??[]).filter(r=>!r.archived_at&&(daysUntil(r.expires_at,today)??999)<=Number(r.reminder_days??30)).map(r=>({id:r.id,title:String(r.label),route:`/life/documents?record=${r.id}`,why:`Recorded expiry ${r.expires_at}`}))],
    "Relationships & commitments": [...(data.relationships??[]).filter(r=>r.status==="attention"||(daysUntil(r.next_followup,today)??999)<=7).map(r=>({id:r.id,title:String(r.name),route:`/relationships?record=${r.id}`,why:r.status==="attention"?"Relationship is marked for attention.":`Recorded follow-up ${r.next_followup}`})), ...(data.commitments??[]).filter(r=>isOpen(r)&&(["high","critical"].includes(String(r.importance))||Boolean(r.relationship_id))&&(Boolean(r.relationship_id)||(daysUntil(r.due_date,today)??999)<=7||(daysUntil(r.follow_up_date,today)??999)<=7)).map(r=>({id:r.id,title:String(r.title),route:`/commitments?record=${r.id}`,why:`${r.direction==="owed_by_me"?"You owe":"Owed to you"} · ${r.follow_up_date?`follow-up ${r.follow_up_date}`:r.due_date??"no due date recorded"}`}))],
    "Infrastructure & access": continuitySignals(data,today).map(s=>({id:s.id,title:s.title,route:s.route,why:s.reasons.join(" ")})),
    "KPI movement": (data.kpis ?? []).filter(r => r.event || r.trend === "deteriorating").map(r => row(r, "/business-pulse", `${r.event ?? r.trend}: ${r.reason}; previous ${r.previous_value ?? "unknown"}, current ${r.current_value ?? "unknown"} ${r.unit ?? ""}`)),
    Outcomes: (data.tasks ?? []).filter(r => r.status === "completed" && recent(r.completed_at, today, 7)).map(r => row(r, `/tasks/${r.id}`, "Completed this week")),
    "Strategic progress": (data.strategicCommitments ?? []).filter(r => r.status === "completed" && recent(r.updated_at, today, 7)).map(r => row(r, "/strategy", "Commitment completed this week")),
    Problems: [...(data.issues ?? []).filter(isOpen).map(r => row(r, `/issues/${r.id}`)), ...(data.strategicCommitments ?? []).filter(r => ["at_risk", "dropped"].includes(String(r.status))).map(r => row(r, "/strategy"))],
    Decisions: (data.decisions ?? []).filter(r => decisionReviewStatus(r, today) === "review_due" || ["proposed", "under_review"].includes(String(r.status)) || recent(r.decision_date, today, 7)).map(r => row(r, `/decisions/${r.id}`, decisionReviewStatus(r, today))),
    Risks: (data.risks ?? []).filter(r => within(r) || (["materialized", "mitigated"].includes(String(r.status)) && recent(r.updated_at, today, 7)) || (Number(r.probability) >= 4 && Number(r.impact) >= 4)).map(r => row(r, `/risks/register?record=${r.id}`)),
    "Waiting For": [...waiting.others.items.filter(r => waitingStatus(r, today) === "overdue"), ...waiting.me.items].map(r => row(r, r.route, `${r.direction === "owed_by_me" ? "Waiting on me" : "Waiting on others"} · ${waitingStatus(r, today)}`)),
    "Founder Attention": founderBottlenecks(data, today).map(r => ({ ...r, why: r.reasons.join(" ") })),
    "Forecast Accuracy": (data.forecasts ?? []).filter(r => recent(r.recorded_date, today, 7)).map(r => row(r, "/learning/forecasts", `Expected ${r.expected_value ?? "unknown"}; actual ${r.actual_value ?? "unknown"}; variance ${r.variance ?? "unknown"}`)),
    Lessons: (data.lessons ?? []).filter(within).map(r => row(r, "/learning", String(r.statement))),
    "Next Week": [...(data.tasks ?? []).filter(r => isOpen(r) && important(r) && (daysUntil(r.due_date, today) ?? 999) <= 7), ...(data.strategicCommitments ?? []).filter(r => isOpen(r) && (daysUntil(r.target_date, today) ?? 999) <= 7)].map(r => row(r, r.planning_period_id ? "/strategy" : `/tasks/${r.id}`, "Unresolved priority due within 7 days or already overdue")),
  };
}
// Export the existing cycle-safe traversal for the shared dependency read model.
export { dependencyImpact };
