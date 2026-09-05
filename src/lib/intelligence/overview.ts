import { assessClientHealth, assessProjectHealth } from "@/lib/intelligence/health";
import { getContentIntelligence, getFinancialIntelligence, getFitnessIntelligence } from "@/lib/intelligence/domain-intelligence";
import { calculateCapacity, getAvailableFocusWindows } from "@/lib/intelligence/planning";
import { detectPatterns, generatePredictions } from "@/lib/intelligence/patterns";
import { applyInsightFeedback, generateRecommendations } from "@/lib/intelligence/recommendations";
import { detectRisks } from "@/lib/intelligence/risk-engine";
import type { IntelligenceOverview, WorkspaceSnapshot } from "@/lib/intelligence/types";
import { duration } from "@/lib/intelligence/planning";
import { asString } from "@/lib/intelligence/time";

const categoryFor = (entityType: string) => entityType === "invoice" || entityType === "client" ? "finance" : entityType === "content" || entityType === "campaign" ? "content" : entityType === "decision" ? "decisions" : entityType === "fitness" ? "fitness" : entityType === "waiting" ? "waiting" : "projects";
const minimumScore: Record<string, number> = { low: 0, medium: 35, high: 60, critical: 80 };
function preferenceAllows(snapshot: WorkspaceSnapshot, entityType: string, score: number) {
  const preference = snapshot.notificationPreferences.find((item) => item.category === categoryFor(entityType));
  return !preference || (preference.enabled !== false && score >= (minimumScore[asString(preference.minimum_severity, "medium")] ?? 35));
}

export function buildIntelligenceOverview(snapshot: WorkspaceSnapshot): IntelligenceOverview {
  const capacity = calculateCapacity(snapshot);
  const focusWindows = getAvailableFocusWindows(snapshot);
  const recommendations = applyInsightFeedback(generateRecommendations(snapshot), snapshot.feedback, new Date(snapshot.now)).filter((item) => preferenceAllows(snapshot, item.entityType, item.priority));
  const projectHealth = assessProjectHealth(snapshot, recommendations);
  const clientHealth = assessClientHealth(snapshot, recommendations);
  const risks = detectRisks(snapshot, capacity).filter((item) => preferenceAllows(snapshot, item.entityType, ({ low: 20, medium: 45, high: 65, critical: 85 })[item.severity]));
  const finance = getFinancialIntelligence(snapshot);
  const content = getContentIntelligence(snapshot);
  const fitness = getFitnessIntelligence(snapshot);
  const meetingMinutes = capacity.meetingMinutes;
  const mode = meetingMinutes >= 180 ? "meeting_heavy" : finance.overdueAmount >= 1000 ? "finance_heavy" : content.dueSoon >= 2 ? "content_deadline" : focusWindows.some((window) => window.minutes >= 90) ? "deep_work" : "balanced";
  const top = recommendations[0];
  const headline = top?.label ?? (focusWindows[0] ? `Protect the ${duration(focusWindows[0].minutes)} focus window` : "Choose one meaningful next action");
  const summaryParts = [
    focusWindows[0] ? `You have a ${duration(focusWindows[0].minutes)} focus window available` : "Your calendar has no remaining focus window longer than 25 minutes",
    top ? `the best use is ${top.label.toLowerCase()}` : "select a priority before adding more work",
    top?.reason ? `because ${top.reason.toLowerCase()}` : "",
  ].filter(Boolean);
  return { mode, headline, summary: `${summaryParts.join("; ")}.`, attentionQueue: recommendations.filter((item) => item.priority >= 45).slice(0, 5), recommendations, risks, projectHealth, clientHealth, capacity, focusWindows, finance, content, fitness, patterns: detectPatterns(snapshot), predictions: generatePredictions(snapshot) };
}

export function adaptiveModules(overview: IntelligenceOverview) {
  const common = ["top_priority", "next_event", "needs_attention"];
  if (overview.mode === "meeting_heavy") return [...common, "meeting_prep", "short_tasks", "client_followups"];
  if (overview.mode === "finance_heavy") return [...common, "overdue_invoices", "expected_payments", "payment_reminders"];
  if (overview.mode === "content_deadline") return [...common, "content_deadlines", "approval_blockers", "campaign_progress"];
  if (overview.mode === "deep_work") return [...common, "focus_window", "project_momentum", "followup", "fitness"];
  return [...common, "focus_window", "project_momentum", "finance", "fitness"];
}

export function entityIntelligence(overview: IntelligenceOverview, entityType: "project" | "client", entityId: string) {
  const health = entityType === "project" ? overview.projectHealth.find((item) => item.entityId === entityId) : overview.clientHealth.find((item) => item.entityId === entityId);
  return { health: health ?? null, nextAction: health?.nextAction ?? overview.recommendations.find((item) => item.entityType === entityType && item.entityId === entityId) ?? null, risks: overview.risks.filter((item) => item.entityType === entityType && item.entityId === entityId) };
}
