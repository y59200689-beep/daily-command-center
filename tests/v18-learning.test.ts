import test from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  evaluateOutcomeLearning,
  evaluateLessonConfidence,
  detectOperatingPatterns,
  detectMemoryConflict,
  evaluateMemoryFreshness,
  buildLessonCandidate,
  buildRuleProposal,
  evaluateForecastAccuracy,
  evaluateDecisionOutcome,
  evaluateActionOutcome,
  detectRepeatedRecommendationFeedback,
  buildMonthlyLearningReview,
  buildQuarterlyLearningReview,
  rankLearningReviewQueue,
  validateLessonSafety,
  filterLessonsByScope,
  type OperatingLesson,
  type OperatingObservation,
  type ForecastSnapshot,
  type DecisionRecord,
  type ActionExecutionReceipt,
  type ActionOutcomeRecord,
  type RecommendationFeedbackItem,
  type ReviewQueueItem,
} from '../src/lib/learning';
import {
  learningAssistantTools,
  learningReadNames,
  learningWrites,
  executeLearningTool,
} from '../src/lib/learning-ai';

const mockUserId = 'user-1818-4818-8818-181818181818';

// ============================================================
// 1. Safety & Content Validation
// ============================================================

test('V18 Safety: Blocks sensitive demographic profiling keywords in lesson content', () => {
  const bad1 = validateLessonSafety('Client reaction based on religion and political stance');
  assert.equal(bad1.valid, false);
  assert.match(bad1.reason || '', /restricted sensitive attribute/);

  const bad2 = validateLessonSafety('Team member race affects delivery speed');
  assert.equal(bad2.valid, false);

  const bad3 = validateLessonSafety('Health condition diagnosis requires workflow exemption');
  assert.equal(bad3.valid, false);

  const safe = validateLessonSafety('Client onboarding SLA buffer of 2 weeks prevents launch delays');
  assert.equal(safe.valid, true);
});

// ============================================================
// 2. Scope Isolation (Business vs Personal)
// ============================================================

