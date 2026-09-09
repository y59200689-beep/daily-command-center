import assert from "node:assert/strict";
import test from "node:test";
import { readFile, access } from "node:fs/promises";
import path from "node:path";
import {
  evaluateDelegationHealth,
  evaluatePersonCapacity,
  detectOwnershipGaps,
  detectBackupGaps,
  detectTeamRisks,
  rankNextTeamAction,
  evaluateWaitingState,
  buildTeamReview,
  validateForeignOwnership,
  type TeamPerson,
  type TeamDelegation,
  type TeamResponsibility,
  type TeamCommitment,
  type TeamEscalation,
  type TeamAvailability,
} from "../src/lib/team";
import { safeAutomationTypes } from "../src/lib/v4";
import { emitTeamNotifications } from "../src/lib/notification-producers";
import { assistantTools } from "../src/lib/ai-tools";

const BASE_DIR = path.resolve(__dirname, "..");

// ============================================================
// 1. evaluateDelegationHealth Tests
// ============================================================

test("V12 evaluateDelegationHealth returns completed for completed delegation", () => {
  const delegation: TeamDelegation = {
    id: "del-1",
    title: "Prepare Client Deck",
    delegated_to_person_id: "person-1",
    expected_outcome: "Deck ready for review",
    status: "completed",
    priority: "high",
  };
  const result = evaluateDelegationHealth(delegation, "2026-09-09T10:00:00Z");
  assert.equal(result.state, "completed");
  assert.ok(result.reasons.some((r) => r.toLowerCase().includes("completed")));
});

test("V12 evaluateDelegationHealth returns completed for cancelled delegation", () => {
  const delegation: TeamDelegation = {
    id: "del-2",
    title: "Cancelled Task",
    delegated_to_person_id: "person-1",
    expected_outcome: "None",
    status: "cancelled",
    priority: "low",
  };
  const result = evaluateDelegationHealth(delegation, "2026-09-09T10:00:00Z");
  assert.equal(result.state, "completed");
  assert.ok(result.reasons.some((r) => r.toLowerCase().includes("cancelled")));
});

test("V12 evaluateDelegationHealth returns blocked for blocked status", () => {
  const delegation: TeamDelegation = {
    id: "del-3",
    title: "Awaiting Client Assets",
    delegated_to_person_id: "person-2",
    expected_outcome: "Assets received",
    status: "blocked",
    priority: "high",
    blocked_reason: "Client has not sent logos",
  };
  const result = evaluateDelegationHealth(delegation, "2026-09-09T10:00:00Z");
  assert.equal(result.state, "blocked");
  assert.ok(result.reasons.some((r) => r.includes("Blocked")));
});

test("V12 evaluateDelegationHealth detects overdue delegation as at_risk", () => {
  const delegation: TeamDelegation = {
    id: "del-4",
    title: "Weekly Status Report",
    delegated_to_person_id: "person-3",
    expected_outcome: "Report delivered",
    status: "in_progress",
    priority: "medium",
    due_at: "2026-09-05T00:00:00Z",
  };
  const result = evaluateDelegationHealth(delegation, "2026-09-09T10:00:00Z");
  assert.equal(result.state, "at_risk");
  assert.ok(result.reasons.some((r) => r.includes("Overdue")));
});

test("V12 evaluateDelegationHealth detects due today as needs_attention", () => {
  const delegation: TeamDelegation = {
    id: "del-5",
    title: "Finish Budget Review",
    delegated_to_person_id: "person-3",
    expected_outcome: "Budget approved",
    status: "in_progress",
    priority: "high",
    due_at: "2026-09-09T23:59:59Z",
  };
  const result = evaluateDelegationHealth(delegation, "2026-09-09T10:00:00Z");
  assert.equal(result.state, "needs_attention");
  assert.ok(result.reasons.some((r) => r.includes("Due today")));
});

test("V12 evaluateDelegationHealth detects needs_review as needs_attention", () => {
  const delegation: TeamDelegation = {
    id: "del-6",
    title: "Review Design Draft",
    delegated_to_person_id: "person-4",
    expected_outcome: "Feedback submitted",
    status: "needs_review",
    priority: "medium",
    due_at: "2026-09-15T00:00:00Z",
  };
  const result = evaluateDelegationHealth(delegation, "2026-09-09T10:00:00Z");
  assert.equal(result.state, "needs_attention");
  assert.ok(result.reasons.some((r) => r.includes("review")));
});

