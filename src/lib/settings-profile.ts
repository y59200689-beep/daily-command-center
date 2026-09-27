import { z } from "zod";

export const settingsProfileInput = z.object({
  display_name: z.string().trim().min(1, "Enter your name.").max(100).optional(),
  timezone: z.string().max(100).refine(value => { try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; } }, "Choose a valid time zone.").optional(),
  week_starts_on: z.number().int().min(0).max(6).optional(),
}).strict().refine(value => Object.keys(value).length > 0, "No changes supplied.");
