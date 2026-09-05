import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";

const schema = z.object({
  insightKey: z.string().trim().min(1).max(300),
  insightType: z.string().trim().min(1).max(120),
  entityType: z.string().trim().max(80).nullable().optional(),
  entityId: z.string().trim().max(180).nullable().optional(),
  action: z.enum(["dismissed", "snoozed", "irrelevant", "helpful", "hidden_type"]),
  snoozeHours: z.number().int().min(1).max(24 * 30).optional(),
}).strict().superRefine((value, context) => {
  if (value.action === "snoozed" && !value.snoozeHours) context.addIssue({ code: "custom", path: ["snoozeHours"], message: "Choose how long to snooze this insight." });
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const { supabase, userId } = await requireUser();
    const snoozedUntil = input.action === "snoozed" ? new Date(Date.now() + (input.snoozeHours ?? 24) * 3_600_000).toISOString() : null;
    const { data, error } = await supabase.from("insight_feedback").insert({ user_id: userId, insight_key: input.insightKey, insight_type: input.insightType, entity_type: input.entityType ?? null, entity_id: input.entityId ?? null, action: input.action, snoozed_until: snoozedUntil } as never).select("*").single();
    if (error) throw error;
    return NextResponse.json({ feedback: data }, { status: 201 });
  } catch (error) {
    return apiError(error, "Insight feedback could not be saved.");
  }
}
