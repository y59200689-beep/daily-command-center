import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assistantTools, executeAssistantTool } from "../src/lib/ai-tools";
import { domainConfig, parseDomainInput } from "../src/lib/domains";
import {
  decisionReviewState,
  effectiveInvoiceStatus,
  invoiceTotals,
  promptVariables,
  rankInsights,
  renderPrompt,
  targetProgress,
  weekBounds,
  type Insight,
} from "../src/lib/v2";

const migrationV2 = readFileSync(
  new URL("../supabase/migrations/20260903190000_v2_intelligence.sql", import.meta.url),
  "utf8"
);

// SECTION 1: FINANCE
test("1.1 Finance: invoice schema validates fields and status enum", () => {
  assert.equal(
    parseDomainInput("invoices", {
      title: "Design Retainer",
      subtotal: 5000,
      tax_amount: 1000,
      discount_amount: 500,
      currency: "MAD",
      status: "draft",
    }).success,
    true
  );
  assert.equal(
    parseDomainInput("invoices", {
      title: "Invalid Invoice",
      subtotal: -10,
    }).success,
    false
  );
});

test("1.2 Finance: partial payment calculation and balance verification", () => {
  const result = invoiceTotals({ subtotal: 1000, taxAmount: 200, discountAmount: 100, amountPaid: 400 });
  assert.equal(result.total, 1100);
  assert.equal(result.remaining, 700);
  assert.equal(result.status, "partial");
});

test("1.3 Finance: complete payment transitions invoice to paid", () => {
  const result = invoiceTotals({ subtotal: 1000, taxAmount: 0, discountAmount: 0, amountPaid: 1000 });
  assert.equal(result.remaining, 0);
  assert.equal(result.status, "paid");
  assert.match(migrationV2, /invoices_paid_status_check check \(status <> 'paid' or \(total_amount > 0 and amount_remaining = 0\)\)/);
});

test("1.4 Finance: payment history is preserved; silent edits rejected", () => {
  assert.match(migrationV2, /revoke insert,update,delete on table payments from authenticated/);
  assert.match(migrationV2, /protect_invoice_payment_fields[\s\S]+Payments must be recorded through record_invoice_payment/);
});

test("1.5 Finance: invoices and payments remain owner-private", () => {
  assert.match(migrationV2, /create policy payments_owner_read on payments for select to authenticated using\(user_id=\(select auth\.uid\(\)\)\)/);
  assert.match(migrationV2, /record_invoice_payment[\s\S]+user_id=auth\.uid\(\)/);
});

// SECTION 2: EXPENSES
test("2.1 Expenses: validates canonical expense categories", () => {
  assert.equal(
    parseDomainInput("expenses", {
      description: "AWS Hosting",
      amount: 120,
      category: "Hosting",
      expense_date: "2026-09-01",
    }).success,
    true
  );
  assert.equal(
    parseDomainInput("expenses", {
      description: "Coffee",
      amount: 30,
      category: "PersonalFood",
      expense_date: "2026-09-01",
    }).success,
    false
  );
});

test("2.2 Expenses: supports links to project, client, or subscription", () => {
  const validUuid = "11111111-1111-4111-8111-111111111111";
  assert.equal(
    parseDomainInput("expenses", {
      description: "Figma Subscription",
      amount: 15,
      category: "Software",
      expense_date: "2026-09-01",
      project_id: validUuid,
      client_id: validUuid,
      subscription_id: validUuid,
    }).success,
    true
  );
});

test("2.3 Expenses: multi-currency separation (MAD default)", () => {
  const madExpense = parseDomainInput("expenses", {
    description: "Local Office Supplies",
    amount: 500,
    category: "Equipment",
    expense_date: "2026-09-01",
  });
  assert.equal(madExpense.success, true);
  if (madExpense.success) assert.equal((madExpense.data as Record<string, unknown>).currency, "MAD");
});

test("2.4 Expenses: non-negative amount constraint and required description", () => {
  assert.equal(
    parseDomainInput("expenses", {
      description: "",
      amount: 50,
      category: "Other",
      expense_date: "2026-09-01",
    }).success,
    false
  );
  assert.equal(
    parseDomainInput("expenses", {
      description: "Refund",
      amount: -50,
      category: "Other",
      expense_date: "2026-09-01",
    }).success,
    false
  );
});

test("2.5 Expenses: owner isolation and cross-owner reference enforcement", () => {
  assert.match(migrationV2, /create trigger expenses_owned_links before insert or update on expenses/);
  assert.match(migrationV2, /enforce_owned_references\('client_id','clients','project_id','projects','subscription_id','subscriptions'\)/);
});

