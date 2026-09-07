import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";

const targetSchema = z.object({
  id: z.string().uuid().optional(),
  goal_id: z.string().uuid().optional().nullable(),
  metric_type: z.enum([
    "monthly_revenue",
    "new_leads",
    "qualified_leads",
    "proposals_sent",
    "deals_won",
    "new_clients",
    "expansion_revenue",
    "pipeline_generated",
  ]),
  target_value: z.coerce.number().finite().nonnegative(),
  current_value: z.coerce.number().finite().nonnegative().default(0),
  currency: z.string().length(3).default("MAD"),
  period: z.enum(["week", "month", "quarter", "year"]).default("month"),
  period_start: z.string(),
  period_end: z.string(),
});

export async function GET() {
  try {
    const { supabase, userId } = await requireUser();

    const { data: targets, error } = await supabase
      .from("sales_targets")
      .select("*,goals(title)")
      .eq("user_id", userId)
      .order("period_start", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ targets: targets ?? [] });
  } catch (error) {
    return apiError(error, "Sales targets could not be loaded.");
  }
}

export async function POST(request: Request) {
  try {
    const input = targetSchema.parse(await request.json());
    const { supabase, userId } = await requireUser();

    if (input.goal_id) {
      const { data: goal } = await supabase
        .from("goals")
        .select("id")
        .eq("id", input.goal_id)
        .eq("user_id", userId)
        .maybeSingle();
      if (!goal) return NextResponse.json({ error: "Goal not found in your workspace." }, { status: 404 });
    }

    const payload = {
      user_id: userId,
      goal_id: input.goal_id ?? null,
      metric_type: input.metric_type,
      target_value: input.target_value,
      current_value: input.current_value,
      currency: input.currency,
      period: input.period,
      period_start: input.period_start.slice(0, 10),
      period_end: input.period_end.slice(0, 10),
    };

    let result;
    if (input.id) {
      result = await supabase
        .from("sales_targets")
        .update(payload)
        .eq("id", input.id)
        .eq("user_id", userId)
        .select("*")
        .single();
    } else {
      result = await supabase
        .from("sales_targets")
        .insert(payload)
        .select("*")
        .single();
    }

    if (result.error) throw result.error;
    return NextResponse.json({ target: result.data }, { status: input.id ? 200 : 201 });
  } catch (error) {
    return apiError(error, "Sales target could not be saved.");
  }
}
