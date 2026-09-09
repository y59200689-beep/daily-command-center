import assert from "node:assert/strict";
import test from "node:test";
import { readFile, access } from "node:fs/promises";
import path from "node:path";
import {
  evaluateAccountHealth,
  evaluateChurnRisk,
  evaluateDeliveryHealth,
  evaluateOnboardingHealth,
  evaluateExpansionReadiness,
  evaluateClientEngagement,
  rankNextCustomerSuccessAction,
  buildClientWaitingState,
  evaluateRenewalReadiness,
  buildRetentionReview,
  validateForeignOwnership,
  type ClientRecord,
  type ClientOutcome,
  type ClientRisk,
  type ClientRenewal,
  type ClientCommitment,
  type ClientSatisfactionSignal,
} from "../src/lib/success";
import { safeAutomationTypes } from "../src/lib/v4";
import { emitCustomerSuccessNotifications } from "../src/lib/notification-producers";
import { assistantTools } from "../src/lib/ai-tools";

const BASE_DIR = path.resolve(__dirname, "..");

// Sample test fixtures
const baseClient: ClientRecord = {
  id: "c-111",
  name: "Acme Corp",
  company: "Acme Industries",
  status: "active",
  created_at: "2026-01-01T00:00:00Z",
};

// ============================================================
// 1. evaluateAccountHealth Tests
// ============================================================

test("V13 evaluateAccountHealth detects critical state when critical risk exists", () => {
  const risks: ClientRisk[] = [
    {
      id: "r-1",
      client_id: "c-111",
      risk_type: "delivery_delay",
      severity: "critical",
      status: "open",
      description: "Major milestone 3 weeks delayed",
      created_at: "2026-09-01T00:00:00Z",
    },
  ];
  const result = evaluateAccountHealth(baseClient, [], risks, [], [], [], [], [], []);
  assert.equal(result.state, "critical");
  assert.ok(result.negativeReasons.some((r) => r.toLowerCase().includes("critical")));
});

test("V13 evaluateAccountHealth returns healthy when outcomes are on track and no blockers", () => {
  const outcomes: ClientOutcome[] = [
    {
      id: "o-1",
      client_id: "c-111",
      title: "Launch v2 App",
      status: "in_progress",
      priority: "high",
      target_date: "2026-10-01",
      created_at: "2026-08-01T00:00:00Z",
    },
  ];
  const signals: ClientSatisfactionSignal[] = [
    {
      id: "s-1",
      client_id: "c-111",
      signal_type: "praise",
      source: "email",
      summary: "Executive loved the demo",
      recorded_at: "2026-09-05T00:00:00Z",
    },
  ];
  const result = evaluateAccountHealth(baseClient, outcomes, [], [], [], [], [], [], signals);
  assert.equal(result.state, "healthy");
  assert.ok(result.positiveReasons.length > 0);
});

test("V13 evaluateAccountHealth returns insufficient_data when client has zero success records", () => {
  const result = evaluateAccountHealth(baseClient, [], [], [], [], [], [], [], []);
  assert.equal(result.state, "insufficient_data");
});

// ============================================================
// 2. evaluateChurnRisk Tests
// ============================================================

test("V13 evaluateChurnRisk returns elevated or high churn risk on negative signals and open risks", () => {
  const risks: ClientRisk[] = [
    {
      id: "r-2",
      client_id: "c-111",
      risk_type: "renewal_risk",
      severity: "critical",
      status: "open",
      description: "Leadership restructuring",
      created_at: "2026-09-02T00:00:00Z",
    },
  ];
  const signals: ClientSatisfactionSignal[] = [
    {
      id: "s-2",
      client_id: "c-111",
      signal_type: "complaint",
      source: "call",
      summary: "VP escalated unmet expectations",
      recorded_at: "2026-09-08T00:00:00Z",
    },
  ];
  const result = evaluateChurnRisk(baseClient, "critical", risks, [], [], signals);
  assert.ok(result.state === "high" || result.state === "elevated");
  assert.ok(result.reasons.length > 0);
});

test("V13 evaluateChurnRisk returns low risk when account is healthy with positive feedback", () => {
  const signals: ClientSatisfactionSignal[] = [
    {
      id: "s-3",
      client_id: "c-111",
      signal_type: "positive_feedback",
      source: "survey",
      summary: "High satisfaction score",
      recorded_at: "2026-09-07T00:00:00Z",
    },
  ];
  const result = evaluateChurnRisk(baseClient, "healthy", [], [], [], signals);
  assert.equal(result.state, "low");
});