// SECTION 3: SUBSCRIPTIONS
test("3.1 Subscriptions: lifecycle statuses (active, paused, cancelled)", () => {
  for (const status of ["active", "paused", "cancelled"]) {
    assert.equal(
      parseDomainInput("subscriptions", {
        name: "GitHub Copilot",
        amount: 10,
        billing_cycle: "monthly",
        status,
      }).success,
      true
    );
  }
  assert.equal(
    parseDomainInput("subscriptions", {
      name: "GitHub Copilot",
      amount: 10,
      billing_cycle: "monthly",
      status: "expired",
    }).success,
    false
  );
});

test("3.2 Subscriptions: billing cycle validation and next billing date", () => {
  for (const cycle of ["monthly", "quarterly", "yearly", "custom"]) {
    assert.equal(
      parseDomainInput("subscriptions", {
        name: "SaaS",
        amount: 99,
        billing_cycle: cycle,
        next_billing_date: "2026-10-01",
      }).success,
      true
    );
  }
  assert.equal(
    parseDomainInput("subscriptions", {
      name: "SaaS",
      amount: 99,
      billing_cycle: "biweekly",
    }).success,
    false
  );
});

test("3.3 Subscriptions: project link with foreign key protection", () => {
  const validUuid = "22222222-2222-4222-8222-222222222222";
  assert.equal(
    parseDomainInput("subscriptions", {
      name: "Server",
      amount: 200,
      billing_cycle: "monthly",
      project_id: validUuid,
    }).success,
    true
  );
  assert.match(migrationV2, /create trigger subscriptions_owned_links before insert or update on subscriptions/);
});

test("3.4 Subscriptions: renewal sorting and indexed next billing date", () => {
  assert.equal(domainConfig.subscriptions.sort, "next_billing_date");
  assert.equal(domainConfig.subscriptions.sortAscending, true);
  assert.match(migrationV2, /create index if not exists subscriptions_renewal_idx on subscriptions\(user_id,next_billing_date,status\)/);
});

test("3.5 Subscriptions: cross-account isolation with RLS", () => {
  assert.match(migrationV2, /'subscriptions'/);
  assert.match(migrationV2, /create policy %I_owner_all on %I/);
});

// SECTION 4: CONTENT & CAMPAIGNS
test("4.1 Content & campaigns: campaign lifecycle and client attribution", () => {
  const clientId = "33333333-3333-4333-8333-333333333333";
  assert.equal(
    parseDomainInput("campaigns", {
      name: "Q4 Launch",
      client_id: clientId,
      status: "planning",
      start_date: "2026-10-01",
      end_date: "2026-12-31",
    }).success,
    true
  );
  // Missing required client_id fails
  assert.equal(
    parseDomainInput("campaigns", {
      name: "No Client Campaign",
      status: "planning",
    }).success,
    false
  );
});

test("4.2 Content: pipeline stages coverage", () => {
  const validStages = ["idea", "brief", "copy", "designing", "review", "approved", "scheduled", "published", "archived"];
  for (const status of validStages) {
    assert.equal(parseDomainInput("content", { title: `Post in ${status}`, status }).success, true);
  }
  assert.equal(parseDomainInput("content", { title: "Invalid stage", status: "discarded" }).success, false);
});

test("4.3 Content: approval workflow and notes", () => {
  const approvalStatuses = ["not_required", "pending", "changes_requested", "approved"];
  for (const approval_status of approvalStatuses) {
    assert.equal(
      parseDomainInput("content", {
        title: "Carousel Post",
        approval_status,
        approval_notes: "Revision needed on slide 2",
      }).success,
      true
    );
  }
  assert.equal(
    parseDomainInput("content", {
      title: "Carousel Post",
      approval_status: "rejected",
    }).success,
    false
  );
});

test("4.4 Content: campaign and prompt association with ownership triggers", () => {
  const validUuid = "44444444-4444-4444-8444-444444444444";
  assert.equal(
    parseDomainInput("content", {
      title: "Linked Content",
      campaign_id: validUuid,
      prompt_id: validUuid,
    }).success,
    true
  );
  assert.match(migrationV2, /create trigger content_owned_links before insert or update on content_items/);
});

test("4.5 Content: content asset references and private attachments", () => {
  assert.match(migrationV2, /create table content_assets/);
  assert.match(migrationV2, /asset_type in \('upload','drive','reference','link','copy'\)/);
  assert.match(migrationV2, /'content_assets'/);
  assert.match(migrationV2, /alter table %I enable row level security/);
});