test("V12 evaluateDelegationHealth marks future due date on track", () => {
  const delegation: TeamDelegation = {
    id: "del-7",
    title: "Q4 Planning Doc",
    delegated_to_person_id: "person-5",
    expected_outcome: "Q4 doc completed",
    status: "in_progress",
    priority: "medium",
    due_at: "2026-09-20T00:00:00Z",
  };
  const result = evaluateDelegationHealth(delegation, "2026-09-09T10:00:00Z");
  assert.equal(result.state, "on_track");
  assert.ok(result.reasons.some((r) => r.includes("progressing")));
});

test("V12 evaluateDelegationHealth does not mutate input delegation", () => {
  const original: TeamDelegation = Object.freeze({
    id: "del-frozen",
    title: "Immutable Check",
    delegated_to_person_id: "person-1",
    expected_outcome: "Verify immutability",
    status: "in_progress",
    priority: "high",
    due_at: "2026-09-12T00:00:00Z",
  });
  assert.doesNotThrow(() => {
    evaluateDelegationHealth(original, "2026-09-09T10:00:00Z");
  });
});

// ============================================================
// 2. evaluatePersonCapacity Tests
// ============================================================

test("V12 evaluatePersonCapacity handles inactive and archived people correctly", () => {
  const inactivePerson: TeamPerson = {
    id: "p-inactive",
    name: "Inactive Person",
    relationship_type: "contractor",
    status: "inactive",
  };
  const resultInactive = evaluatePersonCapacity(inactivePerson);
  assert.equal(resultInactive.capacity_state, "unavailable");
  assert.ok(resultInactive.reasons[0].toLowerCase().includes("inactive"));

  const archivedPerson: TeamPerson = {
    id: "p-archived",
    name: "Archived Person",
    relationship_type: "team_member",
    status: "archived",
  };
  const resultArchived = evaluatePersonCapacity(archivedPerson);
  assert.equal(resultArchived.capacity_state, "unavailable");
  assert.ok(resultArchived.reasons[0].toLowerCase().includes("archived"));
});

test("V12 evaluatePersonCapacity handles active person with zero active items as available", () => {
  const person: TeamPerson = {
    id: "p-active",
    name: "Free Agent",
    relationship_type: "team_member",
    status: "active",
  };
  const result = evaluatePersonCapacity(person, [], [], [], []);
  assert.equal(result.capacity_state, "available");
  assert.equal(result.active_delegations, 0);
  assert.equal(result.active_tasks, 0);
  // Ensure no fake utilization percentage
  assert.equal((result as unknown as Record<string, unknown>).utilizationPercentage, undefined);
  assert.equal((result as unknown as Record<string, unknown>).utilization_percent, undefined);
});

test("V12 evaluatePersonCapacity classifies overloaded when item count is high", () => {
  const person: TeamPerson = {
    id: "p-busy",
    name: "Busy Bee",
    relationship_type: "team_member",
    status: "active",
  };
  const delegations: TeamDelegation[] = [
    { id: "d1", title: "T1", delegated_to_person_id: "p-busy", status: "in_progress", priority: "critical", expected_outcome: "O1" },
    { id: "d2", title: "T2", delegated_to_person_id: "p-busy", status: "in_progress", priority: "high", expected_outcome: "O2" },
    { id: "d3", title: "T3", delegated_to_person_id: "p-busy", status: "in_progress", priority: "high", expected_outcome: "O3" },
    { id: "d4", title: "T4", delegated_to_person_id: "p-busy", status: "in_progress", priority: "high", expected_outcome: "O4" },
    { id: "d5", title: "T5", delegated_to_person_id: "p-busy", status: "blocked", priority: "critical", expected_outcome: "O5" },
    { id: "d6", title: "T6", delegated_to_person_id: "p-busy", status: "in_progress", priority: "critical", expected_outcome: "O6" },
  ];
  const commitments: TeamCommitment[] = [
    { id: "c1", from_person_id: "p-busy", statement: "Finish A", status: "open" },
    { id: "c2", from_person_id: "p-busy", statement: "Finish B", status: "open" },
    { id: "c3", from_person_id: "p-busy", statement: "Finish C", status: "open" },
  ];
  const result = evaluatePersonCapacity(person, [], [], delegations, commitments);
  assert.ok(["busy", "overloaded"].includes(result.capacity_state));
  assert.equal(result.active_delegations, 6);
});