// ============================================================
// 3. evaluateDeliveryHealth & evaluateOnboardingHealth
// ============================================================

test("V13 evaluateDeliveryHealth detects blocked state when blocked project exists", () => {
  const projects = [{ id: "p-1", status: "blocked" }];
  const result = evaluateDeliveryHealth(projects, [], [], []);
  assert.equal(result.state, "blocked");
  assert.ok(result.reasons.some((r) => r.toLowerCase().includes("blocked")));
});

test("V13 evaluateOnboardingHealth detects waiting_on_us when team has pending setup commitments", () => {
  const commitments: ClientCommitment[] = [
    {
      id: "c-setup",
      client_id: "c-111",
      direction: "we_owe_client",
      statement: "Provision environment",
      status: "open",
    },
  ];
  const result = evaluateOnboardingHealth([], commitments, []);
  assert.equal(result.state, "waiting_on_us");
  assert.ok(result.reasons.length > 0);
});

// ============================================================
// 4. evaluateExpansionReadiness & evaluateClientEngagement
// ============================================================

test("V13 evaluateExpansionReadiness identifies ready state with healthy account and achieved outcomes", () => {
  const outcomes: ClientOutcome[] = [
    {
      id: "o-2",
      client_id: "c-111",
      title: "Exceeded pipeline target",
      status: "achieved",
      priority: "high",
      target_date: "2026-09-01",
      completed_at: "2026-09-01T00:00:00Z",
      created_at: "2026-08-01T00:00:00Z",
    },
  ];
  const result = evaluateExpansionReadiness("healthy", outcomes, "on_track");
  assert.equal(result.state, "ready");
  assert.ok(result.reasons.some((r) => r.toLowerCase().includes("achieved")));
});

test("V13 evaluateClientEngagement identifies active engagement", () => {
  const result = evaluateClientEngagement("2026-09-08T00:00:00Z", "standard", 4, "2026-09-09T00:00:00Z");
  assert.equal(result.state, "active");
});

// ============================================================
// 5. rankNextCustomerSuccessAction & buildClientWaitingState
// ============================================================

test("V13 rankNextCustomerSuccessAction prioritizes critical risks over routine renewals", () => {
  const risks: ClientRisk[] = [
    {
      id: "r-99",
      client_id: "c-111",
      risk_type: "stakeholder_issue",
      severity: "critical",
      status: "open",
      description: "Primary decision maker departed",
      created_at: "2026-09-08T00:00:00Z",
    },
  ];
  const nextAction = rankNextCustomerSuccessAction(
    [baseClient],
    [],
    risks,
    [],
    [],
    [],
    []
  );
  assert.ok(nextAction !== null);
  assert.equal(nextAction?.client_id, "c-111");
  assert.ok(typeof nextAction?.priority === "number" && nextAction.priority >= 90);
});

test("V13 buildClientWaitingState segregates waitingOnUs vs waitingOnClient", () => {
  const commitments: ClientCommitment[] = [
    {
      id: "comm-1",
      client_id: "c-111",
      direction: "we_owe_client",
      statement: "Send revised SLA agreement",
      status: "open",
      due_at: "2026-09-10T00:00:00Z",
    },
    {
      id: "comm-2",
      client_id: "c-111",
      direction: "client_owes_us",
      statement: "Provide production credentials",
      status: "open",
      due_at: "2026-09-12T00:00:00Z",
    },
  ];
  const waitingItems = [
    {
      id: "w-1",
      client_id: "c-111",
      title: "Client contract signature",
      status: "waiting",
      requested_at: "2026-09-01T00:00:00Z",
    },
  ];
  const { waitingOnUs, waitingOnClient } = buildClientWaitingState(
    [baseClient],
    commitments,
    [],
    waitingItems,
    []
  );
  assert.equal(waitingOnUs.length, 1);
  assert.equal(waitingOnUs[0].what, "Send revised SLA agreement");
  assert.equal(waitingOnClient.length, 2);
});

// ============================================================
// 6. evaluateRenewalReadiness & buildRetentionReview
// ============================================================

test("V13 evaluateRenewalReadiness detects urgent renewal window within 30 days", () => {
  const renewal: ClientRenewal = {
    id: "ren-1",
    client_id: "c-111",
    renewal_date: "2026-09-20",
    renewal_type: "subscription",
    forecast_category: "likely",
    preparation_state: "not_started",
    currency: "USD",
    status: "upcoming",
  };
  const result = evaluateRenewalReadiness(renewal, "healthy", 2, "2026-09-09T00:00:00Z");
  assert.equal(result.isUrgent, true);
  assert.equal(result.needsPreparation, true);
  assert.ok(result.daysUntil <= 30);
});

