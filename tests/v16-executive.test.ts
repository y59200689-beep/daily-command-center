import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  evaluateMateriality,
  detectExecutiveChanges,
  rankExecutivePriorities,
  clusterExecutiveRisks,
  clusterExecutiveOpportunities,
  evaluateDecisionReadiness,
  evaluateDecisionImpact,
  evaluateDecisionUrgency,
  buildCanWaitList,
  buildDelegationCandidates,
  buildPlanVsReality,
  detectMetricChange,
  buildExecutiveBrief,
  type ExecutiveSignal,
} from '../src/lib/executive';
import {
  executiveAssistantTools,
  executiveReadNames,
  executiveWrites,
  executeExecutiveTool,
} from '../src/lib/executive-ai';
import { notificationRoute } from '../src/lib/v4-notifications';

const today = '2026-09-09';
const mockId = '11111111-1111-4111-8111-111111111111';

const createSignal = (overrides: Partial<ExecutiveSignal> = {}): ExecutiveSignal => ({
  id: 'sig-1',
  domain: 'finance',
  type: 'runway_alert',
  severity: 'critical',
  title: 'Low Cash Runway',
  reason: 'Operating cash runway has fallen below 2 months',
  evidence: 'Current runway: 1.8 months based on 90-day net burn',
  entities: [{ type: 'company', id: mockId, name: 'Main Co' }],
  createdAt: today,
  route: '/financial-control',
  moneyAmount: 50000,
  currency: 'MAD',
  deadline: today,
  ...overrides,
});

test('V16 Materiality evaluation assigns appropriate weight based on severity, amount, and deadline', () => {
  const critSignal = createSignal({ severity: 'critical', moneyAmount: 30000 });
  const matCrit = evaluateMateriality(critSignal);
  assert.equal(matCrit.materiality, 'critical');
  assert.ok(matCrit.reasons.length > 0);

  const infoSignal = createSignal({ severity: 'info', moneyAmount: 0, entities: [] });
  const matInfo = evaluateMateriality(infoSignal);
  assert.equal(matInfo.materiality, 'minor');
});

test('V16 Change detection identifies new signals against prior snapshot', () => {
  const signal = createSignal({ id: 'sig-new', title: 'New Customer Risk' });
  const priorSnapshot = {
    risk_states: [{ key: 'sig-old', severity: 'important', state: 'active' }],
  };

  const changes = detectExecutiveChanges([signal], priorSnapshot);
  assert.ok(changes.length >= 1);
  const newChange = changes.find((c) => c.id === 'change-sig-new');
  assert.ok(newChange);
  assert.equal(newChange?.type, 'new');
  assert.equal(newChange?.currentState, 'critical');
});

test('V16 Change detection identifies resolved signals from prior snapshot', () => {
  const priorSnapshot = {
    risk_states: [{ key: 'sig-resolved', severity: 'critical', state: 'active' }],
  };

  // No active signals passed -> previous signal should be flagged as resolved
  const changes = detectExecutiveChanges([], priorSnapshot);
  const resolved = changes.find((c) => c.id === 'change-resolved-sig-resolved');
  assert.ok(resolved);
  assert.equal(resolved?.type, 'resolved');
  assert.equal(resolved?.currentState, 'resolved');
});

test('V16 Metric change detector calculates delta and flags worsening state on downward runway', () => {
  const current = { cash_runway_months: 1.5, overdue_invoices_count: 5 };
  const prev = { cash_runway_months: 3.2, overdue_invoices_count: 2 };

  const diffs = detectMetricChange(current, prev);
  assert.ok(diffs.length >= 2);
  const runwayDiff = diffs.find((d) => d.name === 'cash runway months');
  assert.ok(runwayDiff);
  assert.equal(runwayDiff?.state, 'worsening');
  assert.ok(runwayDiff?.delta && runwayDiff.delta < 0);
});

test('V16 Priority ranking scores urgency, impact, and excludes dismissed signals', () => {
  const critSignal = createSignal({ id: 'sig-crit', severity: 'critical', domain: 'finance' });
  const infoSignal = createSignal({ id: 'sig-info', severity: 'info', domain: 'life', title: 'Routine renewal', moneyAmount: 0 });
  const dismissedSignal = createSignal({ id: 'sig-dismissed', severity: 'critical', title: 'Snoozed alert' });

  const dismissedKeys = new Set(['sig-dismissed']);
  const priorities = rankExecutivePriorities([critSignal, infoSignal, dismissedSignal], dismissedKeys);

  assert.equal(priorities.some((p) => p.id === 'sig-dismissed'), false);
  assert.ok(priorities.length >= 2);
  assert.equal(priorities[0].id, 'sig-crit');
  assert.ok(priorities[0].score > priorities[1].score);
  assert.ok(priorities[0].why.length > 0);
});

