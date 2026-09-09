import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type OperatingLesson,
  type LessonEvidenceLink,
  type PatternResult,
  type ConflictResult,
  type FreshnessState,
  type ReviewQueueItem,
  type MemoryScope,
  type LearningDomain,
  evaluateMemoryFreshness,
  detectMemoryConflict,
  rankLearningReviewQueue,
  filterLessonsByScope,
} from "./learning";

export interface LearningOverviewData {
  acceptedLessonsCount: number;
  proposedLessonsCount: number;
  activePatternsCount: number;
  activeRulesCount: number;
  staleMemoriesCount: number;
  conflictsCount: number;
  reviewQueue: ReviewQueueItem[];
  topSignal?: {
    type: "conflict" | "stale" | "rule_proposal" | "pattern";
    title: string;
    description: string;
    path: string;
  };
  recentLessons: OperatingLesson[];
  recentPatterns: PatternResult[];
}

export async function loadLearningOverview(
  supabase: SupabaseClient,
  userId: string,
  scope: MemoryScope = "business"
): Promise<LearningOverviewData> {
  const [lessonsRes, patternsRes, rulesRes] = await Promise.all([
    supabase
      .from("operating_lessons")
      .select("*")
      .eq("user_id", userId)
      .limit(100),
    supabase
      .from("operating_patterns")
      .select("*")
      .eq("user_id", userId)
      .limit(50),
    supabase
      .from("learning_rule_proposals")
      .select("*")
      .eq("user_id", userId)
      .limit(50),
  ]);

  const rawLessons: OperatingLesson[] = (lessonsRes.data as OperatingLesson[]) || [];
  const lessons = filterLessonsByScope(rawLessons, scope);
  const patterns: PatternResult[] = ((patternsRes.data as unknown[]) || []).map((p) => {
    const row = p as Record<string, unknown>;
    return ({
    patternKey: String(row.pattern_key || row.id || ""),
    domain: row.domain as LearningDomain,
    patternType: row.pattern_type as PatternResult["patternType"],
    entityType: row.entity_type as string | undefined,
    entityId: row.entity_id as string | undefined,
    observationCount: (row.observation_count as number) || 1,
    counterexampleCount: (row.counterexample_count as number) || 0,
    confidence: (row.confidence as PatternResult["confidence"]) || "emerging",
    title: row.title as string,
    description: row.description as string,
    suggestedAction: String(row.suggested_action || ""),
    observations: [],
  });
  });
  const rawRules = (rulesRes.data as Record<string, unknown>[]) || [];

  const acceptedLessons = lessons.filter((l) => l.status === "accepted");
  const proposedLessons = lessons.filter((l) => l.status === "proposed");
  const staleLessons = lessons.filter((l) => evaluateMemoryFreshness(l) === "stale");
  const activeRules = rawRules.filter((r) => r.status === "accepted");
  const proposedRules = rawRules.filter((r) => r.status === "proposed");

  // Detect conflicts between accepted lessons
  const conflicts: ConflictResult[] = [];
  for (let i = 0; i < acceptedLessons.length; i++) {
    for (let j = i + 1; j < acceptedLessons.length; j++) {
      const conflict = detectMemoryConflict(acceptedLessons[i], acceptedLessons[j]);
      if (conflict) {
        conflicts.push(conflict);
      }
    }
  }

  // Build review queue
  const queueItems: ReviewQueueItem[] = [];

  for (const c of conflicts) {
    queueItems.push({
      id: `conflict-${c.lessonAId}-${c.lessonBId}`,
      itemType: "conflict",
      priority: 1,
      title: `Memory Conflict: Guidance Discrepancy`,
      domain: (lessons.find((l) => l.id === c.lessonAId)?.domain || "operations") as LearningDomain,
      urgency: "critical",
      reason: c.description,
      targetPath: `/learning/review`,
    });
  }

  for (const r of proposedRules) {
    const row = r as Record<string, unknown>;
    queueItems.push({
      id: `rule-${row.id}`,
      itemType: "rule_proposal",
      priority: 2,
      title: String(row.title || "Proposed Rule"),
      domain: (row.domain as LearningDomain) || "operations",
      urgency: "high",
      reason: String(row.expected_effect || "Proposed rule change requires approval."),
      targetPath: `/learning/rules/${row.id}`,
    });
  }

  for (const l of staleLessons) {
    queueItems.push({
      id: `stale-${l.id}`,
      itemType: "stale_lesson",
      priority: 3,
      title: `Stale Memory: ${l.title}`,
      domain: l.domain,
      urgency: "medium",
      reason: "Memory has not been reviewed within recommended cadence (>180 days).",
      targetPath: `/learning/lessons/${l.id}`,
    });
  }

  for (const l of proposedLessons) {
    queueItems.push({
      id: `prop-${l.id}`,
      itemType: "proposed_lesson",
      priority: 4,
      title: `Proposed Lesson: ${l.title}`,
      domain: l.domain,
      urgency: "medium",
      reason: l.why_proposed,
      targetPath: `/learning/lessons/${l.id}`,
    });
  }

  const reviewQueue = rankLearningReviewQueue(queueItems);

  let topSignal: LearningOverviewData["topSignal"] = undefined;
  if (conflicts.length > 0) {
    topSignal = {
      type: "conflict",
      title: "Contradictory Operating Guidance Detected",
      description: conflicts[0].description,
      path: "/learning/review",
    };
  } else if (proposedRules.length > 0) {
    const r0 = proposedRules[0] as Record<string, unknown>;
    topSignal = {
      type: "rule_proposal",
      title: String(r0.title || "Proposed Rule"),
      description: String(r0.expected_effect || "Rule change awaiting review."),
      path: `/learning/rules/${r0.id}`,
    };
  } else if (staleLessons.length > 0) {
    topSignal = {
      type: "stale",
      title: `${staleLessons.length} Operating Lessons Due for Review`,
      description: `Old memory may no longer reflect current realities.`,
      path: "/learning/memory",
    };
  }

  return {
    acceptedLessonsCount: acceptedLessons.length,
    proposedLessonsCount: proposedLessons.length,
    activePatternsCount: patterns.length,
    activeRulesCount: activeRules.length,
    staleMemoriesCount: staleLessons.length,
    conflictsCount: conflicts.length,
    reviewQueue,
    topSignal,
    recentLessons: lessons.slice(0, 10),
    recentPatterns: patterns.slice(0, 10),
  };
}

