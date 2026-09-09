import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  classifyActionRisk,
  classifyActionPolicy,
  computePayloadHash,
  validateApprovedPayload,
  evaluateApprovalFreshness,
  detectContextDrift,
  buildActionIdempotencyKey,
  validateStateTransition,
  evaluateRetryability,
  evaluateRollbackAvailability,
  rankNextChiefOfStaffAction,
  buildExecutionReceipt,
  evaluatePlanState,
  buildAutomationOpportunity,
  type ActionPlanStep,
} from '../src/lib/chief-of-staff';
import {
  chiefOfStaffAssistantTools,
  chiefOfStaffReadNames,
  chiefOfStaffWrites,
  executeChiefOfStaffTool,
} from '../src/lib/chief-of-staff-ai';
import { notificationRoute } from '../src/lib/v4-notifications';

const mockUserId = 'user-1111-4111-8111-111111111111';
const mockProposalId = 'prop-2222-4222-8222-222222222222';
const mockPlanId = 'plan-3333-4333-8333-333333333333';

test('V17 Action Risk Classification correctly identifies safe internal, low, moderate, and critical risk actions', () => {
  assert.equal(classifyActionRisk('create_task', { title: 'Review report' }).riskLevel, 'safe_internal');
  assert.equal(classifyActionRisk('create_email_draft', {}).riskLevel, 'low');
  assert.equal(classifyActionRisk('send_email', { to: 'client@example.com' }).riskLevel, 'moderate');
  assert.equal(classifyActionRisk('delete_calendar_event', { eventId: 'evt1' }).riskLevel, 'high');
  assert.equal(classifyActionRisk('move_money', { amount: 5000 }).riskLevel, 'critical');
});

test('V17 Action Policy strictly blocks unsupported external money movement and financial mutation', () => {
  const moneyPolicy = classifyActionPolicy('move_money', 'critical', 2);
  assert.equal(moneyPolicy, 'unsupported');
});

test('V17 Action Policy strictly requires approval for external communications across all autonomy levels', () => {
  const levels = [0, 1, 2];

  for (const level of levels) {
    const emailPolicy = classifyActionPolicy('send_email', 'moderate', level);
    assert.equal(emailPolicy, 'approval_required');
  }
});

test('V17 Action Policy permits autonomous internal actions only at Level 2', () => {
  const lowAction = 'create_task';

  const p0 = classifyActionPolicy(lowAction, 'safe_internal', 0);
  assert.equal(p0, 'approval_required');

  const p1 = classifyActionPolicy(lowAction, 'safe_internal', 1);
  assert.equal(p1, 'approval_required');

  const p2 = classifyActionPolicy(lowAction, 'safe_internal', 2);
  assert.equal(p2, 'auto_executable');
});

test('V17 Cryptographic Payload Hashing is deterministic and tamper-evident', () => {
  const payloadA = { title: 'Deploy release', version: '1.2.0', env: 'production' };
  const payloadB = { env: 'production', title: 'Deploy release', version: '1.2.0' };
  const payloadModified = { title: 'Deploy release', version: '1.2.1', env: 'production' };

  const hashA = computePayloadHash(payloadA);
  const hashB = computePayloadHash(payloadB);
  const hashModified = computePayloadHash(payloadModified);

  // Key order invariance
  assert.equal(hashA, hashB);
  assert.notEqual(hashA, hashModified);

  // Validate approved payload helper
  assert.equal(validateApprovedPayload(hashA, payloadA).valid, true);
  assert.equal(validateApprovedPayload(hashA, payloadModified).valid, false);
});

test('V17 Approval Freshness evaluates expiration TTL safely', () => {
  const now = new Date('2026-09-09T12:00:00Z');
  const recentApproval = {
    created_at: '2026-09-09T11:00:00Z',
    status: 'approved',
    approved_at: '2026-09-09T11:00:00Z',
  };
  const staleApproval = {
    created_at: '2026-09-06T08:00:00Z',
    status: 'approved',
    approved_at: '2026-09-06T08:00:00Z', // > 48 hrs ago
  };

  assert.equal(evaluateApprovalFreshness(recentApproval, now), 'fresh');
  assert.equal(evaluateApprovalFreshness(staleApproval, now), 'requires_reapproval');
});

test('V17 Context Drift Detection identifies state modifications since proposal preparation', () => {
  const initialSnapshot = {
    entityId: 'proj-1',
    status: 'in_progress',
    budgetRemaining: 15000,
  };

  const sameSnapshot = {
    entityId: 'proj-1',
    status: 'in_progress',
    budgetRemaining: 15000,
  };

  const modifiedSnapshot = {
    entityId: 'proj-1',
    status: 'on_hold',
    budgetRemaining: 10000,
  };

  assert.equal(detectContextDrift(initialSnapshot, sameSnapshot).drifted, false);
  const drift = detectContextDrift(initialSnapshot, modifiedSnapshot);
  assert.equal(drift.drifted, true);
  assert.ok(drift.differences.length > 0);
});