test("V12 evaluatePersonCapacity factors in unavailable availability status", () => {
  const person: TeamPerson = {
    id: "p-pto",
    name: "On Vacation",
    relationship_type: "team_member",
    status: "active",
  };
  const availability: TeamAvailability = {
    id: "a1",
    person_id: "p-pto",
    status: "unavailable",
    reason: "Annual leave",
    start_at: "2026-09-01T00:00:00Z",
    end_at: "2026-09-15T00:00:00Z",
  };
  const result = evaluatePersonCapacity(person, [], [], [], [], availability);
  assert.equal(result.capacity_state, "unavailable");
  assert.ok(result.reasons.some((r) => r.toLowerCase().includes("leave") || r.toLowerCase().includes("unavailable")));
});

// ============================================================
// 3. detectOwnershipGaps Tests
// ============================================================

test("V12 detectOwnershipGaps flags missing primary owner", () => {
  const responsibilities: TeamResponsibility[] = [
    {
      id: "resp-1",
      name: "Security Audits",
      criticality: "critical",
      status: "active",
      primary_owner_id: null,
    },
  ];
  const gaps = detectOwnershipGaps(responsibilities, {});
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].entity_id, "resp-1");
  assert.equal(gaps[0].type, "unowned_responsibility");
  assert.equal(gaps[0].criticality, "critical");
});

test("V12 detectOwnershipGaps flags inactive primary owner", () => {
  const people: TeamPerson[] = [
    { id: "p-gone", name: "Departed Dev", relationship_type: "contractor", status: "inactive" },
  ];
  const responsibilities: TeamResponsibility[] = [
    {
      id: "resp-2",
      name: "Database Maintenance",
      criticality: "high",
      status: "active",
      primary_owner_id: "p-gone",
    },
  ];
  const gaps = detectOwnershipGaps(responsibilities, {}, people);
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].type, "inactive_owner");
});

test("V12 detectOwnershipGaps ignores archived responsibilities", () => {
  const responsibilities: TeamResponsibility[] = [
    {
      id: "resp-archived",
      name: "Legacy Migration",
      criticality: "high",
      status: "archived",
      primary_owner_id: null,
    },
  ];
  const gaps = detectOwnershipGaps(responsibilities, {});
  assert.equal(gaps.length, 0);
});

// ============================================================
// 4. detectBackupGaps Tests
// ============================================================

test("V12 detectBackupGaps flags critical responsibility without backup", () => {
  const responsibilities: TeamResponsibility[] = [
    {
      id: "resp-crit",
      name: "Production Incident Management",
      criticality: "critical",
      status: "active",
      primary_owner_id: "p-1",
      backup_owner_id: null,
    },
  ];
  const gaps = detectBackupGaps(responsibilities);
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].reason, "no_backup");
  assert.equal(gaps[0].criticality, "critical");
});

test("V12 detectBackupGaps flags conflict when primary and backup are same person", () => {
  const responsibilities: TeamResponsibility[] = [
    {
      id: "resp-same",
      name: "Customer Onboarding",
      criticality: "high",
      status: "active",
      primary_owner_id: "p-1",
      backup_owner_id: "p-1",
    },
  ];
  const gaps = detectBackupGaps(responsibilities);
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].reason, "same_owner_backup");
});

test("V12 detectBackupGaps does not flag low criticality responsibility without backup", () => {
  const responsibilities: TeamResponsibility[] = [
    {
      id: "resp-low",
      name: "Office Plants Care",
      criticality: "low",
      status: "active",
      primary_owner_id: "p-1",
      backup_owner_id: null,
    },
  ];
  const gaps = detectBackupGaps(responsibilities);
  assert.equal(gaps.length, 0);
});

// ============================================================
// 5. detectTeamRisks Tests
// ============================================================

test("V12 detectTeamRisks identifies open critical escalations", () => {
  const escalations: TeamEscalation[] = [
    {
      id: "esc-1",
      reason: "Payment Gateway Down",
      severity: "critical",
      status: "open",
    },
  ];
  const risks = detectTeamRisks([], [], [], escalations);
  const escRisk = risks.find((r) => r.severity === "critical");
  assert.ok(escRisk);
  assert.ok(escRisk.risk.includes("Escalation"));
});