export async function loadLessons(
  supabase: SupabaseClient,
  userId: string,
  filters?: {
    domain?: string;
    status?: string;
    scope?: MemoryScope;
    confidence?: string;
  }
): Promise<OperatingLesson[]> {
  let query = supabase
    .from("operating_lessons")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (filters?.domain) query = query.eq("domain", filters.domain);
  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.confidence) query = query.eq("confidence_state", filters.confidence);

  const res = await query.limit(100);
  const lessons = (res.data as OperatingLesson[]) || [];
  return filterLessonsByScope(lessons, filters?.scope || "business");
}

export async function loadLessonDetail(
  supabase: SupabaseClient,
  userId: string,
  lessonId: string
): Promise<{
  lesson: OperatingLesson | null;
  evidence: LessonEvidenceLink[];
  entities: Record<string, unknown>[];
  auditLog: Record<string, unknown>[];
}> {
  const [lessonRes, evidenceRes, entityRes, auditRes] = await Promise.all([
    supabase
      .from("operating_lessons")
      .select("*")
      .eq("user_id", userId)
      .eq("id", lessonId)
      .maybeSingle(),
    supabase
      .from("lesson_evidence_links")
      .select("*")
      .eq("user_id", userId)
      .eq("lesson_id", lessonId)
      .order("created_at", { ascending: true }),
    supabase
      .from("lesson_entity_links")
      .select("*")
      .eq("user_id", userId)
      .eq("lesson_id", lessonId),
    supabase
      .from("lesson_reviews")
      .select("*")
      .eq("user_id", userId)
      .eq("lesson_id", lessonId)
      .order("reviewed_at", { ascending: false }),
  ]);

  return {
    lesson: lessonRes.data as OperatingLesson | null,
    evidence: (evidenceRes.data as LessonEvidenceLink[]) || [],
    entities: entityRes.data || [],
    auditLog: auditRes.data || [],
  };
}

export async function loadPatterns(
  supabase: SupabaseClient,
  userId: string,
  filters?: { domain?: string; patternType?: string }
): Promise<Record<string, unknown>[]> {
  let query = supabase
    .from("operating_patterns")
    .select("*")
    .eq("user_id", userId)
    .order("observation_count", { ascending: false });

  if (filters?.domain) query = query.eq("domain", filters.domain);
  if (filters?.patternType) query = query.eq("pattern_type", filters.patternType);

  const res = await query.limit(50);
  return res.data || [];
}

export async function loadPatternDetail(
  supabase: SupabaseClient,
  userId: string,
  patternId: string
): Promise<{ pattern: Record<string, unknown> | null; evidence: Record<string, unknown>[]; counterexamples: Record<string, unknown>[] }> {
  const [patRes, evRes, cntRes] = await Promise.all([
    supabase
      .from("operating_patterns")
      .select("*")
      .eq("user_id", userId)
      .eq("id", patternId)
      .maybeSingle(),
    supabase
      .from("pattern_evidence")
      .select("*")
      .eq("user_id", userId)
      .eq("pattern_id", patternId)
      .order("observed_at", { ascending: false }),
    supabase
      .from("pattern_counterexamples")
      .select("*")
      .eq("user_id", userId)
      .eq("pattern_id", patternId)
      .order("observed_at", { ascending: false }),
  ]);

  return {
    pattern: patRes.data,
    evidence: evRes.data || [],
    counterexamples: cntRes.data || [],
  };
}

