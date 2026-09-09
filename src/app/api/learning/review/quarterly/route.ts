import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { apiError } from "@/lib/api";
import { loadLessons, loadPatterns, loadForecasts, loadRuleProposals } from "@/lib/learning-server";
import {
  buildMonthlyLearningReview,
  buildQuarterlyLearningReview,
  evaluateMemoryFreshness,
  type PatternResult,
  type ForecastEvaluation,
  type RuleProposal,
  type LearningDomain,
  type PatternType,
  type PatternConfidence,
} from "@/lib/learning";

export async function GET(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const { searchParams } = new URL(request.url);
    const quarter = searchParams.get("quarter") || "2026-Q3";

    const [lessons, patterns, forecasts, rules] = await Promise.all([
      loadLessons(supabase, userId),
      loadPatterns(supabase, userId),
      loadForecasts(supabase, userId),
      loadRuleProposals(supabase, userId),
    ]);

    const dummyMonth = buildMonthlyLearningReview({
      month: quarter,
      lessons,
      patterns: patterns.map((p) => {
        const row = p as Record<string, unknown>;
        return {
          patternKey: String(row.pattern_key || row.id || ""),
          domain: (row.domain as LearningDomain) || "operations",
          patternType: (row.pattern_type as PatternType) || "process",
          entityType: row.entity_type as string | undefined,
          entityId: row.entity_id as string | undefined,
          observationCount: (row.observation_count as number) || 1,
          counterexampleCount: (row.counterexample_count as number) || 0,
          confidence: (row.confidence as PatternConfidence) || "emerging",
          title: String(row.title || ""),
          description: String(row.description || ""),
          suggestedAction: String(row.suggested_action || ""),
          observations: [],
        };
      }) as PatternResult[],
      forecastMisses: forecasts as unknown as ForecastEvaluation[],
      decisionOutcomes: [],
      actionOutcomes: [],
      ruleProposals: rules as unknown as RuleProposal[],
    });

    const staleLessons = lessons.filter((l) => evaluateMemoryFreshness(l) === "stale");

    const review = buildQuarterlyLearningReview({
      quarter,
      monthlyReviews: [dummyMonth],
      staleLessons,
      allLessons: lessons,
    });

    return NextResponse.json(review);
  } catch (error) {
    return apiError(error, "Failed to build quarterly learning review.");
  }
}