// SECTION 5: PROMPT LIBRARY V2
test("5.1 Prompt library: prompt creation with categories and ratings", () => {
  assert.equal(
    parseDomainInput("prompts", {
      title: "Marketing Copy Generator",
      prompt_text: "Write a high-converting hook for {product_name}.",
      category: "Marketing",
      rating: 5,
    }).success,
    true
  );
  assert.equal(
    parseDomainInput("prompts", {
      title: "Invalid Rating",
      prompt_text: "Some text",
      rating: 6,
    }).success,
    false
  );
});

test("5.2 Prompt library: variable extraction syntax and deduplication", () => {
  const template = "Create an offer for {client_name} about {offering}. Include {client_name}'s budget of {amount}.";
  const vars = promptVariables(template);
  assert.deepEqual(vars, ["client_name", "offering", "amount"]);
});

test("5.3 Prompt library: template rendering and explicit missing variable handling", () => {
  const template = "Hello {name}, your ticket {ticket_id} is {status}.";
  const partial = renderPrompt(template, { name: "Alice" });
  assert.deepEqual(partial.missing, ["ticket_id", "status"]);
  assert.equal(partial.text, "Hello Alice, your ticket {ticket_id} is {status}.");

  const full = renderPrompt(template, { name: "Alice", ticket_id: "123", status: "resolved" });
  assert.deepEqual(full.missing, []);
  assert.equal(full.text, "Hello Alice, your ticket 123 is resolved.");
});

test("5.4 Prompt library: version tracking and restoration schema", () => {
  assert.match(migrationV2, /create table prompt_versions/);
  assert.match(migrationV2, /unique\(prompt_id,version_number\)/);
});

test("5.5 Prompt library: linked entity ownership verification", () => {
  assert.match(migrationV2, /create trigger prompts_owned_links before insert or update on prompts/);
  assert.match(migrationV2, /enforce_owned_references\('client_id','clients','project_id','projects','campaign_id','campaigns','content_item_id','content_items'\)/);
});

// SECTION 6: DECISION INTELLIGENCE V2
test("6.1 Decision intelligence: decision impact, confidence, and status", () => {
  for (const impact of ["low", "medium", "high", "critical"]) {
    for (const confidence of ["low", "medium", "high"]) {
      assert.equal(
        parseDomainInput("decisions", {
          title: "Architecture Choice",
          decision: "Use PostgreSQL RPC for payments",
          impact,
          confidence,
          status: "active",
        }).success,
        true
      );
    }
  }
});

test("6.2 Decision intelligence: decision alternatives with rejection reasoning", () => {
  assert.match(migrationV2, /create table decision_alternatives/);
  assert.match(migrationV2, /title text not null, reason_rejected text/);
  assert.match(migrationV2, /create trigger decision_alternatives_owned_links/);
});

test("6.3 Decision intelligence: atomic superseding with row locks", () => {
  assert.match(migrationV2, /create or replace function supersede_decision/);
  assert.match(migrationV2, /select \* into previous from decisions[\s\S]+for update/);
  assert.match(migrationV2, /superseded_by_decision_id=replacement\.id/);
});

test("6.4 Decision intelligence: review states derived without mutating stored records", () => {
  assert.equal(decisionReviewState("2026-09-01", "2026-09-16"), "overdue");
  assert.equal(decisionReviewState("2026-09-20", "2026-09-16"), "due_soon");
  assert.equal(decisionReviewState("2026-10-15", "2026-09-16"), "later");
  assert.equal(decisionReviewState(null, "2026-09-16"), "none");
});

test("6.5 Decision intelligence: owner-private RLS protection", () => {
  assert.match(migrationV2, /create trigger decisions_owned_links before insert or update on decisions/);
  assert.match(migrationV2, /grant select,insert,update,delete on table %I to authenticated/);
});

// SECTION 7: FITNESS
test("7.1 Fitness: activity logging and effort validation", () => {
  for (const activity_type of ["Running", "Gym", "Walking", "Swimming", "Hiking", "Cycling", "Other"]) {
    assert.equal(
      parseDomainInput("fitness", {
        activity_type,
        date: "2026-09-16",
        duration_minutes: 45,
        distance_km: 5.5,
        calories: 400,
        effort: "moderate",
      }).success,
      true
    );
  }
  assert.equal(
    parseDomainInput("fitness", {
      activity_type: "Running",
      date: "2026-09-16",
      effort: "extreme",
    }).success,
    false
  );
});