test('V18 Scope Isolation: Business queries never leak personal operating memories', () => {
  const lessons: OperatingLesson[] = [
    {
      id: 'l1',
      user_id: mockUserId,
      title: 'Commercial payment buffer',
      statement: 'Keep 10% buffer',
      why_proposed: 'Cashflow variability',
      domain: 'finance',
      scope: 'business',
      status: 'accepted',
      confidence_state: 'strong',
      evidence_count: 5,
      counterexample_count: 0,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 'l2',
      user_id: mockUserId,
      title: 'Personal routine sleep hygiene',
      statement: 'Shutdown screens at 10pm',
      why_proposed: 'Fitness recovery',
      domain: 'personal_life',
      scope: 'personal',
      status: 'accepted',
      confidence_state: 'moderate',
      evidence_count: 3,
      counterexample_count: 0,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
  ];

  const businessScoped = filterLessonsByScope(lessons, 'business');
  assert.equal(businessScoped.length, 1);
  assert.equal(businessScoped[0].id, 'l1');
  assert.equal(businessScoped[0].scope, 'business');

  const personalScoped = filterLessonsByScope(lessons, 'personal');
  assert.equal(personalScoped.length, 1);
  assert.equal(personalScoped[0].id, 'l2');
  assert.equal(personalScoped[0].scope, 'personal');
});

// ============================================================
// 3. Lesson Confidence State (Named States, No Percentages)
// ============================================================

test('V18 Confidence: Evaluates named states correctly without percentages', () => {
  // 0 evidence -> insufficient
  assert.equal(evaluateLessonConfidence(0, 0), 'insufficient');

  // Few evidence (<2) -> weak
  assert.equal(evaluateLessonConfidence(1, 0), 'weak');

  // Moderate evidence (2-4) without counterexamples -> moderate
  assert.equal(evaluateLessonConfidence(3, 0), 'moderate');

  // Strong evidence (>=5 with verified source) -> strong
  assert.equal(evaluateLessonConfidence(6, 0, ['verified_data']), 'strong');

  // Counterexamples substantial -> conflicting
  assert.equal(evaluateLessonConfidence(5, 3), 'conflicting');

  // Minor counterexample -> moderate/weak
  assert.equal(evaluateLessonConfidence(5, 1, ['verified_data']), 'moderate');
});

// ============================================================
// 4. Outcome Learning & No Causality Claim
// ============================================================

test('V18 Outcome Learning: Evaluates matched, better, worse, and forbids causality claims', () => {
  // Matched within 5%
  const matched = evaluateOutcomeLearning({ value: 100 }, { value: 102 });
  assert.equal(matched.state, 'matched');
  assert.equal(matched.causalityClaimAllowed, false);

  // Better
  const better = evaluateOutcomeLearning({ value: 100 }, { value: 120 });
  assert.equal(better.state, 'better');
  assert.equal(better.causalityClaimAllowed, false);

  // Worse
  const worse = evaluateOutcomeLearning({ value: 100 }, { value: 80 });
  assert.equal(worse.state, 'worse');
  assert.equal(worse.causalityClaimAllowed, false);

  // Too early / pending
  const pending = evaluateOutcomeLearning({ value: 100 }, { status: 'too_early' });
  assert.equal(pending.state, 'too_early');

  // Unknown data points
  const unknown = evaluateOutcomeLearning({}, {});
  assert.equal(unknown.state, 'unknown');
});

// ============================================================
// 5. Operating Pattern Detection
// ============================================================

test('V18 Patterns: Detects recurring patterns and enforces minimum observation threshold', () => {
  const observations: OperatingObservation[] = [
    {
      domain: 'operations',
      patternType: 'process_bottleneck',
      outcome: 'QA handoff delayed by 48h',
      observedAt: '2026-08-01T00:00:00Z',
    },
    {
      domain: 'operations',
      patternType: 'process_bottleneck',
      outcome: 'QA handoff delayed by 48h',
      observedAt: '2026-08-05T00:00:00Z',
    },
  ];

  // Threshold 3 not met with 2 observations
  const belowThreshold = detectOperatingPatterns(observations, 3);
  assert.equal(belowThreshold.length, 0);

  // Add 3rd observation -> threshold met
  observations.push({
    domain: 'operations',
    patternType: 'process_bottleneck',
    outcome: 'QA handoff delayed by 48h',
    observedAt: '2026-08-10T00:00:00Z',
  });

  const patterns = detectOperatingPatterns(observations, 3);
  assert.equal(patterns.length, 1);
  assert.equal(patterns[0].observationCount, 3);
  assert.equal(patterns[0].confidence, 'emerging');

  // Candidate generation
  const candidate = buildLessonCandidate(patterns[0], 'business');
  assert.equal(candidate.status, 'proposed');
  assert.match(candidate.statement, /QA handoff/i);
});

// ============================================================
// 6. Memory Conflict Detection
// ============================================================

test('V18 Memory Conflict: Detects directional contradictions and scope separation issues', () => {
  const lessonA: OperatingLesson = {
    id: 'lA',
    user_id: mockUserId,
    title: 'Always require client upfront payment',
    statement: 'Always require 100% upfront deposit before kickoff',
    why_proposed: 'Avoid bad debt',
    domain: 'finance',
    scope: 'business',
    status: 'accepted',
    confidence_state: 'strong',
    evidence_count: 5,
    counterexample_count: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };

  const lessonB: OperatingLesson = {
    id: 'lB',
    user_id: mockUserId,
    title: 'Never require client upfront payment for enterprise',
    statement: 'Never require upfront deposit for enterprise clients to close faster',
    why_proposed: 'Enterprise procurement velocity',
    domain: 'finance',
    scope: 'business',
    status: 'accepted',
    confidence_state: 'moderate',
    evidence_count: 3,
    counterexample_count: 0,
    created_at: '2026-02-01T00:00:00Z',
    updated_at: '2026-02-01T00:00:00Z',
  };

  const conflict = detectMemoryConflict(lessonA, lessonB);
  assert.notEqual(conflict, null);
  assert.equal(conflict?.conflictType, 'contradictory_guidance');
  assert.equal(conflict?.severity, 'high');

  // Cross-scope conflict
  const lessonCPersonal: OperatingLesson = {
    ...lessonB,
    id: 'lC',
    scope: 'personal',
  };
  const scopeConflict = detectMemoryConflict(lessonA, lessonCPersonal);
  assert.notEqual(scopeConflict, null);
  assert.equal(scopeConflict?.conflictType, 'scope_mismatch');
});

// ============================================================
// 7. Memory Freshness States
// ============================================================

test('V18 Freshness: Evaluates review cadence, expiration, and stale thresholds', () => {
  const now = new Date('2026-09-09T12:00:00Z');

  // Superseded / retired
  assert.equal(
    evaluateMemoryFreshness({ status: 'superseded', created_at: '2026-01-01T00:00:00Z' }, now),
    'superseded'
  );
  assert.equal(
    evaluateMemoryFreshness({ status: 'retired', created_at: '2026-01-01T00:00:00Z' }, now),
    'retired'
  );

  // Review due in past
  assert.equal(
    evaluateMemoryFreshness(
      { status: 'accepted', review_at: '2026-09-01T00:00:00Z', created_at: '2026-06-01T00:00:00Z' },
      now
    ),
    'review_due'
  );

  // Review soon (<14 days)
  assert.equal(
    evaluateMemoryFreshness(
      { status: 'accepted', review_at: '2026-09-15T00:00:00Z', created_at: '2026-06-01T00:00:00Z' },
      now
    ),
    'review_soon'
  );

  // Stale age (>180 days without review)
  assert.equal(
    evaluateMemoryFreshness(
      { status: 'accepted', created_at: '2025-12-01T00:00:00Z' },
      now
    ),
    'stale'
  );

  // Fresh current (<90 days)
  assert.equal(
    evaluateMemoryFreshness(
      { status: 'accepted', created_at: '2026-08-01T00:00:00Z' },
      now
    ),
    'current'
  );
});

// ============================================================
// 8. Forecast Accuracy & Calibration
// ============================================================

test('V18 Forecast Learning: Requires snapshot, calculates variance, suggests dampening calibration', () => {
  // Missing snapshot
  const missing = evaluateForecastAccuracy(null, { actualValue: 50000, recordedDate: '2026-09-01' });
  assert.equal(missing.hasSnapshot, false);

  const snapshot: ForecastSnapshot = {
    expectedValue: 100000,
    metric: 'Monthly Recurring Revenue',
    snapshotDate: '2026-08-01',
    domain: 'finance',
  };

  const evalOver = evaluateForecastAccuracy(snapshot, { actualValue: 130000, recordedDate: '2026-09-01' });
  assert.equal(evalOver.hasSnapshot, true);
  assert.equal(evalOver.direction, 'over');
  assert.equal(evalOver.variance, 30000);
  assert.equal(evalOver.variancePercentage, 30);
  assert.match(evalOver.calibrationProposal || '', /dampen recurring bias/i);

  const evalAccurate = evaluateForecastAccuracy(snapshot, { actualValue: 102000, recordedDate: '2026-09-01' });
  assert.equal(evalAccurate.direction, 'accurate');
  assert.equal(evalAccurate.calibrationProposal, undefined);
});

// ============================================================
// 9. Decision Learning: Process Quality vs Outcome Quality
// ============================================================

test('V18 Decision Learning: Strictly separates process quality from outcome reality', () => {
  const decision: DecisionRecord = {
    id: 'd1',
    title: 'Migrate hosting to Region B',
    domain: 'operations',
    expectedOutcome: 'Reduce latency by 40%',
    processQuality: 'rushed',
    decidedAt: '2026-07-01',
  };

  const outcome = evaluateDecisionOutcome(decision, {
    actualOutcome: 'Outage occurred due to DNS propagation bug',
    outcomeQuality: 'unsuccessful',
    invalidatedAssumptions: ['DNS changes propagate within 5m'],
    evaluatedAt: '2026-07-15',
  });

  assert.equal(outcome.processQuality, 'rushed');
  assert.equal(outcome.outcomeQuality, 'unsuccessful');
  assert.equal(outcome.assumptionsInvalidatedCount, 1);
  assert.match(outcome.lessonCandidates[0], /comprehensive data collection/i);
});

// ============================================================
// 10. Action Learning: Execution Succeeded != Outcome Achieved
// ============================================================

test('V18 Action Learning: Execution success is distinct from business outcome success', () => {
  const executionReceipt: ActionExecutionReceipt = {
    actionId: 'act-101',
    actionType: 'send_promotional_email',
    executed: true,
    status: 'succeeded',
    executedAt: '2026-08-01T10:00:00Z',
  };

  const outcomeReceipt: ActionOutcomeRecord = {
    achieved: false,
    outcomeState: 'not_achieved',
    observedAt: '2026-08-15T10:00:00Z',
    businessImpact: '0 sales conversions from campaign',
  };

  const evaluation = evaluateActionOutcome(executionReceipt, outcomeReceipt);
  assert.equal(evaluation.executionSucceeded, true);
  assert.equal(evaluation.outcomeAchieved, false);
  assert.equal(evaluation.needsReview, true);
  assert.match(evaluation.distinctionNote, /Execution succeeded mechanically, but intended business outcome was NOT achieved/);
});

// ============================================================
// 11. Recommendation Feedback: Single Negative Does NOT Trigger Rule Review
// ============================================================

test('V18 Feedback: Single negative feedback does not mutate rules; repeated feedback triggers review', () => {
  const singleFeedback: RecommendationFeedbackItem[] = [
    {
      id: 'f1',
      recommendationId: 'rec-1',
      recommendationType: 'invoice_reminder',
      rating: 'not_useful',
      domain: 'finance',
      submittedAt: '2026-09-01T00:00:00Z',
    },
  ];

  const singleSignal = detectRepeatedRecommendationFeedback(singleFeedback);
  assert.equal(singleSignal.length, 1);
  assert.equal(singleSignal[0].triggersRuleReview, false);

  // Add 2 more negative feedbacks (total 3)
  const repeatedFeedback: RecommendationFeedbackItem[] = [
    ...singleFeedback,
    {
      id: 'f2',
      recommendationId: 'rec-2',
      recommendationType: 'invoice_reminder',
      rating: 'not_useful',
      domain: 'finance',
      submittedAt: '2026-09-02T00:00:00Z',
    },
    {
      id: 'f3',
      recommendationId: 'rec-3',
      recommendationType: 'invoice_reminder',
      rating: 'wrong',
      domain: 'finance',
      submittedAt: '2026-09-03T00:00:00Z',
    },
  ];

  const repeatedSignal = detectRepeatedRecommendationFeedback(repeatedFeedback);
  assert.equal(repeatedSignal[0].negativeCount, 3);
  assert.equal(repeatedSignal[0].triggersRuleReview, true);
});

// ============================================================
// 12. Operating Rule Proposals: Explicit Approval & Impact Preview
// ============================================================

test('V18 Rule Proposals: Requires explicit human approval and generates impact preview', () => {
  const proposal = buildRuleProposal(
    { id: 'l10', title: 'Payment Grace Period', domain: 'finance', scope: 'business' },
    'threshold',
    7,
    14,
    {
      expectedEffect: 'Extend client grace period to 14 days before escalation',
      rollbackPath: 'Revert threshold to 7',
    }
  );

  assert.equal(proposal.status, 'proposed');
  assert.equal(proposal.requiresExplicitApproval, true);
  assert.equal(proposal.currentValue, 7);
  assert.equal(proposal.proposedValue, 14);
  assert.equal(proposal.rollbackPath, 'Revert threshold to 7');
});

// ============================================================
// 13. Review Queue Ranking
// ============================================================

test('V18 Review Queue: Prioritizes conflicts and rule proposals over lower-urgency items', () => {
  const items: ReviewQueueItem[] = [
    {
      id: 'q1',
      itemType: 'proposed_lesson',
      priority: 1,
      title: 'New Lesson',
      domain: 'operations',
      urgency: 'medium',
      reason: 'Check lesson',
      targetPath: '/learning/lessons/1',
    },
    {
      id: 'q2',
      itemType: 'conflict',
      priority: 1,
      title: 'Guidance Contradiction',
      domain: 'finance',
      urgency: 'critical',
      reason: 'Contradictory advice',
      targetPath: '/learning/review',
    },
    {
      id: 'q3',
      itemType: 'rule_proposal',
      priority: 1,
      title: 'Rule Change',
      domain: 'operations',
      urgency: 'high',
      reason: 'Adjust buffer',
      targetPath: '/learning/rules/1',
    },
  ];

  const ranked = rankLearningReviewQueue(items);
  assert.equal(ranked[0].itemType, 'conflict');
  assert.equal(ranked[1].itemType, 'rule_proposal');
  assert.equal(ranked[2].itemType, 'proposed_lesson');
});

// ============================================================
// 14. AI Tools: Read (16) & Write (10) Confirmation Gates
// ============================================================

test('V18 AI Tools: Exports 16 read tools and 10 confirmation-gated write tools', () => {
  assert.equal(learningReadNames.length, 16);
  assert.equal(Object.keys(learningWrites).length, 10);

  // Check all write tools are in assistantTools with confirmed requirement
  for (const writeName of Object.keys(learningWrites)) {
    const toolDef = learningAssistantTools.find((t) => t.name === writeName);
    assert.notEqual(toolDef, undefined, `Missing tool definition for write tool ${writeName}`);
    assert.equal(
      toolDef?.parameters.properties.confirmed !== undefined,
      true,
      `Write tool ${writeName} must have confirmed parameter`
    );
  }
});

// ============================================================
// 15. AI Self-Acceptance Blocked (Hard Safety)
// ============================================================

test('V18 AI Safety: Prohibits AI self-acceptance of operating lessons', async () => {
  const mockClient = {} as SupabaseClient;

  // Invoking accept_lesson without is_human_confirmed: true must fail
  const result = await executeLearningTool(mockClient, mockUserId, 'accept_lesson', {
    id: 'lesson-123',
    confirmed: true,
    is_human_confirmed: false,
  });

  assert.deepEqual(result, {
    error: 'AI self-acceptance of operating lessons is strictly prohibited. An explicit human confirmation is required.',
    success: false,
  });
});

// ============================================================
// 16. AI Write Tools Confirmation Gating
// ============================================================

test('V18 AI Tools: Enforces confirmed: true requirement on write operations', async () => {
  const mockClient = {} as SupabaseClient;

  const result = await executeLearningTool(mockClient, mockUserId, 'propose_lesson', {
    title: 'Test Lesson',
    statement: 'Guidance',
    why_proposed: 'Evidence',
    domain: 'operations',
    confirmed: false,
  });

  assert.equal((result as Record<string, unknown>).confirmation_required, true);
  assert.equal((result as Record<string, unknown>).tool, 'propose_lesson');
});

// ============================================================
// 17. Monthly & Quarterly Reviews
// ============================================================

test('V18 Review Generation: Monthly and Quarterly reviews aggregate data correctly', () => {
  const monthly = buildMonthlyLearningReview({
    month: '2026-08',
    lessons: [
      {
        id: 'l1',
        user_id: mockUserId,
        title: 'L1',
        statement: 'S1',
        why_proposed: 'W1',
        domain: 'operations',
        scope: 'business',
        status: 'accepted',
        confidence_state: 'strong',
        evidence_count: 5,
        counterexample_count: 0,
        created_at: '2026-08-01T00:00:00Z',
        updated_at: '2026-08-01T00:00:00Z',
      },
      {
        id: 'l2',
        user_id: mockUserId,
        title: 'L2',
        statement: 'S2',
        why_proposed: 'W2',
        domain: 'team',
        scope: 'business',
        status: 'rejected',
        confidence_state: 'weak',
        evidence_count: 1,
        counterexample_count: 0,
        created_at: '2026-08-02T00:00:00Z',
        updated_at: '2026-08-02T00:00:00Z',
      },
    ],
    patterns: [],
    forecastMisses: [],
    decisionOutcomes: [],
    actionOutcomes: [],
    ruleProposals: [],
  });

  assert.equal(monthly.month, '2026-08');
  assert.equal(monthly.totalNewLessons, 2);
  assert.equal(monthly.acceptedLessons, 1);
  assert.equal(monthly.rejectedLessons, 1);

  const quarterly = buildQuarterlyLearningReview({
    quarter: '2026-Q3',
    monthlyReviews: [monthly],
    staleLessons: [],
    allLessons: [],
  });

  assert.equal(quarterly.quarter, '2026-Q3');
  assert.equal(Array.isArray(quarterly.whatBecamePredictable), true);
  assert.equal(Array.isArray(quarterly.whatStayedUnpredictable), true);
});

// ============================================================
// 18. Hard Safety Rules: V18 Never Modifies V17 Policy Enforcement
// ============================================================

test('V18 Hard Safety: Operating memory provides context only and never weakens safety restrictions', () => {
  // A lesson cannot override financial movement or action approval requirements
  const lessonProposal = buildRuleProposal(
    { id: 'l99', title: 'Automate high risk transfers', domain: 'finance', scope: 'business' },
    'threshold',
    0,
    1000000
  );

  assert.equal(lessonProposal.requiresExplicitApproval, true);
  assert.equal(lessonProposal.status, 'proposed');
});

// ============================================================
// 19. Outcome Learning: Exact Strings, Case Insensitive & Tolerance
// ============================================================

test('V18 Outcome Learning: Evaluates string matching and numerical tolerances accurately', () => {
  // String exact match
  const strMatch = evaluateOutcomeLearning(
    { value: 'Completed on staging' },
    { value: 'completed on staging' }
  );
  assert.equal(strMatch.state, 'matched');

  // String mismatch
  const strMismatch = evaluateOutcomeLearning(
    { value: 'Completed on staging' },
    { value: 'Aborted due to network error' }
  );
  assert.equal(strMismatch.state, 'mixed');

  // Exact 0 value comparison
  const zeroMatch = evaluateOutcomeLearning({ value: 0 }, { value: 0 });
  assert.equal(zeroMatch.state, 'matched');

  // Negative values
  const negBetter = evaluateOutcomeLearning({ value: -100 }, { value: -50 });
  assert.equal(negBetter.state, 'better');
});

// ============================================================
// 20. Lesson Confidence: Granular Source Quality Weights
// ============================================================

test('V18 Confidence: Evaluates unverified vs verified source qualities', () => {
  // 5 evidence items but all unverified -> moderate (needs verified for strong)
  const unverified = evaluateLessonConfidence(5, 0, ['unverified', 'user_reported']);
  assert.equal(unverified, 'moderate');

  // 5 evidence items with system_event -> strong
  const systemEvent = evaluateLessonConfidence(5, 0, ['system_event']);
  assert.equal(systemEvent, 'strong');

  // 10 evidence items with 4 counterexamples (40%) -> conflicting
  const conflicting = evaluateLessonConfidence(10, 4);
  assert.equal(conflicting, 'conflicting');
});

// ============================================================
// 21. Pattern Detection: Multi-Domain & Confidence Tiers
// ============================================================

test('V18 Pattern Detection: Tiers confidence from emerging to supported to strong', () => {
  const baseObs: OperatingObservation = {
    domain: 'commerce',
    patternType: 'supplier_performance',
    entityType: 'supplier',
    entityId: 'sup-1',
    outcome: 'Late shipment by 5+ days',
    observedAt: '2026-08-01T00:00:00Z',
  };

  // 3 items -> emerging
  const p3 = detectOperatingPatterns([baseObs, baseObs, baseObs], 3);
  assert.equal(p3[0].confidence, 'emerging');

  // 5 items -> supported
  const p5 = detectOperatingPatterns(Array(5).fill(baseObs), 3);
  assert.equal(p5[0].confidence, 'supported');

  // 8 items -> strong
  const p8 = detectOperatingPatterns(Array(8).fill(baseObs), 3);
  assert.equal(p8[0].confidence, 'strong');
});

// ============================================================
// 22. Forecast Calibration Edge Cases
// ============================================================

test('V18 Forecast Calibration: Handles zero expected baseline and negative variance', () => {
  const zeroSnap: ForecastSnapshot = {
    expectedValue: 0,
    metric: 'Defect Rate',
    snapshotDate: '2026-08-01',
    domain: 'operations',
  };

  const zeroEval = evaluateForecastAccuracy(zeroSnap, { actualValue: 0, recordedDate: '2026-08-15' });
  assert.equal(zeroEval.direction, 'accurate');
  assert.equal(zeroEval.variancePercentage, 0);

  const underSnap: ForecastSnapshot = {
    expectedValue: 500,
    metric: 'Support Tickets',
    snapshotDate: '2026-08-01',
    domain: 'success',
  };
  const underEval = evaluateForecastAccuracy(underSnap, { actualValue: 300, recordedDate: '2026-08-15' });
  assert.equal(underEval.direction, 'under');
  assert.equal(underEval.variance, -200);
  assert.match(underEval.calibrationProposal || '', /adjust future Support Tickets/i);
});

// ============================================================
// 23. Memory Conflict: Ignores Superseded & Retired Lessons
// ============================================================

test('V18 Memory Conflict: Ignores retired and superseded memories', () => {
  const active: OperatingLesson = {
    id: 'lActive',
    user_id: mockUserId,
    title: 'Require upfront payment',
    statement: 'Always require 100% upfront deposit',
    why_proposed: 'Cashflow',
    domain: 'finance',
    scope: 'business',
    status: 'accepted',
    confidence_state: 'strong',
    evidence_count: 5,
    counterexample_count: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };

  const retired: OperatingLesson = {
    id: 'lRetired',
    user_id: mockUserId,
    title: 'Never require upfront payment',
    statement: 'Never require upfront deposit',
    why_proposed: 'Old policy',
    domain: 'finance',
    scope: 'business',
    status: 'retired',
    confidence_state: 'weak',
    evidence_count: 1,
    counterexample_count: 0,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-06-01T00:00:00Z',
  };

  const conflict = detectMemoryConflict(active, retired);
  assert.equal(conflict, null);
});

// ============================================================
// 24. AI Safety: Content validation in AI Tool execution
// ============================================================

test('V18 AI Tools: Blocks propose_lesson containing restricted sensitive profiling', async () => {
  const mockClient = {} as SupabaseClient;

  const result = await executeLearningTool(mockClient, mockUserId, 'propose_lesson', {
    title: 'Team member ethnicity profiling',
    statement: 'Adjust expectations based on ethnicity',
    why_proposed: 'Bad inference',
    domain: 'team',
    confirmed: true,
  });

  assert.equal((result as Record<string, unknown>).success, false);
  assert.match(String((result as Record<string, unknown>).error), /restricted sensitive attribute/);
});

// ============================================================
// 25. AI Safety: All 10 Write Tools Require Confirmation
// ============================================================

test('V18 AI Tools: Every registered write tool denies unconfirmed execution', async () => {
  const mockClient = {} as SupabaseClient;
  const writeToolNames = Object.keys(learningWrites);

  for (const name of writeToolNames) {
    const res = await executeLearningTool(mockClient, mockUserId, name, { confirmed: false });
    assert.equal((res as Record<string, unknown>).confirmation_required, true, `Tool ${name} did not gate on confirmation`);
  }
});


