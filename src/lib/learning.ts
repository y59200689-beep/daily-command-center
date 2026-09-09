/**
 * V18 Operating Memory & Learning System - Core Domain Engine
 *
 * Deterministic domain logic for operating memory, pattern detection,
 * outcome learning, forecast evaluation, and rule proposals.
 *
 * Hard Safety Rules:
 * 1. AI cannot self-accept lessons or mutate rules silently.
 * 2. Personal memory scope never leaks into Business context.
 * 3. Sensitive attributes (race, religion, health, politics, etc.) are strictly disallowed.
 * 4. Confidence uses named states only (no arbitrary percentages).
 * 5. Execution success is strictly separated from outcome success.
 * 6. V18 provides context only and never weakens V17 safety restrictions.
 */

export type LessonStatus =
  | 'proposed'
  | 'accepted'
  | 'needs_review'
  | 'superseded'
  | 'retired'
  | 'rejected';

export type ConfidenceState =
  | 'insufficient'
  | 'weak'
  | 'moderate'
  | 'strong'
  | 'conflicting';

export type MemoryScope = 'business' | 'personal';

export type LearningDomain =
  | 'operations'
  | 'team'
  | 'success'
  | 'commerce'
  | 'finance'
  | 'executive'
  | 'growth'
  | 'strategy'
  | 'knowledge'
  | 'personal_life';

export type FreshnessState =
  | 'current'
  | 'review_soon'
  | 'review_due'
  | 'stale'
  | 'superseded'
  | 'retired';

export type PatternType =
  | 'process_bottleneck'
  | 'recurring_delay'
  | 'client_behavior'
  | 'forecast_bias'
  | 'supplier_performance'
  | 'capacity_overrun'
  | 'operational_failure'
  | 'communication_gap'
  | 'cost_discrepancy';

export type PatternConfidence = 'emerging' | 'supported' | 'strong';

export type RuleType =
  | 'threshold'
  | 'default_assumption'
  | 'planning_buffer'
  | 'review_cadence'
  | 'risk_trigger'
  | 'recommendation_modifier';

export type RuleStatus = 'proposed' | 'accepted' | 'rejected' | 'retired';

export type OutcomeState =
  | 'matched'
  | 'better'
  | 'worse'
  | 'mixed'
  | 'achieved'
  | 'partially_achieved'
  | 'not_achieved'
  | 'unknown'
  | 'too_early'
  | 'pending';

export type ProcessQuality =
  | 'well_supported'
  | 'standard'
  | 'rushed'
  | 'insufficient_data';

export type SourceQuality = 'verified_data' | 'system_event' | 'user_reported' | 'unverified';

