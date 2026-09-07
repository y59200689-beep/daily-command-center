export type Freshness = "current" | "review_soon" | "stale" | "no_rule";

export function sourceFreshness(expiresAt?: string | null, today = new Date().toISOString().slice(0, 10)): Freshness {
  if (!expiresAt) return "no_rule";
  const days = Math.ceil((Date.parse(`${expiresAt}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  return days < 0 ? "stale" : days <= 14 ? "review_soon" : "current";
}

export function topicHealth(input: { findings: number; supported: number; contradictions: number; openQuestions: number; staleSources: number; nextReviewAt?: string | null }, today = new Date().toISOString().slice(0, 10)) {
  if (input.contradictions) return "contradictory";
  if (input.staleSources || (input.nextReviewAt && input.nextReviewAt < today)) return "outdated";
  if (!input.findings || !input.supported || input.openQuestions) return "needs_evidence";
  return "well_supported";
}

export type ResearchQueueItem = { id: string; title: string; reason: string; route: string; score: number };
export function rankResearchQueue(items: ResearchQueueItem[]) { return [...items].sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, 7); }

export function decisionReadiness(input: { findings: number; supporting: number; contradicting: number; openQuestions: number }) {
  if (input.contradicting) return "contradictory_evidence";
  if (input.openQuestions) return "open_questions_remain";
  if (!input.findings || !input.supporting) return "needs_evidence";
  return "ready_to_decide";
}

export const safeKnowledgeLinkTypes = ["project","client","lead","opportunity","proposal","campaign","content","goal","decision","roadmap_item","product","supplier","trip","commitment","milestone","note","attachment"] as const;