test('V17 Idempotency Key generates deterministic keys for repeated action attempts', () => {
  const key1 = buildActionIdempotencyKey(mockUserId, 'send_email', 'client-1', 'hash_abc');
  const key2 = buildActionIdempotencyKey(mockUserId, 'send_email', 'client-1', 'hash_abc');
  const key3 = buildActionIdempotencyKey(mockUserId, 'send_email', 'client-2', 'hash_abc');

  assert.equal(key1, key2);
  assert.notEqual(key1, key3);
});

test('V17 State Machine enforces strict and valid lifecycle transitions', () => {
  // Valid transitions for executions
  assert.equal(validateStateTransition('prepared', 'awaiting_approval').valid, true);
  assert.equal(validateStateTransition('approved', 'preflight').valid, true);
  assert.equal(validateStateTransition('preflight', 'executing').valid, true);
  assert.equal(validateStateTransition('executing', 'executed').valid, true);
  assert.equal(validateStateTransition('executed', 'verified').valid, true);
  assert.equal(validateStateTransition('executing', 'failed').valid, true);

  // Invalid transitions
  assert.equal(validateStateTransition('prepared', 'executed').valid, false);
  assert.equal(validateStateTransition('verified', 'executing').valid, false);
  assert.equal(validateStateTransition('cancelled', 'executing').valid, false);
});

test('V17 Execution Retryability correctly handles transient vs permanent errors', () => {
  const retryTransient = evaluateRetryability('network', 1, 3);
  assert.equal(retryTransient.retryable, true);
  assert.ok((retryTransient.nextDelayMs ?? 0) > 0);

  const retryMaxExceeded = evaluateRetryability('network', 3, 3);
  assert.equal(retryMaxExceeded.retryable, false);

  const retryPermanent = evaluateRetryability('authentication', 0, 3);
  assert.equal(retryPermanent.retryable, false);
});

test('V17 Rollback Availability checks snapshot and reversal capability', () => {
  const reversible = evaluateRollbackAvailability('create_task', { taskId: 't-1' });
  assert.equal(reversible.available, true);
  assert.equal(reversible.rollbackType, 'reversal');

  const compensating = evaluateRollbackAvailability('send_email', { messageId: 'm-1' });
  assert.equal(compensating.available, true);
  assert.equal(compensating.rollbackType, 'compensating_action');

  const unhandled = evaluateRollbackAvailability('unsupported_action', {});
  assert.equal(unhandled.available, false);
});

test('V17 Execution Receipt is constructed with full audit metadata', () => {
  const receipt = buildExecutionReceipt({
    actionType: 'create_task',
    title: 'Review proposal',
    summary: 'Created task for team review',
    externalReference: 'task-123',
    payload: { title: 'Review proposal' },
    executionResult: { id: 'task-123' },
    verified: true,
  });

  assert.ok(receipt.receiptId.startsWith('rcpt_'));
  assert.equal(receipt.verificationState, 'verified');
  assert.equal(receipt.externalReference, 'task-123');
  assert.ok(receipt.nextSteps.length > 0);
});

test('V17 Plan State Evaluation resolves DAG steps and next ready step', () => {
  const steps: ActionPlanStep[] = [
    {
      id: 'step-1',
      plan_id: mockPlanId,
      position: 1,
      title: 'Prepare brief',
      action_type: 'generate_brief',
      risk_level: 'low',
      reversibility: 'reversible',
      requires_approval: false,
      status: 'completed',
      input_payload: {},
    },
    {
      id: 'step-2',
      plan_id: mockPlanId,
      position: 2,
      title: 'Send notification',
      action_type: 'send_notification',
      risk_level: 'safe_internal',
      reversibility: 'reversible',
      requires_approval: true,
      status: 'ready',
      input_payload: {},
    },
    {
      id: 'step-3',
      plan_id: mockPlanId,
      position: 3,
      title: 'Update database',
      action_type: 'update_record',
      risk_level: 'safe_internal',
      reversibility: 'reversible',
      requires_approval: false,
      status: 'pending',
      input_payload: {},
    },
  ];

  const dependencies = [
    { step_id: 'step-2', depends_on_step_id: 'step-1', dependency_state: 'completed' },
    { step_id: 'step-3', depends_on_step_id: 'step-2', dependency_state: 'completed' },
  ];

  const evalResult = evaluatePlanState(steps, dependencies);
  assert.deepEqual(evalResult.canExecuteStepIds, ['step-2']);
  assert.deepEqual(evalResult.blockedStepIds, ['step-3']);
  assert.equal(evalResult.planStatus, 'partially_completed');
});