export interface OperatingLesson {
  id: string;
  user_id: string;
  title: string;
  statement: string;
  why_proposed: string;
  domain: LearningDomain;
  scope: MemoryScope;
  status: LessonStatus;
  confidence_state: ConfidenceState;
  evidence_count: number;
  counterexample_count: number;
  last_reviewed_at?: string | null;
  review_at?: string | null;
  effective_from?: string | null;
  effective_until?: string | null;
  suggested_use?: string | null;
  potential_consequences?: string | null;
  superseded_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LessonEvidenceLink {
  id: string;
  lesson_id: string;
  user_id: string;
  source_table: string;
  source_id: string;
  is_counterexample: boolean;
  source_quality: SourceQuality;
  description: string;
  created_at: string;
}

export interface OperatingObservation {
  id?: string;
  domain: LearningDomain;
  patternType: PatternType;
  entityType?: string;
  entityId?: string;
  outcome: string;
  context?: Record<string, unknown>;
  observedAt: string;
  sourceQuality?: SourceQuality;
}

export interface PatternResult {
  patternKey: string;
  domain: LearningDomain;
  patternType: PatternType;
  entityType?: string;
  entityId?: string;
  observationCount: number;
  counterexampleCount: number;
  confidence: PatternConfidence;
  title: string;
  description: string;
  suggestedAction: string;
  observations: OperatingObservation[];
}

export interface ConflictResult {
  conflictType: 'contradictory_guidance' | 'divergent_outcomes' | 'scope_mismatch';
  severity: 'high' | 'medium';
  description: string;
  lessonAId: string;
  lessonBId: string;
  recommendedAction: 'review_and_supersede' | 'reconcile_scopes' | 'investigate_counterexamples';
}

export interface LessonCandidate {
  title: string;
  statement: string;
  whyProposed: string;
  domain: LearningDomain;
  scope: MemoryScope;
  status: 'proposed';
  confidenceState: ConfidenceState;
  patternKey?: string;
  suggestedUse: string;
  potentialConsequences: string;
  evidenceCount: number;
}

export interface RuleProposal {
  title: string;
  ruleType: RuleType;
  domain: LearningDomain;
  scope: MemoryScope;
  currentValue: string | number | boolean | Record<string, unknown>;
  proposedValue: string | number | boolean | Record<string, unknown>;
  lessonId?: string;
  affectedDomains: LearningDomain[];
  expectedEffect: string;
  risks: string[];
  rollbackPath: string;
  requiresExplicitApproval: true;
  status: 'proposed';
}

export interface ForecastSnapshot {
  expectedValue: number;
  metric: string;
  snapshotDate: string;
  domain: LearningDomain;
  entityId?: string;
  assumptions?: string[];
}

export interface ForecastActual {
  actualValue: number;
  recordedDate: string;
  reason?: string;
}

export interface ForecastEvaluation {
  hasSnapshot: boolean;
  metric: string;
  expectedValue: number;
  actualValue: number;
  variance: number;
  variancePercentage: number;
  direction: 'over' | 'under' | 'accurate';
  timingVarianceDays: number;
  calibrationProposal?: string;
  explanation: string;
}

export interface DecisionRecord {
  id: string;
  title: string;
  domain: LearningDomain;
  expectedOutcome: string;
  processQuality: ProcessQuality;
  assumptions?: string[];
  decidedAt: string;
}

export interface DecisionActualOutcome {
  actualOutcome: string;
  outcomeQuality: 'successful' | 'partial' | 'unsuccessful' | 'too_early' | 'unknown';
  validatedAssumptions?: string[];
  invalidatedAssumptions?: string[];
  evaluatedAt: string;
  notes?: string;
}

export interface DecisionOutcomeState {
  decisionId: string;
  processQuality: ProcessQuality;
  outcomeQuality: 'successful' | 'partial' | 'unsuccessful' | 'too_early' | 'unknown';
  assumptionsValidatedCount: number;
  assumptionsInvalidatedCount: number;
  summary: string;
  lessonCandidates: string[];
  nextTimeConsiderations: string[];
}

export interface ActionExecutionReceipt {
  actionId: string;
  actionType: string;
  executed: boolean;
  status: 'succeeded' | 'failed' | 'pending';
  executedAt: string;
}

export interface ActionOutcomeRecord {
  achieved: boolean;
  outcomeState: OutcomeState;
  observedAt: string;
  businessImpact?: string;
  sideEffects?: string[];
}

export interface ActionOutcomeState {
  actionId: string;
  executionSucceeded: boolean;
  outcomeAchieved: boolean;
  outcomeState: OutcomeState;
  distinctionNote: string;
  needsReview: boolean;
}

export interface RecommendationFeedbackItem {
  id: string;
  recommendationId: string;
  recommendationType: string;
  rating: 'helpful' | 'not_useful' | 'wrong';
  comment?: string;
  domain: LearningDomain;
  entityId?: string;
  submittedAt: string;
}

export interface FeedbackSignal {
  recommendationType: string;
  domain: LearningDomain;
  negativeCount: number;
  positiveCount: number;
  signalStrength: 'weak' | 'moderate' | 'strong';
  triggersRuleReview: boolean;
  summary: string;
}

export interface MonthlyReviewParams {
  month: string; // YYYY-MM
  lessons: OperatingLesson[];
  patterns: PatternResult[];
  forecastMisses: ForecastEvaluation[];
  decisionOutcomes: DecisionOutcomeState[];
  actionOutcomes: ActionOutcomeState[];
  ruleProposals: RuleProposal[];
}

export interface MonthlyReview {
  month: string;
  totalNewLessons: number;
  acceptedLessons: number;
  rejectedLessons: number;
  recurringPatterns: PatternResult[];
  forecastMisses: ForecastEvaluation[];
  decisionOutcomes: DecisionOutcomeState[];
  actionOutcomes: ActionOutcomeState[];
  ruleProposals: RuleProposal[];
  staleMemoriesCount: number;
  highlights: string[];
}

export interface QuarterlyReviewParams {
  quarter: string; // YYYY-Q1
  monthlyReviews: MonthlyReview[];
  staleLessons: OperatingLesson[];
  allLessons: OperatingLesson[];
}

export interface QuarterlyReview {
  quarter: string;
  whatBecamePredictable: string[];
  whatStayedUnpredictable: string[];
  repeatedMistakes: string[];
  repeatedSuccesses: string[];
  assumptionsToChange: string[];
  processesToImprove: string[];
  rulesToReview: string[];
  knowledgeToRetire: string[];
}

export interface ReviewQueueItem {
  id: string;
  itemType: 'conflict' | 'rule_proposal' | 'stale_lesson' | 'proposed_lesson' | 'retrospective_due' | 'forecast_miss';
  priority: number; // 1 = highest
  title: string;
  domain: LearningDomain;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  reason: string;
  targetPath: string;
}

// Sensitive attribute keywords strictly disallowed from lesson content
const SENSITIVE_KEYWORDS = [
  'race',
  'ethnicity',
  'religion',
  'religious',
  'political',
  'politics',
  'sexual orientation',
  'health condition',
  'medical diagnosis',
  'disability status',
  'genetic',
  'biometric',
];

/**
 * Validates that lesson content contains no sensitive demographic or medical profiling.
 */
export function validateLessonSafety(content: string): { valid: boolean; reason?: string } {
  const lower = content.toLowerCase();
  for (const keyword of SENSITIVE_KEYWORDS) {
    if (lower.includes(keyword)) {
      return {
        valid: false,
        reason: `Content contains restricted sensitive attribute reference: "${keyword}". Personal profiling is strictly forbidden.`,
      };
    }
  }
  return { valid: true };
}

/**
 * 1. Evaluates outcome learning between expected and actual data.
 * Adheres strictly to the "no causality claim" standard — observational correlation only.
 */
export function evaluateOutcomeLearning(
  expected: { metric?: string; value?: number | string; targetDate?: string; assumptions?: string[] },
  actual: { value?: number | string; completedDate?: string; notes?: string; status?: string }
): {
  state: OutcomeState;
  explanation: string;
  variance?: number;
  causalityClaimAllowed: false;
} {
  if (actual.status === 'too_early' || actual.status === 'pending') {
    return {
      state: actual.status as OutcomeState,
      explanation: 'Outcome observation window is not yet open or remains pending.',
      causalityClaimAllowed: false,
    };
  }

  if (expected.value === undefined || actual.value === undefined) {
    return {
      state: 'unknown',
      explanation: 'Insufficient data points to evaluate expected versus actual outcome.',
      causalityClaimAllowed: false,
    };
  }

  // Numerical comparison
  if (typeof expected.value === 'number' && typeof actual.value === 'number') {
    const diff = actual.value - expected.value;
    const absDiff = Math.abs(diff);
    const threshold = Math.max(Math.abs(expected.value) * 0.05, 0.001); // 5% buffer

    if (absDiff <= threshold) {
      return {
        state: 'matched',
        variance: diff,
        explanation: `Observed value (${actual.value}) closely matched expected target (${expected.value}) within 5% tolerance.`,
        causalityClaimAllowed: false,
      };
    } else if (diff > 0) {
      return {
        state: 'better',
        variance: diff,
        explanation: `Observed value (${actual.value}) exceeded expected target (${expected.value}) by ${diff.toFixed(2)}.`,
        causalityClaimAllowed: false,
      };
    } else {
      return {
        state: 'worse',
        variance: diff,
        explanation: `Observed value (${actual.value}) fell short of expected target (${expected.value}) by ${Math.abs(diff).toFixed(2)}.`,
        causalityClaimAllowed: false,
      };
    }
  }

  // String / categorical comparison
  const expStr = String(expected.value).trim().toLowerCase();
  const actStr = String(actual.value).trim().toLowerCase();

  if (expStr === actStr) {
    return {
      state: 'matched',
      explanation: `Observed outcome "${actual.value}" matched expected outcome.`,
      causalityClaimAllowed: false,
    };
  }

  return {
    state: 'mixed',
    explanation: `Observed outcome "${actual.value}" diverged from expected "${expected.value}".`,
    causalityClaimAllowed: false,
  };
}

/**
 * 2. Evaluates confidence state using named categories (no percentages).
 */
export function evaluateLessonConfidence(
  evidenceCount: number,
  counterexampleCount: number,
  sourceQuality: SourceQuality[] = []
): ConfidenceState {
  if (evidenceCount <= 0) {
    return 'insufficient';
  }

  // If counterexamples are substantial relative to evidence
  if (counterexampleCount > 0 && counterexampleCount >= Math.ceil(evidenceCount * 0.4)) {
    return 'conflicting';
  }

  // Calculate weighted source score
  const hasVerified = sourceQuality.includes('verified_data') || sourceQuality.includes('system_event');

  if (counterexampleCount > 0) {
    // When there are minor counterexamples
    if (evidenceCount >= 5 && hasVerified) {
      return 'moderate';
    }
    return 'weak';
  }

  // 0 counterexamples
  if (evidenceCount >= 5 && hasVerified) {
    return 'strong';
  } else if (evidenceCount >= 2) {
    return 'moderate';
  }

  return 'weak';
}

/**
 * 3. Detects operating patterns from recurring observations.
 * Requires at least minCount (default 3) occurrences. Never creates a pattern from a single event.
 */
export function detectOperatingPatterns(
  observations: OperatingObservation[],
  minCount: number = 3
): PatternResult[] {
  const groups = new Map<string, OperatingObservation[]>();

  for (const obs of observations) {
    const key = `${obs.domain}::${obs.patternType}::${obs.entityType || 'all'}::${obs.entityId || 'none'}::${obs.outcome}`;
    const existing = groups.get(key) || [];
    existing.push(obs);
    groups.set(key, existing);
  }

  const results: PatternResult[] = [];

  for (const [key, obsList] of groups.entries()) {
    if (obsList.length < minCount) {
      continue;
    }

    const first = obsList[0];
    const obsCount = obsList.length;

    let confidence: PatternConfidence = 'emerging';
    if (obsCount >= 7) {
      confidence = 'strong';
    } else if (obsCount >= 4) {
      confidence = 'supported';
    }

    const domainLabel = first.domain.toUpperCase();
    const typeLabel = first.patternType.replace(/_/g, ' ');

    results.push({
      patternKey: key,
      domain: first.domain,
      patternType: first.patternType,
      entityType: first.entityType,
      entityId: first.entityId,
      observationCount: obsCount,
      counterexampleCount: 0,
      confidence,
      title: `${domainLabel}: Recurring ${typeLabel}`,
      description: `Observed ${obsCount} times: ${first.outcome}`,
      suggestedAction: `Review operating practices in ${first.domain} regarding ${first.patternType}. Consider establishing a formal lesson candidate.`,
      observations: obsList,
    });
  }

  return results;
}

/**
 * 4. Detects conflict between two operating memories/lessons.
 */
export function detectMemoryConflict(
  lessonA: OperatingLesson,
  lessonB: OperatingLesson
): ConflictResult | null {
  if (lessonA.id === lessonB.id) return null;
  if (lessonA.status === 'retired' || lessonB.status === 'retired') return null;
  if (lessonA.status === 'superseded' || lessonB.status === 'superseded') return null;

  // Check scope mismatch: Business vs Personal must never cross-pollinate
  if (lessonA.scope !== lessonB.scope) {
    // If they touch similar domain themes across distinct scopes
    if (lessonA.domain === lessonB.domain) {
      return {
        conflictType: 'scope_mismatch',
        severity: 'high',
        description: `Scope separation violation: Lesson "${lessonA.title}" is ${lessonA.scope} while "${lessonB.title}" is ${lessonB.scope}. Personal context must remain isolated.`,
        lessonAId: lessonA.id,
        lessonBId: lessonB.id,
        recommendedAction: 'reconcile_scopes',
      };
    }
    return null;
  }

  if (lessonA.domain !== lessonB.domain) return null;

  // Simple textual contradiction heuristics
  const textA = `${lessonA.title} ${lessonA.statement}`.toLowerCase();
  const textB = `${lessonB.title} ${lessonB.statement}`.toLowerCase();

  const opposites = [
    ['increase', 'decrease'],
    ['always', 'never'],
    ['approve', 'reject'],
    ['accelerate', 'delay'],
    ['expand', 'contract'],
    ['require', 'optional'],
  ];

  let detectedOpposite = false;
  for (const [wordA, wordB] of opposites) {
    if (
      (textA.includes(wordA) && textB.includes(wordB)) ||
      (textA.includes(wordB) && textB.includes(wordA))
    ) {
      detectedOpposite = true;
      break;
    }
  }

  if (detectedOpposite) {
    return {
      conflictType: 'contradictory_guidance',
      severity: 'high',
      description: `Potential contradiction between "${lessonA.title}" and "${lessonB.title}". Guidance offers conflicting directional advice.`,
      lessonAId: lessonA.id,
      lessonBId: lessonB.id,
      recommendedAction: 'review_and_supersede',
    };
  }

  return null;
}

/**
 * 5. Evaluates memory freshness state based on review dates and age.
 */
export function evaluateMemoryFreshness(
  lesson: Pick<OperatingLesson, 'status' | 'last_reviewed_at' | 'review_at' | 'created_at' | 'effective_until'>,
  currentDate: Date = new Date()
): FreshnessState {
  if (lesson.status === 'superseded') return 'superseded';
  if (lesson.status === 'retired') return 'retired';

  const nowMs = currentDate.getTime();

  // If effective_until has passed
  if (lesson.effective_until) {
    const untilMs = new Date(lesson.effective_until).getTime();
    if (nowMs > untilMs) return 'stale';
  }

  // If review_at is specified
  if (lesson.review_at) {
    const reviewMs = new Date(lesson.review_at).getTime();
    const diffDays = (reviewMs - nowMs) / (1000 * 60 * 60 * 24);

    if (diffDays < 0) return 'review_due';
    if (diffDays <= 14) return 'review_soon';
  }

  // Fallback to last_reviewed_at or created_at age
  const baseDateStr = lesson.last_reviewed_at || lesson.created_at;
  if (baseDateStr) {
    const baseMs = new Date(baseDateStr).getTime();
    const ageDays = (nowMs - baseMs) / (1000 * 60 * 60 * 24);

    if (ageDays > 180) return 'stale';
    if (ageDays > 90) return 'review_soon';
  }

  return 'current';
}

/**
 * 6. Builds a proposed lesson candidate from an observed pattern.
 */
export function buildLessonCandidate(
  pattern: PatternResult,
  scope: MemoryScope = 'business'
): LessonCandidate {
  let confidenceState: ConfidenceState = 'weak';
  if (pattern.confidence === 'strong') confidenceState = 'strong';
  else if (pattern.confidence === 'supported') confidenceState = 'moderate';

  return {
    title: `Lesson: ${pattern.title}`,
    statement: `Based on ${pattern.observationCount} observations: ${pattern.description}`,
    whyProposed: `Pattern detected in ${pattern.domain} with ${pattern.confidence} confidence. Requires human review before operating use.`,
    domain: pattern.domain,
    scope,
    status: 'proposed',
    confidenceState,
    patternKey: pattern.patternKey,
    suggestedUse: pattern.suggestedAction,
    potentialConsequences: `Applying this lesson will guide future actions and decisions in ${pattern.domain}.`,
    evidenceCount: pattern.observationCount,
  };
}

/**
 * 7. Builds a rule proposal from a lesson.
 * Hard safety: Always requires explicit human approval.
 */
export function buildRuleProposal(
  lesson: Pick<OperatingLesson, 'id' | 'title' | 'domain' | 'scope'>,
  ruleType: RuleType,
  currentValue: string | number | boolean | Record<string, unknown>,
  proposedValue: string | number | boolean | Record<string, unknown>,
  options?: {
    expectedEffect?: string;
    risks?: string[];
    rollbackPath?: string;
  }
): RuleProposal {
  return {
    title: `Rule Proposal: Adjust ${ruleType} for ${lesson.title}`,
    ruleType,
    domain: lesson.domain,
    scope: lesson.scope,
    currentValue,
    proposedValue,
    lessonId: lesson.id,
    affectedDomains: [lesson.domain],
    expectedEffect:
      options?.expectedEffect ||
      `Codifies lesson "${lesson.title}" into operational parameter ${ruleType}.`,
    risks: options?.risks || [
      'Potential edge cases where historical conditions differ from new scenarios.',
    ],
    rollbackPath:
      options?.rollbackPath ||
      `Revert ${ruleType} back to ${JSON.stringify(currentValue)} via Learning Rules console.`,
    requiresExplicitApproval: true,
    status: 'proposed',
  };
}

/**
 * 8. Evaluates forecast accuracy against an immutable snapshot.
 * Requires that a snapshot existed prior to actual observation.
 */
export function evaluateForecastAccuracy(
  snapshot: ForecastSnapshot | null | undefined,
  actual: ForecastActual
): ForecastEvaluation {
  if (!snapshot) {
    return {
      hasSnapshot: false,
      metric: 'unknown',
      expectedValue: 0,
      actualValue: actual.actualValue,
      variance: 0,
      variancePercentage: 0,
      direction: 'accurate',
      timingVarianceDays: 0,
      explanation: 'Missing historical snapshot: forecast cannot be calibrated without an immutable baseline.',
    };
  }

  const variance = actual.actualValue - snapshot.expectedValue;
  const variancePercentage =
    snapshot.expectedValue !== 0
      ? (variance / Math.abs(snapshot.expectedValue)) * 100
      : variance === 0
      ? 0
      : 100;

  let direction: 'over' | 'under' | 'accurate' = 'accurate';
  if (Math.abs(variancePercentage) > 5) {
    direction = variance > 0 ? 'over' : 'under';
  }

  const snapDate = new Date(snapshot.snapshotDate).getTime();
  const actDate = new Date(actual.recordedDate).getTime();
  const timingVarianceDays = Math.round((actDate - snapDate) / (1000 * 60 * 60 * 24));

  let calibrationProposal: string | undefined;
  if (Math.abs(variancePercentage) >= 20) {
    calibrationProposal = `Adjust future ${snapshot.metric} planning assumptions in ${snapshot.domain} by ${variance > 0 ? '-' : '+'}${Math.abs(Math.round(variancePercentage / 2))}% to dampen recurring bias.`;
  }

  return {
    hasSnapshot: true,
    metric: snapshot.metric,
    expectedValue: snapshot.expectedValue,
    actualValue: actual.actualValue,
    variance,
    variancePercentage,
    direction,
    timingVarianceDays,
    calibrationProposal,
    explanation: `Forecast for ${snapshot.metric}: expected ${snapshot.expectedValue}, observed ${actual.actualValue} (variance: ${variance > 0 ? '+' : ''}${variance.toFixed(2)}, ${variancePercentage.toFixed(1)}%).`,
  };
}

/**
 * 9. Evaluates decision outcome separating process quality from outcome quality.
 */
export function evaluateDecisionOutcome(
  decision: DecisionRecord,
  actual: DecisionActualOutcome
): DecisionOutcomeState {
  const validated = actual.validatedAssumptions?.length || 0;
  const invalidated = actual.invalidatedAssumptions?.length || 0;

  const candidateLessons: string[] = [];
  const nextTimeConsiderations: string[] = [];

  if (actual.outcomeQuality === 'unsuccessful') {
    if (decision.processQuality === 'rushed' || decision.processQuality === 'insufficient_data') {
      candidateLessons.push(
        `Ensure comprehensive data collection and deliberation for ${decision.domain} decisions before committing.`
      );
    } else {
      candidateLessons.push(
        `Investigate unpredictable external variables affecting ${decision.domain} decisions.`
      );
    }
    nextTimeConsiderations.push('Add an explicit pre-mortem review to future decisions in this category.');
  } else if (actual.outcomeQuality === 'successful') {
    candidateLessons.push(
      `Reinforce validated assumptions in ${decision.domain}: ${(actual.validatedAssumptions || []).join(', ') || 'Process succeeded'}.`
    );
  }

  return {
    decisionId: decision.id,
    processQuality: decision.processQuality,
    outcomeQuality: actual.outcomeQuality,
    assumptionsValidatedCount: validated,
    assumptionsInvalidatedCount: invalidated,
    summary: `Decision "${decision.title}": Process was ${decision.processQuality}, outcome was ${actual.outcomeQuality}.`,
    lessonCandidates: candidateLessons,
    nextTimeConsiderations,
  };
}

/**
 * 10. Evaluates action outcome, strictly distinguishing execution from outcome.
 */
export function evaluateActionOutcome(
  execution: ActionExecutionReceipt,
  observedOutcome: ActionOutcomeRecord
): ActionOutcomeState {
  const distinctionNote =
    execution.executed && !observedOutcome.achieved
      ? 'Execution succeeded mechanically, but intended business outcome was NOT achieved.'
      : execution.executed && observedOutcome.achieved
      ? 'Both execution and intended business outcome succeeded.'
      : 'Action outcome pending or incomplete.';

  const needsReview = execution.executed && (observedOutcome.outcomeState === 'not_achieved' || observedOutcome.outcomeState === 'worse');

  return {
    actionId: execution.actionId,
    executionSucceeded: execution.executed && execution.status === 'succeeded',
    outcomeAchieved: observedOutcome.achieved,
    outcomeState: observedOutcome.outcomeState,
    distinctionNote,
    needsReview,
  };
}

/**
 * 11. Detects repeated recommendation feedback signals.
 * Crucial rule: Single negative feedback does NOT trigger a rule change.
 */
export function detectRepeatedRecommendationFeedback(
  feedback: RecommendationFeedbackItem[]
): FeedbackSignal[] {
  const groups = new Map<string, { negative: number; positive: number; domain: LearningDomain }>();

  for (const item of feedback) {
    const key = `${item.domain}::${item.recommendationType}`;
    const cur = groups.get(key) || { negative: 0, positive: 0, domain: item.domain };

    if (item.rating === 'not_useful' || item.rating === 'wrong') {
      cur.negative += 1;
    } else if (item.rating === 'helpful') {
      cur.positive += 1;
    }
    groups.set(key, cur);
  }

  const signals: FeedbackSignal[] = [];

  for (const [key, val] of groups.entries()) {
    const parts = key.split('::');
    const recType = parts[1];

    let signalStrength: 'weak' | 'moderate' | 'strong' = 'weak';
    if (val.negative >= 5) signalStrength = 'strong';
    else if (val.negative >= 3) signalStrength = 'moderate';

    // Must have at least 3 negative feedbacks to trigger rule review
    const triggersRuleReview = val.negative >= 3;

    signals.push({
      recommendationType: recType,
      domain: val.domain,
      negativeCount: val.negative,
      positiveCount: val.positive,
      signalStrength,
      triggersRuleReview,
      summary: `${recType} in ${val.domain}: ${val.positive} helpful, ${val.negative} unhelpful ratings.`,
    });
  }

  return signals;
}

/**
 * 12. Builds Monthly Learning Review artifact.
 */
export function buildMonthlyLearningReview(params: MonthlyReviewParams): MonthlyReview {
  const accepted = params.lessons.filter((l) => l.status === 'accepted').length;
  const rejected = params.lessons.filter((l) => l.status === 'rejected').length;
  const staleCount = params.lessons.filter((l) => evaluateMemoryFreshness(l) === 'stale').length;

  const highlights: string[] = [
    `Processed ${params.lessons.length} lessons (${accepted} accepted, ${rejected} rejected).`,
    `Detected ${params.patterns.length} recurring operating patterns.`,
    `Evaluated ${params.forecastMisses.length} forecast variances.`,
    `Reviewed ${params.decisionOutcomes.length} decision outcomes and ${params.actionOutcomes.length} action outcomes.`,
  ];

  return {
    month: params.month,
    totalNewLessons: params.lessons.length,
    acceptedLessons: accepted,
    rejectedLessons: rejected,
    recurringPatterns: params.patterns,
    forecastMisses: params.forecastMisses,
    decisionOutcomes: params.decisionOutcomes,
    actionOutcomes: params.actionOutcomes,
    ruleProposals: params.ruleProposals,
    staleMemoriesCount: staleCount,
    highlights,
  };
}

/**
 * 13. Builds Quarterly Learning Review artifact.
 */
export function buildQuarterlyLearningReview(params: QuarterlyReviewParams): QuarterlyReview {
  const whatBecamePredictable: string[] = [];
  const whatStayedUnpredictable: string[] = [];
  const repeatedMistakes: string[] = [];
  const repeatedSuccesses: string[] = [];
  const assumptionsToChange: string[] = [];
  const processesToImprove: string[] = [];
  const rulesToReview: string[] = [];
  const knowledgeToRetire: string[] = [];

  for (const mr of params.monthlyReviews) {
    for (const pat of mr.recurringPatterns) {
      if (pat.confidence === 'strong') {
        whatBecamePredictable.push(`${pat.title}: recurring in ${pat.domain}`);
      } else {
        whatStayedUnpredictable.push(`${pat.title}: high variance remains in ${pat.domain}`);
      }
    }

    for (const dec of mr.decisionOutcomes) {
      if (dec.outcomeQuality === 'unsuccessful') {
        repeatedMistakes.push(dec.summary);
      } else if (dec.outcomeQuality === 'successful') {
        repeatedSuccesses.push(dec.summary);
      }
    }

    for (const rule of mr.ruleProposals) {
      rulesToReview.push(rule.title);
    }
  }

  for (const stale of params.staleLessons) {
    knowledgeToRetire.push(`Stale lesson: "${stale.title}" in ${stale.domain}`);
  }

  return {
    quarter: params.quarter,
    whatBecamePredictable: Array.from(new Set(whatBecamePredictable)),
    whatStayedUnpredictable: Array.from(new Set(whatStayedUnpredictable)),
    repeatedMistakes: Array.from(new Set(repeatedMistakes)),
    repeatedSuccesses: Array.from(new Set(repeatedSuccesses)),
    assumptionsToChange: Array.from(new Set(assumptionsToChange)),
    processesToImprove: Array.from(new Set(processesToImprove)),
    rulesToReview: Array.from(new Set(rulesToReview)),
    knowledgeToRetire: Array.from(new Set(knowledgeToRetire)),
  };
}

/**
 * 14. Ranks learning review queue items by urgency and impact.
 */
export function rankLearningReviewQueue(items: ReviewQueueItem[]): ReviewQueueItem[] {
  const typeWeight: Record<ReviewQueueItem['itemType'], number> = {
    conflict: 100,
    rule_proposal: 80,
    stale_lesson: 60,
    proposed_lesson: 50,
    forecast_miss: 40,
    retrospective_due: 30,
  };

  const urgencyWeight: Record<ReviewQueueItem['urgency'], number> = {
    critical: 40,
    high: 30,
    medium: 20,
    low: 10,
  };

  return [...items].sort((a, b) => {
    const scoreA = typeWeight[a.itemType] + urgencyWeight[a.urgency] - a.priority;
    const scoreB = typeWeight[b.itemType] + urgencyWeight[b.urgency] - b.priority;
    return scoreB - scoreA;
  });
}

/**
 * Helper to filter lessons safely for a given context scope.
 * Guarantees that personal memories are strictly excluded from business queries.
 */
export function filterLessonsByScope(
  lessons: OperatingLesson[],
  requestedScope: MemoryScope
): OperatingLesson[] {
  if (requestedScope === 'business') {
    return lessons.filter((l) => l.scope === 'business');
  }
  // Personal scope queries may see personal lessons
  return lessons.filter((l) => l.scope === 'personal');
}