test("V13 buildRetentionReview summarizes portfolio health counts and metrics", () => {
  const clients: ClientRecord[] = [
    baseClient,
    { id: "c-222", name: "Beta LLC", status: "active", created_at: "2026-01-01T00:00:00Z" },
  ];
  const renewals: ClientRenewal[] = [
    {
      id: "ren-2",
      client_id: "c-111",
      renewal_date: "2026-10-01",
      renewal_type: "retainer",
      forecast_category: "committed",
      preparation_state: "ready",
      currency: "USD",
      status: "upcoming",
    },
  ];
  const review = buildRetentionReview(clients, renewals, [], [], [], [], "week");
  assert.equal(review.metrics.totalClients, 2);
  assert.equal(review.metrics.upcomingRenewalsCount, 1);
});

// ============================================================
// 7. validateForeignOwnership Security Test
// ============================================================

test("V13 validateForeignOwnership rejects client owned by another user", async () => {
  const fakeClient = {
    from: () => ({
      select: () => ({
        eq: (_col: string, val: string) => ({
          eq: () => ({
            is: () => ({
              maybeSingle: async () => ({
                data: val === "c-999" ? null : { id: val, user_id: "u-other" },
                error: null,
              }),
            }),
          }),
        }),
      }),
    }),
  };

  const isValid = await validateForeignOwnership(
    fakeClient as never,
    "u-111",
    "client",
    "c-999"
  );
  assert.equal(isValid, false);
});

// ============================================================
// 8. Pending Database Migration Verification
// ============================================================

test("V13 migration file exists and defines 12 owner-scoped tables with RLS", async () => {
  const migrationFile = path.join(
    BASE_DIR,
    "supabase/migrations/20260909120000_v13_customer_success_retention_operating_system.sql"
  );
  await assert.doesNotReject(async () => {
    await access(migrationFile);
  }, "Migration file must exist in supabase/migrations/");

  const content = await readFile(migrationFile, "utf-8");

  const expectedTables = [
    "client_outcomes",
    "client_success_plans",
    "client_commitments",
    "client_check_ins",
    "client_satisfaction_signals",
    "client_risks",
    "client_renewals",
    "client_milestones",
    "client_issues",
    "client_account_reviews",
    "client_recovery_plans",
    "client_evidence_links",
  ];

  for (const table of expectedTables) {
    assert.ok(
      content.includes(`create table if not exists ${table}`),
      `Migration should create table ${table}`
    );
    assert.ok(
      content.includes(`'${table}'`),
      `Migration should include ${table} in RLS array`
    );
  }

  assert.ok(
    content.includes("auth.uid()"),
    "Migration policies must enforce auth.uid()"
  );
});

// ============================================================
// 9. API Routes Verification (All 24 Routes)
// ============================================================

