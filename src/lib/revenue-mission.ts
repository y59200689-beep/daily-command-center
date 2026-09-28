import { z } from "zod";

export const missionGoalKeys = ["prospects", "contacted", "videos", "replies", "meetings", "proposals", "clients", "revenue_usd"] as const;
export const missionGoalLabels: Record<(typeof missionGoalKeys)[number], string> = { prospects: "Prospects", contacted: "Contacted", videos: "Personalized videos", replies: "Replies", meetings: "Meetings", proposals: "Proposals", clients: "Clients", revenue_usd: "Revenue (USD)" };
export const defaultPaceGoals = { prospects: 300, contacted: 200, videos: 60, replies: 40, meetings: 10, proposals: 4, clients: 1, revenue_usd: 0 };
export const actionSchema = z.object({ id: z.string().regex(/^[a-z0-9_-]{1,80}$/), title: z.string().trim().min(1).max(120), daily_target: z.number().int().min(1).max(100000), active: z.boolean() });
export const defaultMissionActions = [
  { id: "prospects", title: "Find new radiology centers", daily_target: 15, active: true },
  { id: "outreach", title: "Contact qualified prospects", daily_target: 10, active: true },
  { id: "audits", title: "Record personalized audits", daily_target: 3, active: true },
  { id: "followups", title: "Follow up with prospects", daily_target: 7, active: true },
  { id: "replies", title: "Reply to active leads", daily_target: 1, active: true },
  { id: "inbound_replies", title: "Replies received", daily_target: 2, active: true },
  { id: "meetings", title: "Sales meetings completed", daily_target: 1, active: true },
];
export const missionSettingsSchema = z.object({ start_date: z.iso.date().nullable(), duration_days: z.number().int().min(1).max(365), pace_goals: z.object({ prospects: z.number().int().min(1).max(1000000), contacted: z.number().int().min(1).max(1000000), videos: z.number().int().min(1).max(1000000), replies: z.number().int().min(1).max(1000000), meetings: z.number().int().min(1).max(1000000), proposals: z.number().int().min(1).max(1000000), clients: z.number().int().min(1).max(1000000), revenue_usd: z.number().min(0).max(1000000000) }), daily_actions: z.array(actionSchema).max(20).refine(items => new Set(items.map(item => item.id)).size === items.length, "Action IDs must be unique") });
export type MissionSettings = z.infer<typeof missionSettingsSchema>;
export type MissionAction = z.infer<typeof actionSchema>;
export const defaultMissionSettings: MissionSettings = { start_date: null, duration_days: 30, pace_goals: defaultPaceGoals, daily_actions: defaultMissionActions };
export const missionLogSchema = z.object({ log_date: z.iso.date(), action_id: z.string().regex(/^[a-z0-9_-]{1,80}$/), quantity: z.number().int().min(0).max(100000), status: z.enum(["not_started", "in_progress", "completed", "blocked"]), note: z.string().max(1000) });
export type MissionLog = z.infer<typeof missionLogSchema>;
export function missionEndDate(start: string | null, days: number) { if (!start) return null; const date = new Date(`${start}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + days - 1); return date.toISOString().slice(0, 10); }
export function missionDay(start: string | null, today: string, days: number) { if (!start) return null; return Math.max(0, Math.min(days, Math.floor((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / 86400000) + 1)); }