export async function loadRetrospectives(
  supabase: SupabaseClient,
  userId: string,
  retroType?: string
): Promise<Record<string, unknown>[]> {
  let query = supabase
    .from("retrospectives")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (retroType) query = query.eq("retro_type", retroType);

  const res = await query.limit(50);
  return res.data || [];
}

export async function loadRetrospectiveDetail(
  supabase: SupabaseClient,
  userId: string,
  retrospectiveId: string
): Promise<{ retrospective: Record<string, unknown> | null; items: Record<string, unknown>[] }> {
  const [retRes, itemsRes] = await Promise.all([
    supabase
      .from("retrospectives")
      .select("*")
      .eq("user_id", userId)
      .eq("id", retrospectiveId)
      .maybeSingle(),
    supabase
      .from("retrospective_items")
      .select("*")
      .eq("user_id", userId)
      .eq("retrospective_id", retrospectiveId)
      .order("order_index", { ascending: true }),
  ]);

  return {
    retrospective: retRes.data,
    items: itemsRes.data || [],
  };
}

export async function loadForecasts(
  supabase: SupabaseClient,
  userId: string,
  domain?: string
): Promise<Record<string, unknown>[]> {
  let query = supabase
    .from("forecast_evaluations")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (domain) query = query.eq("domain", domain);

  const res = await query.limit(50);
  return res.data || [];
}

export async function loadRuleProposals(
  supabase: SupabaseClient,
  userId: string,
  status?: string
): Promise<Record<string, unknown>[]> {
  let query = supabase
    .from("learning_rule_proposals")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);

  const res = await query.limit(50);
  return res.data || [];
}

export async function loadRuleProposalDetail(
  supabase: SupabaseClient,
  userId: string,
  ruleId: string
): Promise<Record<string, unknown> | null> {
  const res = await supabase
    .from("learning_rule_proposals")
    .select("*, operating_lessons(title, statement, domain)")
    .eq("user_id", userId)
    .eq("id", ruleId)
    .maybeSingle();

  return res.data;
}

export async function loadOperatingMemory(
  supabase: SupabaseClient,
  userId: string,
  scope: MemoryScope = "business"
): Promise<{
  lessons: (OperatingLesson & { freshness: FreshnessState })[];
  rules: Record<string, unknown>[];
  patterns: Record<string, unknown>[];
}> {
  const [lessonsRes, rulesRes, patternsRes] = await Promise.all([
    supabase
      .from("operating_lessons")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "accepted")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("learning_rule_proposals")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "accepted")
      .limit(50),
    supabase
      .from("operating_patterns")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active")
      .limit(50),
  ]);

  const rawLessons = (lessonsRes.data as OperatingLesson[]) || [];
  const scopedLessons = filterLessonsByScope(rawLessons, scope);

  const lessonsWithFreshness = scopedLessons.map((l) => ({
    ...l,
    freshness: evaluateMemoryFreshness(l),
  }));

  return {
    lessons: lessonsWithFreshness,
    rules: rulesRes.data || [],
    patterns: patternsRes.data || [],
  };
}

export async function loadTopLearningSignal(
  supabase: SupabaseClient,
  userId: string
): Promise<{ title: string; description: string; path: string; domain: string } | null> {
  // Check for critical conflict or high confidence pattern or urgent review
  const lessonsRes = await supabase
    .from("operating_lessons")
    .select("*")
    .eq("user_id", userId)
    .eq("scope", "business")
    .limit(20);

  const lessons = (lessonsRes.data as OperatingLesson[]) || [];
  const accepted = lessons.filter((l) => l.status === "accepted");

  for (let i = 0; i < accepted.length; i++) {
    for (let j = i + 1; j < accepted.length; j++) {
      const conflict = detectMemoryConflict(accepted[i], accepted[j]);
      if (conflict) {
        return {
          title: "Memory Conflict Detected",
          description: conflict.description,
          path: "/learning/review",
          domain: accepted[i].domain,
        };
      }
    }
  }

  // Fallback: check for strong pattern
  const patternsRes = await supabase
    .from("operating_patterns")
    .select("*")
    .eq("user_id", userId)
    .eq("confidence", "strong")
    .limit(1);

  if (patternsRes.data && patternsRes.data.length > 0) {
    const pat = patternsRes.data[0];
    return {
      title: `Learning Pattern: ${pat.title}`,
      description: pat.description,
      path: `/learning/patterns/${pat.id}`,
      domain: pat.domain,
    };
  }

  return null;
}