test('V16 Risk clustering combines multi-domain signals for the same entity', () => {
  const clientEntity = { type: 'client', id: 'client-99', name: 'Acme Corp' };
  const signal1 = createSignal({
    id: 'sig-cs-1',
    domain: 'success',
    title: 'Customer churn risk flagged',
    entities: [clientEntity],
  });
  const signal2 = createSignal({
    id: 'sig-fin-1',
    domain: 'finance',
    title: 'Client receivable 60 days overdue',
    entities: [clientEntity],
  });

  const clusters = clusterExecutiveRisks([signal1, signal2]);
  assert.ok(clusters.length >= 1);
  const clientCluster = clusters.find((c) => c.entityId === 'client-99');
  assert.ok(clientCluster);
  assert.ok(clientCluster?.domains.includes('success'));
  assert.ok(clientCluster?.domains.includes('finance'));
  assert.ok(clientCluster?.recommendedAction.length > 0);
});

test('V16 Opportunity clustering groups pipeline and customer expansion signals', () => {
  const oppSignal = createSignal({
    id: 'sig-opp-1',
    domain: 'growth',
    type: 'expansion_opportunity',
    title: 'Contract upsell ready',
    entities: [{ type: 'opportunity', id: 'opp-1', name: 'Upsell' }],
  });

  const oppClusters = clusterExecutiveOpportunities([oppSignal]);
  assert.ok(oppClusters.length >= 1);
  assert.equal(oppClusters[0].domains[0], 'growth');
  assert.ok(oppClusters[0].nextAction.length > 0);
});

test('V16 Decision Readiness flags missing evidence, blocking dependencies, and ready states', () => {
  const readyDecision = { id: mockId, title: 'Expand warehouse', status: 'open' };
  const readyState = evaluateDecisionReadiness(readyDecision, { hasEvidence: true, hasAlternatives: true });
  assert.equal(readyState.state, 'Ready');

  const missingEvidenceState = evaluateDecisionReadiness(readyDecision, { openQuestionsCount: 2 });
  assert.equal(missingEvidenceState.state, 'Missing evidence');

  const blockedState = evaluateDecisionReadiness(readyDecision, { isBlocked: true });
  assert.equal(blockedState.state, 'Blocked');
});

test('V16 Decision Impact accurately rates high financial stakes and multi-domain scope', () => {
  const bigDecision = { title: 'Acquisition' };
  const impact = evaluateDecisionImpact(bigDecision, { moneyAmount: 50000, affectedDomains: ['finance', 'operations', 'strategy'] });
  assert.equal(impact.impact, 'Critical');

  const minorDecision = { title: 'Update wiki font' };
  const minorImpact = evaluateDecisionImpact(minorDecision, { moneyAmount: 0 });
  assert.equal(minorImpact.impact, 'Low');
});

test('V16 Decision Urgency identifies overdue, due soon, and normal timing', () => {
  assert.equal(evaluateDecisionUrgency({ review_date: '2026-09-01' }, today), 'overdue');
  assert.equal(evaluateDecisionUrgency({ review_date: today }, today), 'due');
  assert.equal(evaluateDecisionUrgency({ review_date: '2026-09-11' }, today), 'due_soon');
  assert.equal(evaluateDecisionUrgency({ review_date: '2026-10-30' }, today), 'upcoming');
  assert.equal(evaluateDecisionUrgency({}, today), 'no_deadline');
});

test('V16 Can Wait list isolates low-urgency tasks to protect executive focus', () => {
  const signals = [
    createSignal({ id: 'sig-routine', severity: 'info', title: 'Routine observation', moneyAmount: 0 }),
  ];
  const tasks = [
    { id: 't-1', title: 'Urgent cash recovery', priority: 'high', due_date: today },
    { id: 't-2', title: 'Clean up desk drawer', priority: 'low', due_date: null },
  ];

  const canWait = buildCanWaitList(signals, tasks);
  assert.ok(canWait.some((t) => t.title === 'Routine observation'));
  assert.ok(canWait.some((t) => t.title === 'Clean up desk drawer'));
  assert.equal(canWait.some((t) => t.title === 'Urgent cash recovery'), false);
});

test('V16 Delegation candidates identify processes with SOPs and routine assignable tasks', () => {
  const delegation = buildDelegationCandidates({
    processes: [
      { id: 'p-1', name: 'Weekly Invoicing', hasSop: true },
      { id: 'p-2', name: 'Ad-hoc Strategic Negotiation', hasSop: false },
    ],
  });

  assert.ok(delegation.some((d) => d.taskTitle.includes('Weekly Invoicing')));
  assert.equal(delegation.some((d) => d.taskTitle.includes('Ad-hoc Strategic Negotiation')), false);
});