test("V13 all 24 Customer Success API routes exist", async () => {
  const routePaths = [
    "src/app/api/success/overview/route.ts",
    "src/app/api/success/clients/[id]/route.ts",
    "src/app/api/success/outcomes/route.ts",
    "src/app/api/success/outcomes/[id]/route.ts",
    "src/app/api/success/plans/route.ts",
    "src/app/api/success/plans/[id]/route.ts",
    "src/app/api/success/commitments/route.ts",
    "src/app/api/success/commitments/[id]/route.ts",
    "src/app/api/success/waiting/route.ts",
    "src/app/api/success/check-ins/route.ts",
    "src/app/api/success/check-ins/[id]/route.ts",
    "src/app/api/success/signals/route.ts",
    "src/app/api/success/risks/route.ts",
    "src/app/api/success/risks/[id]/route.ts",
    "src/app/api/success/renewals/route.ts",
    "src/app/api/success/renewals/[id]/route.ts",
    "src/app/api/success/milestones/route.ts",
    "src/app/api/success/issues/route.ts",
    "src/app/api/success/issues/[id]/route.ts",
    "src/app/api/success/portfolio/route.ts",
    "src/app/api/success/reviews/route.ts",
    "src/app/api/success/recovery/route.ts",
    "src/app/api/success/recovery/[id]/route.ts",
    "src/app/api/success/journey/route.ts",
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

test("V13 all 8 workspace pages exist", async () => {
  const pagePaths = [
    "src/app/(workspace)/success/page.tsx",
    "src/app/(workspace)/success/clients/[id]/page.tsx",
    "src/app/(workspace)/success/portfolio/page.tsx",
    "src/app/(workspace)/success/journey/page.tsx",
    "src/app/(workspace)/success/risks/page.tsx",
    "src/app/(workspace)/success/renewals/page.tsx",
    "src/app/(workspace)/success/check-ins/page.tsx",
    "src/app/(workspace)/success/review/page.tsx",
  ];

  for (const relPath of pagePaths) {
    const fullPath = path.join(BASE_DIR, relPath);
    await assert.doesNotReject(async () => {
      await access(fullPath);
    }, `Page ${relPath} should exist`);
  }
});

test("V13 all 8 feature components exist", async () => {
  const componentPaths = [
    "src/features/success/success-home.tsx",
    "src/features/success/client-success-profile.tsx",
    "src/features/success/portfolio-health-view.tsx",
    "src/features/success/renewals-view.tsx",
    "src/features/success/client-risks-view.tsx",
    "src/features/success/retention-review-view.tsx",
    "src/features/success/check-ins-view.tsx",
    "src/features/success/waiting-view.tsx",
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

test("V13 automations include 8 customer success automation types", () => {
  const expectedAutomations = [
    "daily_client_success_review",
    "weekly_retention_review",
    "upcoming_renewal_check",
    "client_risk_audit",
    "unfulfilled_commitment_check",
    "stale_client_touchpoint_check",
    "critical_client_issue_alert",
    "client_waiting_state_review",
  ];

  for (const autoType of expectedAutomations) {
    assert.ok(
      safeAutomationTypes.includes(autoType as (typeof safeAutomationTypes)[number]),
      `safeAutomationTypes should include ${autoType}`
    );
  }
});

test("V13 AI tools include 13 read tools and 8 write tools", () => {
  const toolNames = assistantTools.map((t) => (t as { name: string }).name);

  const readTools = [
    "get_success_overview",
    "get_next_success_action",
    "get_client_success_profile",
    "list_client_outcomes",
    "get_client_outcome",
    "list_client_success_plans",
    "get_client_success_plan",
    "list_client_commitments",
    "get_client_waiting_state",
    "list_client_check_ins",
    "list_client_risks",
    "list_client_renewals",
    "get_retention_review",
  ];

  const writeTools = [
    "create_client_outcome",
    "update_client_outcome",
    "create_client_success_plan",
    "create_client_commitment",
    "create_client_check_in",
    "record_client_satisfaction_signal",
    "create_client_risk",
    "create_client_renewal",
  ];

  for (const name of readTools) {
    assert.ok(toolNames.includes(name), `Assistant read tool missing: ${name}`);
  }

  for (const name of writeTools) {
    assert.ok(toolNames.includes(name), `Assistant write tool missing: ${name}`);
  }
});

test("V13 notifications include emitCustomerSuccessNotifications", () => {
  assert.equal(typeof emitCustomerSuccessNotifications, "function");
});

test("V13 App Shell includes /success navigation item", async () => {
  const appShellPath = path.join(BASE_DIR, "src/components/app-shell.tsx");
  const content = await readFile(appShellPath, "utf-8");
  assert.ok(content.includes('"/success"'), "App shell should have /success href");
  assert.ok(content.includes('"Success"'), "App shell should have Success label");
});

test("V13 Command Palette includes Customer Success commands and entity routing", async () => {
  const palettePath = path.join(BASE_DIR, "src/components/command-palette.tsx");
  const content = await readFile(palettePath, "utf-8");
  assert.ok(content.includes('"Open Customer Success"'), "Command palette missing 'Open Customer Success'");
  assert.ok(content.includes('"Open Portfolio Health"'), "Command palette missing 'Open Portfolio Health'");
  assert.ok(content.includes('"client_outcome"'), "Command palette missing client_outcome routing");
  assert.ok(content.includes('"client_renewal"'), "Command palette missing client_renewal routing");
});

test("V13 Today surface includes customerSuccessSignals", async () => {
  const todayPath = path.join(BASE_DIR, "src/app/api/today/route.ts");
  const content = await readFile(todayPath, "utf-8");
  assert.ok(content.includes("customerSuccessSignals"), "Today route missing customerSuccessSignals");
  assert.ok(content.includes("client_risks"), "Today route should query client_risks");
});

test("V13 Weekly Review includes customer success and retention section", async () => {
  const weeklyPath = path.join(BASE_DIR, "src/app/api/intelligence/review/weekly/route.ts");
  const content = await readFile(weeklyPath, "utf-8");
  assert.ok(content.includes("withSuccessReview"), "Weekly review route should have withSuccessReview");
  assert.ok(content.includes("client_renewals"), "Weekly review should query client_renewals");
});
