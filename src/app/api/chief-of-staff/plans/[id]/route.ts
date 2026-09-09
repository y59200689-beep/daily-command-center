import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { apiError } from "@/lib/api";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, userId } = await requireUser();
    const { id } = await context.params;

    const { data: plan, error: planError } = await supabase
      .from("action_plans")
      .select("*, action_plan_steps(*)")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();

    if (planError) throw planError;
    if (!plan) return NextResponse.json({ error: "Plan not found." }, { status: 404 });

    return NextResponse.json({
      plan: {
        ...plan,
        steps: plan.action_plan_steps ?? [],
      },
    });
  } catch (error) {
    return apiError(error, "Action plan could not be loaded.");
  }
}