test('V17 Automation Opportunities identifies eligible repetitive patterns', () => {
  const history = [
    { action_type: 'sync_inventory', created_at: '2026-09-09T08:00:00Z', title: 'Sync Inventory' },
    { action_type: 'sync_inventory', created_at: '2026-09-09T09:00:00Z', title: 'Sync Inventory' },
    { action_type: 'sync_inventory', created_at: '2026-09-09T10:00:00Z', title: 'Sync Inventory' },
  ];

  const opportunities = buildAutomationOpportunity(history);
  assert.equal(opportunities.length, 1);
  assert.equal(opportunities[0].action_type, 'sync_inventory');
  assert.equal(opportunities[0].occurrenceCount, 3);
});

test('V17 Ranking Next Chief of Staff Action orders pending approvals above proposals', () => {
  const ranked = rankNextChiefOfStaffAction({
    escalations: [],
    pendingApprovals: [
      { id: 'app-1', title: 'Dispatch Order', risk_level: 'high', action_type: 'dispatch_order' },
    ],
    failedExecutions: [],
    proposals: [
      {
        id: 'prop-1',
        title: 'Draft Campaign',
        action_type: 'draft_campaign',
        source_domain: 'marketing',
        risk_level: 'low',
        reversibility: 'reversible',
        reason: 'Recommended for launch',
        proposed_payload: {},
        status: 'proposed',
        created_at: '2026-09-09T10:00:00Z',
      },
    ],
  });

  assert.equal(ranked.actionId, 'app-1');
  assert.equal(ranked.score, 90);
  assert.equal(ranked.readiness, 'needs_approval');
});

test('V17 Chief of Staff AI tools registry contains all 13 read tools and 10 write tools', () => {
  assert.ok(chiefOfStaffAssistantTools.length >= 20);
  assert.equal(chiefOfStaffReadNames.length, 13);
  assert.equal(Object.keys(chiefOfStaffWrites).length, 10);

  // Check read names
  assert.ok(chiefOfStaffReadNames.includes('get_chief_of_staff_overview'));
  assert.ok(chiefOfStaffReadNames.includes('get_action_inbox'));
  assert.ok(chiefOfStaffReadNames.includes('get_action_plan'));
  assert.ok(chiefOfStaffReadNames.includes('get_execution_queue'));
  assert.ok(chiefOfStaffReadNames.includes('get_automation_opportunities'));

  // Check write names
  assert.ok(chiefOfStaffWrites['prepare_action']);
  assert.ok(chiefOfStaffWrites['create_action_plan']);
  assert.ok(chiefOfStaffWrites['approve_action']);
  assert.ok(chiefOfStaffWrites['reject_action']);
  assert.ok(chiefOfStaffWrites['retry_action']);
  assert.ok(chiefOfStaffWrites['cancel_action']);
});

test('V17 Chief of Staff AI write tools enforce explicit confirmation guard', async () => {
  const mockClient = {} as unknown as SupabaseClient;

  // Unconfirmed call to approve_action
  const result = await executeChiefOfStaffTool(mockClient, mockUserId, 'approve_action', {
    proposal_id: mockProposalId,
    confirmed: false,
  });

  assert.equal(result && typeof result === 'object' && 'confirmation_required' in result && result.confirmation_required, true);
  assert.equal((result as { tool: string }).tool, 'approve_action');
});

test('V17 Notifications routing correctly maps Chief of Staff entity types', () => {
  assert.equal(notificationRoute('automations', 'action_plan', 'plan-123'), '/chief-of-staff/plans/plan-123');
  assert.equal(notificationRoute('automations', 'action_approval', 'app-123'), '/chief-of-staff/approvals');
  assert.equal(notificationRoute('automations', 'action_execution', 'exec-123'), '/chief-of-staff/executions');
  assert.equal(notificationRoute('automations', 'action_escalation', 'esc-123'), '/chief-of-staff/escalations');
  assert.equal(notificationRoute('automations', 'action_template', 'tmpl-123'), '/chief-of-staff');
});

test('V17 Migration file 20260909220000_v17_chief_of_staff_safe_action_orchestration.sql exists and is properly structured', () => {
  const migrationPath = 'supabase/migrations/20260909220000_v17_chief_of_staff_safe_action_orchestration.sql';
  const sql = readFileSync(migrationPath, 'utf8');

  // Verify all 13 additive tables exist
  const expectedTables = [
    'action_plans',
    'action_proposals',
    'action_plan_steps',
    'action_dependencies',
    'action_executions',
    'action_execution_attempts',
    'action_execution_receipts',
    'action_verifications',
    'action_rollbacks',
    'action_policy_rules',
    'action_templates',
    'action_context_snapshots',
    'action_escalations',
  ];

  for (const table of expectedTables) {
    assert.match(sql, new RegExp(`create table if not exists ${table}`, 'i'), `Missing table ${table}`);
    assert.match(sql, new RegExp(`alter table ${table} enable row level security`, 'i'), `Missing RLS for ${table}`);
    assert.match(sql, new RegExp(`create policy "${table}_owner" on ${table}`, 'i'), `Missing isolation policy for ${table}`);
  }

  // Verify RLS policy uses user_id = auth.uid()
  assert.match(sql, /user_id = auth\.uid\(\)/i);
});
