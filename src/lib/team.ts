import type { SupabaseClient } from "@supabase/supabase-js";

export type TeamRelationshipType =
  | "team_member"
  | "contractor"
  | "freelancer"
  | "partner"
  | "advisor"
  | "client_contact"
  | "supplier_contact"
  | "collaborator"
  | "other";

export type TeamPersonStatus = "active" | "inactive" | "external" | "archived";
export type TeamRoleStatus = "active" | "archived";
export type TeamCriticality = "low" | "medium" | "high" | "critical";
export type TeamResponsibilityStatus = "active" | "needs_owner" | "needs_backup" | "paused" | "archived";
export type TeamDelegationStatus =
  | "draft"
  | "assigned"
  | "acknowledged"
  | "in_progress"
  | "blocked"
  | "needs_review"
  | "completed"
  | "cancelled";

export type TeamDelegationHistoryAction =
  | "created"
  | "assigned"
  | "acknowledged"
  | "started"
  | "blocked"
  | "unblocked"
  | "reviewed"
  | "completed"
  | "cancelled"
  | "reassigned";

export type TeamCommitmentStatus = "open" | "done" | "cancelled" | "unclear";
export type TeamEscalationSeverity = "low" | "medium" | "high" | "critical";
export type TeamEscalationStatus = "open" | "reviewing" | "resolved" | "dismissed";
export type TeamAvailabilityStatus = "available" | "limited" | "unavailable";
export type TeamOwnershipRole = "owner" | "backup" | "contributor" | "reviewer" | "consulted";

export type DelegationHealthState =
  | "on_track"
  | "needs_attention"
  | "at_risk"
  | "blocked"
  | "completed"
  | "unknown";

export type CapacityState = "available" | "balanced" | "busy" | "overloaded" | "unavailable" | "unknown";

