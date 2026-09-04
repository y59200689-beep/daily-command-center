import { z } from "zod";

export const taskInputSchema = z.object({
  title: z.string().trim().min(1, "Give the task a short title.").max(240),
  description: z.string().trim().max(5000).optional(),
  status: z.enum(["inbox", "planned", "in_progress", "waiting", "blocked", "completed", "cancelled"]).default("inbox"),
  priority: z.enum(["none", "low", "medium", "high", "urgent"]).default("none"),
  projectId: z.uuid().nullable().optional(),
  dueDate: z.iso.date().nullable().optional(),
  estimatedMinutes: z.number().int().min(1).max(1440).nullable().optional(),
});

export const captureInputSchema = z.object({
  text: z.string().trim().min(1, "Capture something before saving.").max(2000),
  type: z.enum(["task", "note", "idea", "reminder", "decision", "follow-up"]),
});

export type TaskInput = z.infer<typeof taskInputSchema>;