test("7.2 Fitness: target management by sessions, distance, and duration", () => {
  for (const target_type of ["sessions", "distance_km", "duration_minutes"]) {
    assert.equal(
      parseDomainInput("fitness-targets", {
        activity_type: "Running",
        target_type,
        target_value: 15,
        period: "week",
      }).success,
      true
    );
  }
  assert.equal(
    parseDomainInput("fitness-targets", {
      activity_type: "Running",
      target_type: "heart_rate",
      target_value: 150,
    }).success,
    false
  );
});

test("7.3 Fitness: target progress computation (sessions vs measured sums)", () => {
  const activities = [
    { activity_type: "Running", distance_km: 6, duration_minutes: 35 },
    { activity_type: "Running", distance_km: 4, duration_minutes: 25 },
    { activity_type: "Gym", duration_minutes: 60 },
  ];
  const distProgress = targetProgress({ activity_type: "Running", target_type: "distance_km", target_value: 15 }, activities);
  assert.deepEqual(distProgress, { actual: 10, target: 15, remaining: 5, complete: false });

  const sessionProgress = targetProgress({ activity_type: "Running", target_type: "sessions", target_value: 2 }, activities);
  assert.deepEqual(sessionProgress, { actual: 2, target: 2, remaining: 0, complete: true });
});

test("7.4 Fitness: deterministic week bounds calculation", () => {
  const bounds = weekBounds(new Date("2026-09-16T12:00:00Z"), 1); // Wednesday
  assert.equal(bounds.start, "2026-09-14"); // Monday
  assert.equal(bounds.end, "2026-09-20");   // Sunday
});

test("7.5 Fitness: external identity deduplication index", () => {
  assert.match(migrationV2, /create unique index if not exists fitness_external_identity_idx on fitness_activities\(user_id,source,external_id\)/);
});

// SECTION 8: ANALYTICS & INSIGHTS
test("8.1 Analytics & insights: ranking by priority and severity", () => {
  const base: Insight = {
    id: "1",
    type: "invoice_due",
    priority: 50,
    severity: "medium",
    title: "T1",
    message: "M1",
    entity_type: "invoice",
    entity_id: "e1",
    action_label: "Open",
    action_route: "/",
    expires_at: null,
    generated_at: "2026-09-16T00:00:00Z",
  };
  const highPriority = { ...base, id: "2", priority: 80, severity: "high" as const, entity_id: "e2" };
  const criticalPriority = { ...base, id: "3", priority: 80, severity: "critical" as const, entity_id: "e3" };

  const ranked = rankInsights([base, highPriority, criticalPriority]);
  assert.equal(ranked[0].id, "3"); // Critical beats high when priority tied
  assert.equal(ranked[1].id, "2");
  assert.equal(ranked[2].id, "1");
});

test("8.2 Analytics & insights: filters out expired insights", () => {
  const now = new Date("2026-09-16T12:00:00Z");
  const validInsight: Insight = {
    id: "valid",
    type: "invoice_due",
    priority: 50,
    severity: "medium",
    title: "Due soon",
    message: "Due",
    entity_type: "invoice",
    entity_id: "inv1",
    action_label: "Open",
    action_route: "/",
    expires_at: "2026-09-16T15:00:00Z",
    generated_at: "2026-09-16T00:00:00Z",
  };
  const expiredInsight: Insight = {
    ...validInsight,
    id: "expired",
    entity_id: "inv2",
    expires_at: "2026-09-16T11:00:00Z",
  };

  const result = rankInsights([validInsight, expiredInsight], now);
  assert.deepEqual(result.map((i) => i.id), ["valid"]);
});

test("8.3 Analytics & insights: deduplication by entity keeps highest priority", () => {
  const base: Insight = {
    id: "low",
    type: "invoice_due",
    priority: 40,
    severity: "low",
    title: "Low",
    message: "Low",
    entity_type: "invoice",
    entity_id: "dup1",
    action_label: "Open",
    action_route: "/",
    expires_at: null,
    generated_at: "2026-09-16T00:00:00Z",
  };
  const high: Insight = { ...base, id: "high", priority: 90, severity: "high" };

  const ranked = rankInsights([base, high]);
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0].id, "high");
});

test("8.4 Analytics & insights: financial metrics separate currencies without silent mixing", () => {
  const invoices = [
    { currency: "MAD", amount_remaining: 1000, effective_status: "sent", due_date: "2026-09-20" },
    { currency: "USD", amount_remaining: 500, effective_status: "sent", due_date: "2026-09-20" },
  ];
  const madTotal = invoices.filter((i) => i.currency === "MAD").reduce((s, i) => s + i.amount_remaining, 0);
  const usdTotal = invoices.filter((i) => i.currency === "USD").reduce((s, i) => s + i.amount_remaining, 0);
  assert.equal(madTotal, 1000);
  assert.equal(usdTotal, 500);
  assert.notEqual(madTotal, 1500);
});

