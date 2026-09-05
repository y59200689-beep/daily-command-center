export type IntelligenceEntityType =
  | "task"
  | "project"
  | "client"
  | "invoice"
  | "content"
  | "campaign"
  | "decision"
  | "goal"
  | "waiting"
  | "calendar_event"
  | "fitness";

export type Severity = "low" | "medium" | "high" | "critical";
export type EvidenceConfidence = "limited" | "moderate" | "strong";
export type WorkspaceRow = Record<string, unknown> & { id: string };

export type Evidence = {
  label: string;
  value?: string;
  sourceEntityType?: string;
  sourceEntityId?: string;
};

export type AttentionReason = {
  key: string;
  weight: number;
  reason: string;
  evidence?: Evidence;
};

export type AttentionScore = {
  score: number;
  reasons: AttentionReason[];
};

export type Recommendation = {
  key: string;
  actionType: string;
  entityType: IntelligenceEntityType;
  entityId: string;
  label: string;
  reason: string;
  priority: number;
  route: string;
  evidence: Evidence[];
  recommendedAt: string;
  expiresAt: string | null;
};

export type Risk = {
  key: string;
  entityType: IntelligenceEntityType;
  entityId: string;
  severity: Severity;
  title: string;
  reason: string;
  evidence: Evidence[];
  recommendedAction: string;
  route: string;
};

export type HealthAssessment = {
  entityType: "project" | "client";
  entityId: string;
  name: string;
  state: "Healthy" | "Needs Attention" | "At Risk" | "Blocked";
  reasons: string[];
  evidence: Evidence[];
  nextAction: Recommendation | null;
  focusMinutesThisWeek?: number;
  upcomingMilestone?: WorkspaceRow | null;
};

export type FocusWindow = {
  startsAt: string;
  endsAt: string;
  minutes: number;
  label: string;
};

export type Capacity = {
  capacityMinutes: number;
  meetingMinutes: number;
  availableFocusMinutes: number;
  highPriorityMinutes: number;
  overcommittedMinutes: number;
  insight: string;
};

export type Pattern = {
  key: string;
  title: string;
  statement: string;
  sampleSize: number;
  confidence: EvidenceConfidence;
  evidence: Evidence[];
};

export type Prediction = {
  key: string;
  entityType: IntelligenceEntityType;
  entityId: string;
  statement: string;
  confidence: EvidenceConfidence;
  sampleSize: number;
  assumptions: string[];
  evidence: Evidence[];
};

export type InsightFeedback = {
  insight_key: string;
  insight_type: string;
  action: "dismissed" | "snoozed" | "irrelevant" | "helpful" | "hidden_type";
  snoozed_until?: string | null;
  created_at: string;
};

export type WorkspaceSnapshot = {
  now: string;
  today: string;
  timezone: string;
  profile: WorkspaceRow | null;
  tasks: WorkspaceRow[];
  projects: WorkspaceRow[];
  clients: WorkspaceRow[];
  followups: WorkspaceRow[];
  waiting: WorkspaceRow[];
  notes: WorkspaceRow[];
  milestones: WorkspaceRow[];
  calendar: WorkspaceRow[];
  focusSessions: WorkspaceRow[];
  invoices: WorkspaceRow[];
  payments: WorkspaceRow[];
  expenses: WorkspaceRow[];
  subscriptions: WorkspaceRow[];
  content: WorkspaceRow[];
  campaigns: WorkspaceRow[];
  decisions: WorkspaceRow[];
  goals: WorkspaceRow[];
  fitnessActivities: WorkspaceRow[];
  fitnessTargets: WorkspaceRow[];
  activity: WorkspaceRow[];
  feedback: InsightFeedback[];
  notificationPreferences: WorkspaceRow[];
};

export type DailyPlan = {
  date: string;
  generatedAt: string;
  wins: Recommendation[];
  blocks: Array<FocusWindow & { taskId?: string; title: string; kind: "focus" | "followup" | "meeting" | "fitness" }>;
  defer: Array<{ id: string; title: string; reason: string }>;
  followups: Recommendation[];
  workout: { label: string; reason: string } | null;
  capacity: Capacity;
};

export type IntelligenceOverview = {
  mode: "deep_work" | "meeting_heavy" | "finance_heavy" | "content_deadline" | "balanced";
  headline: string;
  summary: string;
  attentionQueue: Recommendation[];
  recommendations: Recommendation[];
  risks: Risk[];
  projectHealth: HealthAssessment[];
  clientHealth: HealthAssessment[];
  capacity: Capacity;
  focusWindows: FocusWindow[];
  finance: { expectedThisWeek: number; overdueAmount: number; overdueCount: number; renewalsNext7Days: number; currency: string; insights: string[] };
  content: { stuckInReview: number; dueSoon: number; scheduledNext7Days: number; insights: string[] };
  fitness: { insights: string[] };
  patterns: Pattern[];
  predictions: Prediction[];
};
