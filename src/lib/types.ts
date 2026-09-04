export type TaskStatus = "inbox" | "planned" | "in_progress" | "waiting" | "blocked" | "completed" | "cancelled";
export type Priority = "none" | "low" | "medium" | "high" | "urgent";

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: Priority;
  project?: string;
  client?: string;
  dueLabel?: string;
  estimatedMinutes?: number;
  completed?: boolean;
  accent?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: "idea" | "planning" | "active" | "paused" | "completed" | "archived";
  progress: number;
  deadline: string;
  accent: string;
  next: string;
}

export interface CalendarItem {
  id: string;
  time: string;
  endTime: string;
  title: string;
  detail: string;
  kind: "meeting" | "focus" | "personal";
}

export interface Capture {
  id: string;
  type: "task" | "note" | "idea" | "reminder" | "decision" | "follow-up";
  text: string;
  createdAt: string;
}