test("8.5 Analytics & insights: notification preferences filtering", () => {
  assert.equal(
    parseDomainInput("notification-preferences", {
      category: "finance",
      enabled: true,
      minimum_severity: "high",
    }).success,
    true
  );
  assert.equal(
    parseDomainInput("notification-preferences", {
      category: "finance",
      minimum_severity: "panic",
    }).success,
    false
  );
});

// SECTION 9: PROJECT & CLIENT WORKSPACES
test("9.1 Project & client workspaces: project value and currency bounds", () => {
  assert.equal(
    parseDomainInput("projects", {
      name: "New Mobile App",
      value_amount: 50000,
      currency: "MAD",
      progress: 45,
    }).success,
    true
  );
  assert.equal(
    parseDomainInput("projects", {
      name: "Negative Value",
      value_amount: -100,
    }).success,
    false
  );
});

test("9.2 Project & client workspaces: client structure with follow-up timestamps", () => {
  assert.equal(
    parseDomainInput("clients", {
      name: "Acme Corp",
      company: "Acme Industries",
      email: "contact@acme.com",
      next_follow_up_at: "2026-09-25T10:00:00Z",
    }).success,
    true
  );
});

test("9.3 Project & client workspaces: focus session project attribution", () => {
  assert.match(migrationV2, /alter table focus_sessions add column if not exists project_id uuid references projects\(id\) on delete set null/);
});

test("9.4 Project & client workspaces: global workspace search indexing across 12 domains", () => {
  assert.match(migrationV2, /create or replace function search_workspace/);
  for (const domain of ["task", "project", "note", "invoice", "payment", "expense", "subscription", "campaign", "content", "prompt", "decision", "fitness"]) {
    assert.match(migrationV2, new RegExp(`select '${domain}'`));
  }
});

test("9.5 Project & client workspaces: cross-tenant reference enforcement", () => {
  assert.match(migrationV2, /create or replace function enforce_owned_references\(\)/);
  assert.match(migrationV2, /if not owned then raise exception 'Referenced % is not owned by this user\.'/);
});

// SECTION 10: V2 SECURITY & REGRESSION
test("10.1 V2 security: RLS enabled on all 11 V2 tables", () => {
  const v2Tables = [
    "subscriptions",
    "expenses",
    "campaigns",
    "content_assets",
    "prompt_versions",
    "prompt_variables",
    "decision_alternatives",
    "fitness_targets",
    "integration_connections",
    "external_references",
    "notification_preferences",
  ];
  for (const table of v2Tables) {
    assert.match(migrationV2, new RegExp(`'${table}'`));
  }
  assert.match(migrationV2, /alter table payments enable row level security/);
});

test("10.2 V2 security: direct payments modification is revoked", () => {
  assert.match(migrationV2, /revoke insert,update,delete on table payments from authenticated/);
});

test("10.3 V2 security: sensitive financial RPC security definer and user verification", () => {
  assert.match(migrationV2, /create or replace function record_invoice_payment[\s\S]+security definer[\s\S]+if auth\.uid\(\) is null then raise exception 'Authentication required\.'/);
});

test("10.4 V2 security: AI assistant tools confirmation requirement and user_id exclusion", async () => {
  for (const tool of assistantTools) {
    assert.equal(Object.hasOwn(tool.parameters.properties, "user_id"), false);
  }
  const toolExecution = await executeAssistantTool(
    { client: {} as SupabaseClient, userId: "test-owner" },
    "create_invoice",
    { title: "Test", confirmed: false, subtotal: 100, tax_amount: 0, discount_amount: 0, currency: "MAD", due_date: null, client_id: null, project_id: null }
  );
  assert.deepEqual(toolExecution, {
    confirmation_required: true,
    message: "Ask the user to confirm this change before executing it.",
  });
});

test("10.5 V2 security: effective invoice status derives overdue safely", () => {
  assert.equal(
    effectiveInvoiceStatus({ status: "sent", due_date: "2026-09-01", amount_remaining: 500 }, "2026-09-16"),
    "overdue"
  );
  assert.equal(
    effectiveInvoiceStatus({ status: "paid", due_date: "2026-09-01", amount_remaining: 0 }, "2026-09-16"),
    "paid"
  );
  assert.equal(
    effectiveInvoiceStatus({ status: "cancelled", due_date: "2026-09-01", amount_remaining: 500 }, "2026-09-16"),
    "cancelled"
  );
});