test('V16 Plan vs Reality compares milestones and budgets without hallucinating numbers', () => {
  const pvr = buildPlanVsReality({
    milestones: [
      { title: 'Launch Commerce', target_date: today, status: 'completed' },
      { title: 'Hire Ops Lead', target_date: '2026-08-01', status: 'at_risk' },
    ],
    budgets: [
      { name: 'Marketing Q3', currency: 'MAD', amount: 50000, spent: 45000 },
    ],
  });

  const milestoneItems = pvr.filter((i) => i.domain === 'strategy');
  const budgetItems = pvr.filter((i) => i.domain === 'finance');

  assert.equal(milestoneItems.length, 2);
  assert.equal(milestoneItems[0].status, 'on_track');
  assert.equal(milestoneItems[1].status, 'slipping');
  assert.equal(budgetItems.length, 1);
  assert.equal(budgetItems[0].planned, 'MAD 50,000');
  assert.equal(budgetItems[0].actual, 'MAD 45,000');
});

test('V16 Executive Brief synthesizes metrics, changes, and decisions concisely', () => {
  const brief = buildExecutiveBrief({
    signals: [],
    changes: [],
    priorities: [{ id: 'p-1', rank: 1, domain: 'finance', title: 'Recover 20k MAD', why: 'Overdue 30d', urgency: 'Immediate', impact: 'High', route: '/financial-control', score: 95 }],
    decisions: [{
      decisionId: 'd-1',
      title: 'Sign Vendor contract',
      urgency: 'due_soon',
      impact: 'High',
      readiness: 'Ready',
      readinessReasons: ['Clear evidence'],
      impactDimensions: ['Operations'],
      impactReasons: ['Operational delay'],
      costOfDelay: 'high',
      whyNow: 'Offer expires Friday',
      reversibility: 'moderate',
      alternatives: [],
      evidence: [],
      unknowns: [],
      risks: [],
      dependencies: [],
      route: '/executive/decisions/d-1',
    }],
    riskClusters: [],
    oppClusters: [],
    canWait: [{ title: 'Archive 2025 receipts', reason: 'Non-blocking task' }],
  });

  assert.ok(brief.headline.includes('1 issue'));
  assert.equal(brief.priorities.length, 1);
  assert.equal(brief.topDecision?.title, 'Sign Vendor contract');
  assert.equal(brief.whatCanWait.length, 1);
  assert.ok(brief.recommendedFocus.includes('Recover 20k MAD'));
});

test('V16 AI Assistant Tools require explicit confirmation gate on write operations', async () => {
  const unconfirmedResult = await executeExecutiveTool(
    {} as unknown as SupabaseClient,
    mockId,
    'create_executive_assumption',
    { statement: 'Organic growth stays above 10%', domain: 'growth', confirmed: false }
  );

  const res = unconfirmedResult as Record<string, unknown>;
  assert.equal(res.confirmation_required, true);
  assert.equal(res.tool, 'create_executive_assumption');
});

test('V16 AI Assistant tool definitions include all expected executive read and write tools', () => {
  const toolNames = executiveAssistantTools.map((t) => t.name);
  for (const name of executiveReadNames) {
    assert.ok(toolNames.includes(name), `Missing AI read tool: ${name}`);
  }
  for (const name of Object.keys(executiveWrites)) {
    assert.ok(toolNames.includes(name), `Missing AI write tool: ${name}`);
  }
});

test('V16 Notification Route maps executive clusters and material changes to /executive', () => {
  assert.equal(notificationRoute('decisions', 'executive_cluster'), '/executive');
  assert.equal(notificationRoute('decisions', 'executive_change'), '/executive');
});

test('V16 Migration SQL is additive, safe, indexed, and owner-scoped with RLS', () => {
  const sql = readFileSync(
    'supabase/migrations/20260909200000_v16_executive_reporting_decision_intelligence.sql',
    'utf-8'
  );

  assert.ok(sql.includes('create table if not exists executive_snapshots'));
  assert.ok(sql.includes('create table if not exists executive_reports'));
  assert.ok(sql.includes('create table if not exists executive_assumptions'));
  assert.ok(sql.includes('create table if not exists executive_decision_briefs'));
  assert.ok(sql.includes('create table if not exists executive_signal_dismissals'));
  assert.ok(sql.includes('create table if not exists executive_decision_reviews'));
  assert.ok(sql.includes('alter table executive_snapshots enable row level security;'));
  assert.ok(sql.includes('auth.uid()'));
  // Never drops tables or columns
  assert.ok(!sql.toLowerCase().includes('drop table'));
  assert.ok(!sql.toLowerCase().includes('drop column'));
});