test("V12 detectTeamRisks ignores resolved escalations", () => {
  const escalations: TeamEscalation[] = [
    {
      id: "esc-2",
      reason: "Minor CSS Glitch",
      severity: "low",
      status: "resolved",
      resolution: "Fixed in patch",
    },
  ];
  const risks = detectTeamRisks([], [], [], escalations);
  assert.equal(risks.length, 0);
});

test("V12 detectTeamRisks flags overdue critical delegations as risk items", () => {
  const people: TeamPerson[] = [
    { id: "p-lead", name: "Lead Dev", relationship_type: "team_member", status: "active" },
  ];
  const delegations: TeamDelegation[] = [
    {
      id: "d-overdue",
      title: "Deliver API docs",
      delegated_to_person_id: "p-lead",
      expected_outcome: "Docs published",
      status: "in_progress",
      priority: "critical",
      due_at: "2026-09-01T00:00:00Z",
    },
  ];
  const risks = detectTeamRisks(people, delegations, [], [], [], [], "2026-09-09T10:00:00Z");
  const overdueRisk = risks.find((r) => r.risk.toLowerCase().includes("overdue"));
  assert.ok(overdueRisk);
});

// ============================================================
// 6. evaluateWaitingState & rankNextTeamAction Tests
// ============================================================

test("V12 evaluateWaitingState correctly separates waiting on team vs waiting on owner", () => {
  const delegations: TeamDelegation[] = [
    {
      id: "d-wait-team",
      title: "Build landing page",
      delegated_to_person_id: "p-dev",
      expected_outcome: "Page deployed",
      status: "in_progress",
      priority: "medium",
      delegated_at: "2026-09-01T00:00:00Z",
    },
    {
      id: "d-wait-owner",
      title: "Review PR #42",
      delegated_to_person_id: "p-dev",
      expected_outcome: "PR approved",
      status: "needs_review",
      priority: "high",
      delegated_at: "2026-09-01T00:00:00Z",
    },
  ];
  const report = evaluateWaitingState(delegations, [], [], []);
  assert.ok(report.waitingOnTeam.length >= 1);
  assert.ok(report.waitingOnMe.length >= 1);
});

test("V12 rankNextTeamAction ranks critical escalation highest", () => {
  const people: TeamPerson[] = [
    { id: "p-1", name: "Dev One", relationship_type: "team_member", status: "active" },
  ];
  const escalations: TeamEscalation[] = [
    { id: "esc-top", reason: "API key leaked", severity: "critical", status: "open" },
  ];
  const delegations: TeamDelegation[] = [
    { id: "del-low", title: "Update README", delegated_to_person_id: "p-1", expected_outcome: "Done", status: "in_progress", priority: "low" },
  ];
  const action = rankNextTeamAction(delegations, [], [], [], escalations, people);
  assert.ok(action);
  assert.ok(action.action.includes("Resolve critical escalation"));
  assert.equal(action.priority, 100);
});

test("V12 buildTeamReview produces comprehensive structured report", () => {
  const people: TeamPerson[] = [
    { id: "p-1", name: "Alice", relationship_type: "team_member", status: "active" },
  ];
  const delegations: TeamDelegation[] = [
    { id: "d-1", title: "D1", delegated_to_person_id: "p-1", expected_outcome: "O1", status: "completed", priority: "medium" },
    { id: "d-2", title: "D2", delegated_to_person_id: "p-1", expected_outcome: "O2", status: "in_progress", priority: "high" },
  ];
  const responsibilities: TeamResponsibility[] = [
    { id: "r-1", name: "Resp 1", criticality: "high", status: "active", primary_owner_id: "p-1" },
  ];
  const review = buildTeamReview(delegations, responsibilities, people, [], [], "week");
  assert.ok(review.metrics);
  assert.equal(review.metrics.totalPeople, 1);
  assert.equal(review.metrics.openDelegations, 1);
  assert.equal(review.metrics.completedDelegations, 1);
});

// ============================================================
// 7. validateForeignOwnership Security & Isolation Tests
// ============================================================

test("V12 validateForeignOwnership rejects invalid or unsupported entity types", async () => {
  const mockSupabase = {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { id: "some-id" }, error: null }),
          }),
        }),
      }),
    }),
  };
  const client = mockSupabase as unknown as Parameters<typeof validateForeignOwnership>[0];
  const isInvalid = await validateForeignOwnership(client, "user-1", "arbitrary_table", "11111111-1111-1111-1111-111111111111");
  assert.equal(isInvalid, false);
});

