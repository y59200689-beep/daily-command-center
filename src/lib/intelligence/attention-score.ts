import type { AttentionReason, AttentionScore } from "@/lib/intelligence/types";
import { clamp } from "@/lib/intelligence/time";

export type AttentionSignals = {
  overdueDays?: number;
  dueInDays?: number | null;
  financialAmount?: number;
  priority?: string;
  projectImportance?: string;
  blocked?: boolean;
  waitingDays?: number;
  calendarInMinutes?: number | null;
  postponements?: number;
  missedMilestones?: number;
  clientImportance?: string;
  unresolvedFollowups?: number;
  daysSinceFocus?: number | null;
  decisionReviewInDays?: number | null;
  contentStageRisk?: boolean;
  paymentDelayDays?: number;
  goalRelevant?: boolean;
};

function add(reasons: AttentionReason[], key: string, weight: number, reason: string) {
  if (weight > 0) reasons.push({ key, weight, reason });
}

export function scoreAttention(signals: AttentionSignals): AttentionScore {
  const reasons: AttentionReason[] = [];
  if ((signals.overdueDays ?? 0) > 0) add(reasons, "overdue", Math.min(34, 23 + (signals.overdueDays ?? 0)), `${signals.overdueDays} day${signals.overdueDays === 1 ? "" : "s"} overdue`);
  else if (signals.dueInDays !== null && signals.dueInDays !== undefined && signals.dueInDays <= 7) {
    const days = signals.dueInDays;
    add(reasons, "deadline", days <= 0 ? 22 : days === 1 ? 18 : Math.max(6, 16 - days * 2), days === 0 ? "Due today" : days === 1 ? "Due tomorrow" : `Due in ${days} days`);
  }
  const priorityWeight: Record<string, number> = { urgent: 20, high: 14, medium: 8, low: 3, none: 0 };
  add(reasons, "priority", priorityWeight[signals.priority ?? "none"] ?? 0, `${signals.priority} priority`);
  const projectWeight: Record<string, number> = { urgent: 12, high: 9, medium: 5, low: 2, none: 0 };
  add(reasons, "project_importance", projectWeight[signals.projectImportance ?? "none"] ?? 0, "Connected to an important project");
  if (signals.blocked) add(reasons, "blocked", 16, "Blocked work is holding progress");
  if ((signals.waitingDays ?? 0) >= 2) add(reasons, "waiting", Math.min(13, 3 + Math.floor((signals.waitingDays ?? 0) / 2)), `Waiting for ${signals.waitingDays} days`);
  if (signals.calendarInMinutes !== null && signals.calendarInMinutes !== undefined && signals.calendarInMinutes >= 0 && signals.calendarInMinutes <= 120) add(reasons, "calendar", signals.calendarInMinutes <= 30 ? 14 : 8, `Related event starts in ${signals.calendarInMinutes} minutes`);
  if ((signals.postponements ?? 0) > 0) add(reasons, "postponed", Math.min(16, (signals.postponements ?? 0) * 5), `Postponed ${signals.postponements} time${signals.postponements === 1 ? "" : "s"}`);
  if ((signals.missedMilestones ?? 0) > 0) add(reasons, "milestone", Math.min(20, 12 + (signals.missedMilestones ?? 0) * 4), `${signals.missedMilestones} missed or blocked milestone${signals.missedMilestones === 1 ? "" : "s"}`);
  if (["high", "critical"].includes(signals.clientImportance ?? "")) add(reasons, "client", 10, "Important client relationship");
  if ((signals.unresolvedFollowups ?? 0) > 0) add(reasons, "followup", Math.min(15, 7 + (signals.unresolvedFollowups ?? 0) * 3), `${signals.unresolvedFollowups} unresolved follow-up${signals.unresolvedFollowups === 1 ? "" : "s"}`);
  if (signals.daysSinceFocus !== null && signals.daysSinceFocus !== undefined && signals.daysSinceFocus >= 4) add(reasons, "focus_gap", Math.min(14, 5 + signals.daysSinceFocus), `No focus time in ${signals.daysSinceFocus} days`);
  if (signals.decisionReviewInDays !== null && signals.decisionReviewInDays !== undefined && signals.decisionReviewInDays <= 2) add(reasons, "decision_review", signals.decisionReviewInDays < 0 ? 16 : 11, signals.decisionReviewInDays < 0 ? "Decision review is overdue" : signals.decisionReviewInDays === 0 ? "Decision review is due today" : "Decision review is due soon");
  if (signals.contentStageRisk) add(reasons, "content_stage", 15, "Workflow stage is behind its deadline");
  if ((signals.paymentDelayDays ?? 0) > 0) add(reasons, "payment_delay", Math.min(24, 12 + (signals.paymentDelayDays ?? 0)), `Payment is ${signals.paymentDelayDays} days late`);
  if ((signals.financialAmount ?? 0) >= 500) add(reasons, "financial_impact", Math.min(20, 4 + Math.floor(Math.log10(signals.financialAmount ?? 1) * 4)), "Meaningful financial impact");
  if (signals.goalRelevant) add(reasons, "goal", 7, "Directly supports an active goal");
  reasons.sort((a, b) => b.weight - a.weight || a.key.localeCompare(b.key));
  return { score: clamp(reasons.reduce((total, item) => total + item.weight, 0), 0, 100), reasons };
}