export interface TeamPerson {
  id: string;
  name: string;
  display_name?: string | null;
  role_title?: string | null;
  role_id?: string | null;
  company_team?: string | null;
  email?: string | null;
  phone?: string | null;
  relationship_type: TeamRelationshipType;
  status: TeamPersonStatus;
  timezone?: string | null;
  working_hours?: string | null;
  notes?: string | null;
  avatar_url?: string | null;
  linked_contact_id?: string | null;
  linked_user_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface TeamRole {
  id: string;
  name: string;
  description?: string | null;
  responsibility_summary?: string | null;
  default_capacity?: string | null;
  status: TeamRoleStatus;
  created_at?: string;
  updated_at?: string;
}

export interface TeamResponsibility {
  id: string;
  name: string;
  description?: string | null;
  primary_owner_id?: string | null;
  backup_owner_id?: string | null;
  role_id?: string | null;
  criticality: TeamCriticality;
  status: TeamResponsibilityStatus;
  review_cadence?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface TeamDelegation {
  id: string;
  title: string;
  description?: string | null;
  delegated_to_person_id: string;
  delegated_by_person_id?: string | null;
  source_entity_type?: string | null;
  source_entity_id?: string | null;
  expected_outcome: string;
  delegated_at?: string;
  due_at?: string | null;
  review_at?: string | null;
  status: TeamDelegationStatus;
  priority: TeamCriticality;
  acknowledged_at?: string | null;
  completed_at?: string | null;
  completion_summary?: string | null;
  blocked_reason?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface TeamCommitment {
  id: string;
  from_person_id?: string | null;
  to_person_id?: string | null;
  statement: string;
  source?: string | null;
  due_at?: string | null;
  status: TeamCommitmentStatus;
  completed_at?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface TeamEscalation {
  id: string;
  source_entity_type?: string | null;
  source_entity_id?: string | null;
  person_id?: string | null;
  reason: string;
  severity: TeamEscalationSeverity;
  status: TeamEscalationStatus;
  resolution?: string | null;
  resolved_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface TeamAvailability {
  id: string;
  person_id: string;
  status: TeamAvailabilityStatus;
  start_at?: string | null;
  end_at?: string | null;
  reason?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface NextTeamAction {
  action: string;
  priority: number; // higher = more urgent
  why: string;
  person?: { id: string; name: string } | null;
  source_entity?: { type: string; id: string } | null;
  direct_route: string;
  badge?: "critical" | "warning" | "attention" | "info";
}

export interface DelegationHealthResult {
  state: DelegationHealthState;
  reasons: string[];
}

export interface PersonCapacityResult {
  person_id: string;
  person_name: string;
  capacity_state: CapacityState;
  active_tasks: number;
  active_runs: number;
  active_delegations: number;
  blocked_items: number;
  critical_items: number;
  reasons: string[];
}

export interface OwnershipGap {
  id: string;
  type: "unowned_responsibility" | "unowned_critical_sop" | "unowned_process" | "inactive_owner" | "ownership_conflict" | "unowned_milestone";
  title: string;
  criticality: TeamCriticality;
  description: string;
  route: string;
  entity_type: string;
  entity_id: string;
}

export interface BackupGap {
  responsibility_id: string;
  responsibility_name: string;
  primary_owner_id: string;
  primary_owner_name?: string;
  criticality: TeamCriticality;
  reason: "no_backup" | "same_owner_backup";
  description: string;
}

export interface TeamRisk {
  id: string;
  risk: string;
  severity: TeamCriticality;
  evidence: string;
  affected_person?: { id: string; name: string } | null;
  affected_records?: Array<{ type: string; id: string; title: string }>;
  suggested_action: string;
  route: string;
}

export interface WaitingItem {
  id: string;
  what: string;
  who?: string;
  who_id?: string;
  since: string;
  due?: string | null;
  status: string;
  why_waiting: string;
  next_action: string;
  route: string;
  is_waiting_on_me: boolean;
}

// --------------------------------------------------------------------------
// 1. evaluateDelegationHealth
// --------------------------------------------------------------------------
export function evaluateDelegationHealth(
  delegation: TeamDelegation,
  nowIso = new Date().toISOString()
): DelegationHealthResult {
  if (delegation.status === "completed") {
    return { state: "completed", reasons: ["Delegation is completed."] };
  }
  if (delegation.status === "cancelled") {
    return { state: "completed", reasons: ["Delegation was cancelled."] };
  }
  if (delegation.status === "blocked") {
    return {
      state: "blocked",
      reasons: [delegation.blocked_reason ? `Blocked: ${delegation.blocked_reason}` : "Work is blocked and needs unblocking."],
    };
  }

  const todayStr = nowIso.slice(0, 10);
  const reasons: string[] = [];

  const isOverdue = delegation.due_at && delegation.due_at.slice(0, 10) < todayStr;
  const isDueToday = delegation.due_at && delegation.due_at.slice(0, 10) === todayStr;
  const isReviewDue = delegation.review_at && delegation.review_at.slice(0, 10) <= todayStr;

  if (isOverdue) {
    reasons.push(`Overdue since ${delegation.due_at?.slice(0, 10)}.`);
  }
  if (isDueToday) {
    reasons.push("Due today.");
  }
  if (isReviewDue) {
    reasons.push("Delegation review date reached.");
  }

  if (isOverdue && delegation.priority === "critical") {
    return { state: "at_risk", reasons: ["Critical delegation is overdue.", ...reasons] };
  }
  if (isOverdue) {
    return { state: "at_risk", reasons };
  }
  if (isReviewDue || isDueToday) {
    return { state: "needs_attention", reasons };
  }

  if (delegation.status === "needs_review") {
    return { state: "needs_attention", reasons: ["Completed work is awaiting owner review."] };
  }

  if (["assigned", "acknowledged", "in_progress"].includes(delegation.status)) {
    return { state: "on_track", reasons: ["Work progressing according to schedule."] };
  }

  if (delegation.status === "draft") {
    return { state: "needs_attention", reasons: ["Draft delegation has not been assigned yet."] };
  }

  return { state: "unknown", reasons: ["Insufficient tracking signals."] };
}

// --------------------------------------------------------------------------
// 2. evaluatePersonCapacity
// --------------------------------------------------------------------------
export function evaluatePersonCapacity(
  person: TeamPerson,
  tasks: Array<{ id: string; priority?: string; status?: string; is_critical?: boolean }> = [],
  runs: Array<{ id: string; priority?: string; status?: string }> = [],
  delegations: Array<TeamDelegation> = [],
  commitments: Array<TeamCommitment> = [],
  availability?: TeamAvailability | null
): PersonCapacityResult {
  const activeTasks = tasks.filter(t => !["completed", "cancelled", "done"].includes(t.status ?? "")).length;
  const activeRuns = runs.filter(r => ["in_progress", "ready", "planned", "blocked"].includes(r.status ?? "")).length;
  const activeDelegations = delegations.filter(d => !["completed", "cancelled"].includes(d.status)).length;
  const openCommitments = commitments.filter(c => c.status === "open").length;

  const blockedItems =
    delegations.filter(d => d.status === "blocked").length +
    runs.filter(r => r.status === "blocked").length;

  const criticalItems =
    delegations.filter(d => d.priority === "critical" && !["completed", "cancelled"].includes(d.status)).length +
    runs.filter(r => r.priority === "critical" && !["completed", "cancelled"].includes(r.status ?? "")).length +
    tasks.filter(t => Boolean(t.is_critical || t.priority === "critical")).length;

  const reasons: string[] = [];

  if (person.status === "inactive" || person.status === "archived") {
    return {
      person_id: person.id,
      person_name: person.name,
      capacity_state: "unavailable",
      active_tasks: activeTasks,
      active_runs: activeRuns,
      active_delegations: activeDelegations,
      blocked_items: blockedItems,
      critical_items: criticalItems,
      reasons: [`Person is currently ${person.status}.`],
    };
  }

  if (availability?.status === "unavailable") {
    return {
      person_id: person.id,
      person_name: person.name,
      capacity_state: "unavailable",
      active_tasks: activeTasks,
      active_runs: activeRuns,
      active_delegations: activeDelegations,
      blocked_items: blockedItems,
      critical_items: criticalItems,
      reasons: [availability.reason ? `Unavailable: ${availability.reason}` : "Marked unavailable in availability schedule."],
    };
  }

  const totalActive = activeTasks + activeRuns + activeDelegations + openCommitments;

  if (availability?.status === "limited") {
    reasons.push("Working with limited recorded availability.");
  }

  if (totalActive >= 10 || criticalItems >= 4) {
    reasons.push(`High concurrent commitments (${totalActive} active items, ${criticalItems} critical).`);
    return {
      person_id: person.id,
      person_name: person.name,
      capacity_state: "overloaded",
      active_tasks: activeTasks,
      active_runs: activeRuns,
      active_delegations: activeDelegations,
      blocked_items: blockedItems,
      critical_items: criticalItems,
      reasons,
    };
  }

  if (totalActive >= 6 || criticalItems >= 2 || (availability?.status === "limited" && totalActive >= 3)) {
    reasons.push(`Moderate load (${totalActive} active commitments).`);
    return {
      person_id: person.id,
      person_name: person.name,
      capacity_state: "busy",
      active_tasks: activeTasks,
      active_runs: activeRuns,
      active_delegations: activeDelegations,
      blocked_items: blockedItems,
      critical_items: criticalItems,
      reasons,
    };
  }

  if (totalActive >= 1) {
    reasons.push(`Healthy distribution (${totalActive} active commitments).`);
    return {
      person_id: person.id,
      person_name: person.name,
      capacity_state: "balanced",
      active_tasks: activeTasks,
      active_runs: activeRuns,
      active_delegations: activeDelegations,
      blocked_items: blockedItems,
      critical_items: criticalItems,
      reasons,
    };
  }

  return {
    person_id: person.id,
    person_name: person.name,
    capacity_state: "available",
    active_tasks: 0,
    active_runs: 0,
    active_delegations: 0,
    blocked_items: 0,
    critical_items: 0,
    reasons: ["No active commitments recorded; capacity available."],
  };
}

// --------------------------------------------------------------------------
// 3. detectOwnershipGaps
// --------------------------------------------------------------------------
export function detectOwnershipGaps(
  responsibilities: TeamResponsibility[] = [],
  entities: {
    sops?: Array<{ id: string; title: string; criticality: string; owner_label?: string | null }>;
    processes?: Array<{ id: string; name: string; is_active: boolean }>;
    milestones?: Array<{ id: string; title: string; status: string }>;
  } = {},
  people: TeamPerson[] = []
): OwnershipGap[] {
  const gaps: OwnershipGap[] = [];
  const peopleMap = new Map(people.map(p => [p.id, p]));

  // Responsibilities missing primary owner or having inactive owner
  for (const resp of responsibilities) {
    if (resp.status === "archived" || resp.status === "paused") continue;

    if (!resp.primary_owner_id || resp.status === "needs_owner") {
      gaps.push({
        id: `gap:resp:${resp.id}`,
        type: "unowned_responsibility",
        title: `Responsibility "${resp.name}" has no primary owner`,
        criticality: resp.criticality,
        description: `Ongoing area "${resp.name}" is active without an assigned accountable owner.`,
        route: `/team/responsibilities`,
        entity_type: "team_responsibility",
        entity_id: resp.id,
      });
    } else {
      const owner = peopleMap.get(resp.primary_owner_id);
      if (owner && (owner.status === "inactive" || owner.status === "archived")) {
        gaps.push({
          id: `gap:inactive:${resp.id}`,
          type: "inactive_owner",
          title: `Primary owner of "${resp.name}" is ${owner.status}`,
          criticality: resp.criticality,
          description: `${owner.name} is marked ${owner.status} but remains assigned as primary owner.`,
          route: `/team/responsibilities`,
          entity_type: "team_responsibility",
          entity_id: resp.id,
        });
      }
    }
  }

  // Critical SOPs without owner
  for (const sop of entities.sops ?? []) {
    if (sop.criticality === "critical" && (!sop.owner_label || !sop.owner_label.trim())) {
      gaps.push({
        id: `gap:sop:${sop.id}`,
        type: "unowned_critical_sop",
        title: `Critical SOP "${sop.title}" has no designated owner`,
        criticality: "critical",
        description: `Operational SOP "${sop.title}" has high criticality but lacks an accountable owner.`,
        route: `/operations/sops/${sop.id}`,
        entity_type: "operational_sop",
        entity_id: sop.id,
      });
    }
  }

  return gaps;
}

// --------------------------------------------------------------------------
// 4. detectBackupGaps
// --------------------------------------------------------------------------
export function detectBackupGaps(
  responsibilities: TeamResponsibility[] = [],
  people: TeamPerson[] = []
): BackupGap[] {
  const gaps: BackupGap[] = [];
  const peopleMap = new Map(people.map(p => [p.id, p]));

  for (const resp of responsibilities) {
    if (resp.status === "archived" || resp.status === "paused") continue;

    if (resp.criticality === "critical" || resp.criticality === "high") {
      const primaryName = resp.primary_owner_id ? peopleMap.get(resp.primary_owner_id)?.name ?? "Assigned" : "Unassigned";

      if (!resp.backup_owner_id) {
        gaps.push({
          responsibility_id: resp.id,
          responsibility_name: resp.name,
          primary_owner_id: resp.primary_owner_id ?? "",
          primary_owner_name: primaryName,
          criticality: resp.criticality,
          reason: "no_backup",
          description: `Single-owner dependency: "${resp.name}" has no designated backup owner.`,
        });
      } else if (resp.backup_owner_id === resp.primary_owner_id) {
        gaps.push({
          responsibility_id: resp.id,
          responsibility_name: resp.name,
          primary_owner_id: resp.primary_owner_id,
          primary_owner_name: primaryName,
          criticality: resp.criticality,
          reason: "same_owner_backup",
          description: `Conflict: Primary and backup owner for "${resp.name}" are the same person.`,
        });
      }
    }
  }

  return gaps;
}

// --------------------------------------------------------------------------
// 5. detectTeamRisks
// --------------------------------------------------------------------------
export function detectTeamRisks(
  people: TeamPerson[] = [],
  delegations: TeamDelegation[] = [],
  responsibilities: TeamResponsibility[] = [],
  escalations: TeamEscalation[] = [],
  capacityResults: PersonCapacityResult[] = [],
  handoffs: Array<{ id: string; accepted: boolean; expected_handoff_time?: string | null }> = [],
  nowIso = new Date().toISOString()
): TeamRisk[] {
  const risks: TeamRisk[] = [];
  const todayStr = nowIso.slice(0, 10);

  // 1. Open critical escalations
  for (const esc of escalations.filter(e => e.status === "open" && e.severity === "critical")) {
    risks.push({
      id: `risk:esc:${esc.id}`,
      risk: "Open Critical Escalation",
      severity: "critical",
      evidence: esc.reason,
      suggested_action: "Review escalation and agree on immediate corrective resolution.",
      route: `/team/risks`,
      affected_records: [{ type: "team_escalation", id: esc.id, title: esc.reason.slice(0, 40) }],
    });
  }

  // 2. Overloaded person with critical work
  for (const cap of capacityResults.filter(c => c.capacity_state === "overloaded")) {
    const p = people.find(item => item.id === cap.person_id);
    risks.push({
      id: `risk:cap:${cap.person_id}`,
      risk: `Capacity overload: ${cap.person_name}`,
      severity: cap.critical_items > 0 ? "critical" : "high",
      evidence: `${cap.person_name} has ${cap.active_delegations + cap.active_tasks + cap.active_runs} active commitments (${cap.critical_items} critical).`,
      affected_person: p ? { id: p.id, name: p.name } : null,
      suggested_action: "Review workload and consider reassigning non-critical delegations.",
      route: `/team/capacity`,
    });
  }

  // 3. Blocked critical delegations
  for (const del of delegations.filter(d => d.status === "blocked" && d.priority === "critical")) {
    const p = people.find(item => item.id === del.delegated_to_person_id);
    risks.push({
      id: `risk:del:blocked:${del.id}`,
      risk: `Critical delegation blocked: ${del.title}`,
      severity: "critical",
      evidence: del.blocked_reason || "Delegation marked blocked without reason notes.",
      affected_person: p ? { id: p.id, name: p.name } : null,
      suggested_action: "Intervene to clear the blocking dependency.",
      route: `/team/delegations`,
      affected_records: [{ type: "team_delegation", id: del.id, title: del.title }],
    });
  }

  // 4. Overdue critical delegations
  for (const del of delegations.filter(d => d.priority === "critical" && d.due_at && d.due_at.slice(0, 10) < todayStr && !["completed", "cancelled"].includes(d.status))) {
    const p = people.find(item => item.id === del.delegated_to_person_id);
    risks.push({
      id: `risk:del:overdue:${del.id}`,
      risk: `Critical delegation overdue: ${del.title}`,
      severity: "high",
      evidence: `Target due date was ${del.due_at?.slice(0, 10)}.`,
      affected_person: p ? { id: p.id, name: p.name } : null,
      suggested_action: "Contact assignee to align on new delivery target or unblock.",
      route: `/team/delegations`,
      affected_records: [{ type: "team_delegation", id: del.id, title: del.title }],
    });
  }

  // 5. Critical responsibility with no backup
  const backupGaps = detectBackupGaps(responsibilities, people);
  for (const bg of backupGaps.filter(b => b.criticality === "critical")) {
    risks.push({
      id: `risk:backup:${bg.responsibility_id}`,
      risk: `Single-owner dependency: ${bg.responsibility_name}`,
      severity: "high",
      evidence: bg.description,
      suggested_action: "Designate a qualified backup owner in responsibilities registry.",
      route: `/team/responsibilities`,
      affected_records: [{ type: "team_responsibility", id: bg.responsibility_id, title: bg.responsibility_name }],
    });
  }

  // 6. Overdue unaccepted handoffs
  for (const h of handoffs.filter(item => !item.accepted && item.expected_handoff_time && item.expected_handoff_time.slice(0, 10) < todayStr)) {
    risks.push({
      id: `risk:handoff:${h.id}`,
      risk: "Operational handoff delayed",
      severity: "medium",
      evidence: `Handoff expected by ${h.expected_handoff_time?.slice(0, 10)} has not been accepted.`,
      suggested_action: "Verify receiver received necessary inputs and acknowledge.",
      route: `/operations/runs`,
      affected_records: [{ type: "operational_handoff", id: h.id, title: "Handoff" }],
    });
  }

  return risks;
}

// --------------------------------------------------------------------------
// 6. rankNextTeamAction
// --------------------------------------------------------------------------
export function rankNextTeamAction(
  delegations: TeamDelegation[] = [],
  responsibilities: TeamResponsibility[] = [],
  waitingOnMeList: WaitingItem[] = [],
  capacityResults: PersonCapacityResult[] = [],
  escalations: TeamEscalation[] = [],
  people: TeamPerson[] = [],
  nowIso = new Date().toISOString()
): NextTeamAction {
  const peopleMap = new Map(people.map(p => [p.id, p]));
  const todayStr = nowIso.slice(0, 10);

  // 1. Critical open escalation
  const criticalEsc = escalations.find(e => e.status === "open" && e.severity === "critical");
  if (criticalEsc) {
    const person = criticalEsc.person_id ? peopleMap.get(criticalEsc.person_id) : null;
    return {
      action: `Resolve critical escalation: ${criticalEsc.reason.slice(0, 50)}`,
      priority: 100,
      why: "A critical team escalation requires urgent owner intervention.",
      person: person ? { id: person.id, name: person.name } : null,
      source_entity: criticalEsc.source_entity_type && criticalEsc.source_entity_id ? { type: criticalEsc.source_entity_type, id: criticalEsc.source_entity_id } : null,
      direct_route: "/team/risks",
      badge: "critical",
    };
  }

  // 2. Critical blocked delegation
  const blockedCritDel = delegations.find(d => d.status === "blocked" && d.priority === "critical");
  if (blockedCritDel) {
    const person = peopleMap.get(blockedCritDel.delegated_to_person_id);
    return {
      action: `Unblock ${person?.name ?? "team member"} on ${blockedCritDel.title}`,
      priority: 95,
      why: blockedCritDel.blocked_reason ? `Blocked: ${blockedCritDel.blocked_reason}` : "Critical delegation is blocked waiting for intervention.",
      person: person ? { id: person.id, name: person.name } : null,
      source_entity: { type: "team_delegation", id: blockedCritDel.id },
      direct_route: `/team/delegations`,
      badge: "critical",
    };
  }

  // 3. Critical responsibility has no owner
  const unownedCritResp = responsibilities.find(r => r.criticality === "critical" && (!r.primary_owner_id || r.status === "needs_owner"));
  if (unownedCritResp) {
    return {
      action: `Assign accountable owner to "${unownedCritResp.name}"`,
      priority: 90,
      why: "A critical responsibility area currently has no accountable primary owner.",
      direct_route: `/team/responsibilities`,
      badge: "critical",
    };
  }

  // 4. Overdue items waiting on me
  const overdueWaitingOnMe = waitingOnMeList.find(w => w.due && w.due < todayStr);
  if (overdueWaitingOnMe) {
    return {
      action: `Respond to: ${overdueWaitingOnMe.what}`,
      priority: 85,
      why: `Another person is blocked waiting for your action since ${overdueWaitingOnMe.since}.`,
      direct_route: overdueWaitingOnMe.route,
      badge: "warning",
    };
  }

  // 5. Overdue critical delegation
  const overdueCritDel = delegations.find(d => d.priority === "critical" && d.due_at && d.due_at.slice(0, 10) < todayStr && !["completed", "cancelled"].includes(d.status));
  if (overdueCritDel) {
    const person = peopleMap.get(overdueCritDel.delegated_to_person_id);
    return {
      action: `Follow up with ${person?.name ?? "assignee"} on overdue "${overdueCritDel.title}"`,
      priority: 80,
      why: `Critical outcome target date was ${overdueCritDel.due_at?.slice(0, 10)}.`,
      person: person ? { id: person.id, name: person.name } : null,
      source_entity: { type: "team_delegation", id: overdueCritDel.id },
      direct_route: `/team/delegations`,
      badge: "warning",
    };
  }

  // 6. Overloaded team member with critical commitments
  const overloadedPerson = capacityResults.find(c => c.capacity_state === "overloaded" && c.critical_items > 0);
  if (overloadedPerson) {
    const person = peopleMap.get(overloadedPerson.person_id);
    return {
      action: `Rebalance workload from ${overloadedPerson.person_name}`,
      priority: 75,
      why: `${overloadedPerson.person_name} is carrying ${overloadedPerson.critical_items} critical items and active overload.`,
      person: person ? { id: person.id, name: person.name } : null,
      direct_route: `/team/capacity`,
      badge: "attention",
    };
  }

  // 7. Critical responsibility has no backup
  const backupGaps = detectBackupGaps(responsibilities, people);
  const critBackupGap = backupGaps.find(b => b.criticality === "critical");
  if (critBackupGap) {
    return {
      action: `Add backup owner to critical "${critBackupGap.responsibility_name}"`,
      priority: 70,
      why: "Single-owner dependency: if primary owner is unavailable, this critical area stops.",
      direct_route: `/team/responsibilities`,
      badge: "attention",
    };
  }

  // 8. General items waiting on me
  if (waitingOnMeList.length > 0) {
    const firstWait = waitingOnMeList[0];
    return {
      action: `Review item waiting on you: ${firstWait.what}`,
      priority: 60,
      why: `${waitingOnMeList.length} item${waitingOnMeList.length === 1 ? " is" : "s are"} waiting on your response.`,
      direct_route: firstWait.route,
      badge: "info",
    };
  }

  // 9. Stale delegation needing review
  const reviewDueDel = delegations.find(d => d.review_at && d.review_at.slice(0, 10) <= todayStr && !["completed", "cancelled"].includes(d.status));
  if (reviewDueDel) {
    const person = peopleMap.get(reviewDueDel.delegated_to_person_id);
    return {
      action: `Review delegation progress: "${reviewDueDel.title}"`,
      priority: 50,
      why: `Scheduled review date reached for work delegated to ${person?.name ?? "assignee"}.`,
      person: person ? { id: person.id, name: person.name } : null,
      source_entity: { type: "team_delegation", id: reviewDueDel.id },
      direct_route: `/team/delegations`,
      badge: "info",
    };
  }

  return {
    action: "All team coordination flows healthy",
    priority: 10,
    why: "No urgent blockers, ownership gaps, or delayed handoffs detected.",
    direct_route: "/team",
    badge: "info",
  };
}

// --------------------------------------------------------------------------
// 7. evaluateWaitingState
// --------------------------------------------------------------------------
export function evaluateWaitingState(
  delegations: TeamDelegation[] = [],
  handoffs: Array<{ id: string; accepted: boolean; from_label?: string; to_label?: string; handoff_description?: string; expected_handoff_time?: string | null; created_at: string }> = [],
  approvals: Array<{ id: string; title: string; status: string; requester_name?: string; created_at: string }> = [],
  people: TeamPerson[] = []
): { waitingOnTeam: WaitingItem[]; waitingOnMe: WaitingItem[] } {
  const peopleMap = new Map(people.map(p => [p.id, p]));
  const waitingOnTeam: WaitingItem[] = [];
  const waitingOnMe: WaitingItem[] = [];

  // Active delegations assigned to others = waiting on team
  for (const del of delegations) {
    if (["assigned", "acknowledged", "in_progress", "blocked"].includes(del.status)) {
      const person = peopleMap.get(del.delegated_to_person_id);
      waitingOnTeam.push({
        id: `wait:del:${del.id}`,
        what: del.title,
        who: person?.name ?? "Assignee",
        who_id: del.delegated_to_person_id,
        since: del.delegated_at?.slice(0, 10) ?? "",
        due: del.due_at?.slice(0, 10) ?? null,
        status: del.status,
        why_waiting: del.status === "blocked" ? (del.blocked_reason || "Assignee blocked.") : "Awaiting completion of expected outcome.",
        next_action: del.status === "blocked" ? "Help unblock assignee" : "Check in on scheduled review date",
        route: `/team/delegations`,
        is_waiting_on_me: false,
      });
    } else if (del.status === "needs_review") {
      const person = peopleMap.get(del.delegated_to_person_id);
      waitingOnMe.push({
        id: `wait:review:${del.id}`,
        what: `Review work from ${person?.name ?? "assignee"}: ${del.title}`,
        who: person?.name ?? "Assignee",
        who_id: del.delegated_to_person_id,
        since: del.updated_at?.slice(0, 10) ?? del.delegated_at?.slice(0, 10) ?? "",
        due: del.due_at?.slice(0, 10) ?? null,
        status: "needs_review",
        why_waiting: "Outcome reported ready for owner verification.",
        next_action: "Review outcome and mark complete or provide feedback",
        route: `/team/delegations`,
        is_waiting_on_me: true,
      });
    }
  }

  // Pending handoffs: if not accepted, who needs to accept?
  for (const h of handoffs) {
    if (!h.accepted) {
      waitingOnTeam.push({
        id: `wait:handoff:${h.id}`,
        what: `Handoff: ${h.handoff_description || "Operational transfer"}`,
        who: h.to_label || "Receiver",
        since: h.created_at.slice(0, 10),
        due: h.expected_handoff_time?.slice(0, 10) ?? null,
        status: "pending",
        why_waiting: `Awaiting acceptance by ${h.to_label || "receiver"}.`,
        next_action: "Confirm receipt of materials and accept handoff",
        route: `/operations/runs`,
        is_waiting_on_me: false,
      });
    }
  }

  // Approvals awaiting owner decision = waiting on me
  for (const app of approvals) {
    if (app.status === "pending") {
      waitingOnMe.push({
        id: `wait:app:${app.id}`,
        what: `Approval request: ${app.title}`,
        who: app.requester_name || "Requester",
        since: app.created_at.slice(0, 10),
        status: "pending",
        why_waiting: "Requires owner approval decision before work can proceed.",
        next_action: "Approve or decline in Approvals center",
        route: `/approvals`,
        is_waiting_on_me: true,
      });
    }
  }

  return { waitingOnTeam, waitingOnMe };
}

// --------------------------------------------------------------------------
// 8. buildTeamReview
// --------------------------------------------------------------------------
export function buildTeamReview(
  delegations: TeamDelegation[] = [],
  responsibilities: TeamResponsibility[] = [],
  people: TeamPerson[] = [],
  escalations: TeamEscalation[] = [],
  handoffs: Array<{ id: string; accepted: boolean }> = [],
  period: "week" | "month" = "week"
) {
  const openDelegations = delegations.filter(d => !["completed", "cancelled"].includes(d.status)).length;
  const completedDelegations = delegations.filter(d => d.status === "completed").length;
  const blockedDelegations = delegations.filter(d => d.status === "blocked").length;

  const todayStr = new Date().toISOString().slice(0, 10);
  const overdueDelegations = delegations.filter(d => d.due_at && d.due_at.slice(0, 10) < todayStr && !["completed", "cancelled"].includes(d.status)).length;

  const ownershipGaps = detectOwnershipGaps(responsibilities, {}, people);
  const backupGaps = detectBackupGaps(responsibilities, people);

  return {
    period,
    metrics: {
      totalPeople: people.filter(p => p.status === "active").length,
      openDelegations,
      completedDelegations,
      blockedDelegations,
      overdueDelegations,
      ownershipGapsCount: ownershipGaps.length,
      backupGapsCount: backupGaps.length,
      openEscalations: escalations.filter(e => e.status === "open").length,
      pendingHandoffs: handoffs.filter(h => !h.accepted).length,
    },
    ownershipGaps,
    backupGaps,
  };
}

// --------------------------------------------------------------------------
// 9. validateForeignOwnership
// --------------------------------------------------------------------------
export async function validateForeignOwnership(
  supabase: SupabaseClient,
  userId: string,
  entityType: string,
  entityId: string
): Promise<boolean> {
  const tableMap: Record<string, { table: string; idCol?: string; userCol?: string }> = {
    task: { table: "tasks" },
    project: { table: "projects" },
    client: { table: "clients" },
    lead: { table: "leads" },
    opportunity: { table: "opportunities" },
    proposal: { table: "proposals" },
    campaign: { table: "campaigns" },
    content: { table: "content_items" },
    goal: { table: "goals" },
    decision: { table: "decisions" },
    strategic_commitment: { table: "strategic_commitments" },
    milestone: { table: "milestones" },
    sop: { table: "operational_sops" },
    process: { table: "process_templates" },
    process_run: { table: "process_runs" },
    quality_incident: { table: "quality_incidents" },
    operational_runbook: { table: "operational_runbooks" },
    operational_system: { table: "operational_systems" },
    supplier: { table: "suppliers" },
    supplier_order: { table: "supplier_orders" },
    product: { table: "products" },
    topic: { table: "research_topics" },
    note: { table: "notes" },
    meeting: { table: "calendar_events" },
    contact: { table: "client_contacts" },
  };

  const config = tableMap[entityType];
  if (!config) return false;

  const userColumn = config.userCol ?? "user_id";
  const idColumn = config.idCol ?? "id";

  const { data, error } = await supabase
    .from(config.table)
    .select(idColumn)
    .eq(idColumn, entityId)
    .eq(userColumn, userId)
    .maybeSingle();

  if (error || !data) return false;
  return true;
}