test("V12 validateForeignOwnership accepts valid known entity types when record exists", async () => {
  const mockSupabase = {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { id: "project-123" }, error: null }),
          }),
        }),
      }),
    }),
  };
  const client = mockSupabase as unknown as Parameters<typeof validateForeignOwnership>[0];
  const isValid = await validateForeignOwnership(client, "user-1", "project", "11111111-1111-1111-1111-111111111111");
  assert.equal(isValid, true);
});

// ============================================================
// 8. Migration Schema & RLS Verification
// ============================================================

test("V12 migration file exists and defines all 11 required tables with RLS and owner isolation", async () => {
  const migrationPath = path.join(BASE_DIR, "supabase/migrations/20260909000000_v12_team_delegation_operating_system.sql");
  const sql = await readFile(migrationPath, "utf-8");

  const requiredTables = [
    "team_roles",
    "team_people",
    "team_responsibilities",
    "team_delegations",
    "team_delegation_history",
    "team_commitments",
    "team_escalations",
    "team_availability",
    "team_entity_ownership",
    "team_one_on_one_notes",
    "team_handoff_links",
  ];

  for (const table of requiredTables) {
    assert.ok(sql.includes(`create table if not exists ${table}`), `Table ${table} is missing in migration`);
    assert.ok(sql.includes(`'${table}'`), `Table ${table} should be included in RLS and policies`);
  }

  // Verify RLS enablement statement exists
  assert.ok(sql.includes("enable row level security"), "Missing enable row level security in migration");

  // Verify auth.uid() owner policies
  assert.ok(sql.includes("auth.uid()"), "Missing auth.uid() check in policies");

  // Verify NO drop table statements
  assert.ok(!sql.toLowerCase().includes("drop table"), "Migration must NOT contain DROP TABLE");

  // Verify updated_at triggers exist
  assert.ok(sql.includes("set_updated_at()"), "Missing set_updated_at function/triggers");
});

// ============================================================
// 9. API Routes Verification (All 18 routes exist)
// ============================================================

test("V12 all 18 API route handlers exist", async () => {
  const routePaths = [
    "src/app/api/team/overview/route.ts",
    "src/app/api/team/people/route.ts",
    "src/app/api/team/people/[id]/route.ts",
    "src/app/api/team/people/[id]/workload/route.ts",
    "src/app/api/team/people/[id]/timeline/route.ts",
    "src/app/api/team/roles/route.ts",
    "src/app/api/team/roles/[id]/route.ts",
    "src/app/api/team/responsibilities/route.ts",
    "src/app/api/team/responsibilities/[id]/route.ts",
    "src/app/api/team/delegations/route.ts",
    "src/app/api/team/delegations/[id]/route.ts",
    "src/app/api/team/delegations/[id]/reassign/route.ts",
    "src/app/api/team/commitments/route.ts",
    "src/app/api/team/commitments/[id]/route.ts",
    "src/app/api/team/escalations/route.ts",
    "src/app/api/team/escalations/[id]/route.ts",
    "src/app/api/team/ownership/route.ts",
    "src/app/api/team/capacity/route.ts",
    "src/app/api/team/risks/route.ts",
    "src/app/api/team/review/route.ts",
    "src/app/api/team/1on1/route.ts",
    "src/app/api/team/handoffs/route.ts",
    "src/app/api/team/availability/route.ts",
  ];

  for (const relPath of routePaths) {
    const fullPath = path.join(BASE_DIR, relPath);
    await assert.doesNotReject(async () => {
      await access(fullPath);
    }, `API route ${relPath} should exist`);
  }
});

// ============================================================
// 10. Workspace Pages & Feature Components Verification
// ============================================================

test("V12 all 10 workspace pages exist", async () => {
  const pagePaths = [
    "src/app/(workspace)/team/page.tsx",
    "src/app/(workspace)/team/people/page.tsx",
    "src/app/(workspace)/team/people/[id]/page.tsx",
    "src/app/(workspace)/team/responsibilities/page.tsx",
    "src/app/(workspace)/team/delegations/page.tsx",
    "src/app/(workspace)/team/ownership/page.tsx",
    "src/app/(workspace)/team/capacity/page.tsx",
    "src/app/(workspace)/team/risks/page.tsx",
    "src/app/(workspace)/team/review/page.tsx",
    "src/app/(workspace)/team/1on1/page.tsx",
  ];

  for (const relPath of pagePaths) {
    const fullPath = path.join(BASE_DIR, relPath);
    await assert.doesNotReject(async () => {
      await access(fullPath);
    }, `Page ${relPath} should exist`);
  }
});

test("V12 all 10 feature components exist", async () => {
  const componentPaths = [
    "src/features/team/team-home.tsx",
    "src/features/team/people-list.tsx",
    "src/features/team/person-detail.tsx",
    "src/features/team/responsibilities-view.tsx",
    "src/features/team/delegations-view.tsx",
    "src/features/team/ownership-map.tsx",
    "src/features/team/capacity-view.tsx",
    "src/features/team/team-risks.tsx",
    "src/features/team/team-review.tsx",
    "src/features/team/one-on-one-view.tsx",
  ];

  for (const relPath of componentPaths) {
    const fullPath = path.join(BASE_DIR, relPath);
    await assert.doesNotReject(async () => {
      await access(fullPath);
    }, `Feature component ${relPath} should exist`);
  }
});

// ============================================================
// 11. Cross-Domain Integrations Verification
// ============================================================

test("V12 automations include 8 team automation types", () => {
  const expectedAutomations = [
    "daily_delegation_review",
    "weekly_team_review",
    "waiting_on_team_review",
    "waiting_on_me_review",
    "ownership_gap_review",
    "team_capacity_review",
    "team_handoff_review",
    "backup_coverage_review",
  ];

  for (const autoType of expectedAutomations) {
    assert.ok(
      safeAutomationTypes.includes(autoType as (typeof safeAutomationTypes)[number]),
      `safeAutomationTypes should include ${autoType}`
    );
  }
});

test("V12 AI tools include 13 read tools and 7 write tools", () => {
  const toolNames = assistantTools.map((t) => (t as { name: string }).name);

  const readTools = [
    "get_team_overview",
    "get_next_team_action",
    "list_people",
    "get_person",
    "get_person_workload",
    "get_delegations",
    "get_waiting_on_team",
    "get_waiting_on_me",
    "get_ownership_gaps",
    "get_team_capacity",
    "get_team_risks",
    "get_team_review",
    "prepare_one_on_one",
  ];

  const writeTools = [
    "create_person",
    "create_delegation",
    "create_responsibility",
    "create_commitment",
    "create_escalation",
    "link_person_to_entity",
    "create_one_on_one_note",
  ];

  for (const name of readTools) {
    assert.ok(toolNames.includes(name), `Assistant read tool missing: ${name}`);
  }

  for (const name of writeTools) {
    assert.ok(toolNames.includes(name), `Assistant write tool missing: ${name}`);
  }
});

test("V12 notifications include emitTeamNotifications", () => {
  assert.equal(typeof emitTeamNotifications, "function");
});

test("V12 App Shell includes /team navigation item", async () => {
  const appShellPath = path.join(BASE_DIR, "src/components/app-shell.tsx");
  const content = await readFile(appShellPath, "utf-8");
  assert.ok(content.includes('"/team"'), "App shell should have /team href");
  assert.ok(content.includes('"Team"'), "App shell should have Team label");
});

test("V12 Command Palette includes Team commands and entity routing", async () => {
  const palettePath = path.join(BASE_DIR, "src/components/command-palette.tsx");
  const content = await readFile(palettePath, "utf-8");
  assert.ok(content.includes('"Open Team"'), "Command palette missing 'Open Team'");
  assert.ok(content.includes('"Open Delegations"'), "Command palette missing 'Open Delegations'");
  assert.ok(content.includes('"team_person"'), "Command palette missing team_person routing");
  assert.ok(content.includes('"team_delegation"'), "Command palette missing team_delegation routing");
});

test("V12 Today surface includes teamSignals", async () => {
  const todayPath = path.join(BASE_DIR, "src/app/api/today/route.ts");
  const content = await readFile(todayPath, "utf-8");
  assert.ok(content.includes("teamSignals"), "Today route missing teamSignals");
  assert.ok(content.includes("team_delegations"), "Today route should query team_delegations");
});

test("V12 Weekly Review includes team overview and delegation stats", async () => {
  const weeklyPath = path.join(BASE_DIR, "src/app/api/intelligence/review/weekly/route.ts");
  const content = await readFile(weeklyPath, "utf-8");
  assert.ok(content.includes("team"), "Weekly review route should have team section");
  assert.ok(content.includes("team_delegations"), "Weekly review should query team_delegations");
});
