import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { apiError } from "@/lib/api";
import { z } from "zod";

const createPlanSchema = z.object({
  title: z.string().trim().min(1).max(240),
  description: z.string().trim().optional(),
  sourceDomain: z.string().trim().default("chief_of_staff"),
  steps: z.array(
    z.object({
      title: z.string().trim().min(1).max(240),
      actionType: z.string().trim().min(1),
      requiresApproval: z.boolean().default(true),
      inputPayload: z.record(z.string(), z.unknown()).default({}),
    })
  ).default([]),
});

export async function GET() {
  try {
    const { supabase, userId } = await requireUser();
    const { data, error } = await supabase
      .from("action_plans")
      .select("*, action_plan_steps(*)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return NextResponse.json({ plans: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error, "Action plans could not be loaded.");
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const body = await request.json();
    const parsed = createPlanSchema.parse(body);

    const { data: plan, error: planError } = await supabase
      .from("action_plans")
      .insert({
        user_id: userId,
        title: parsed.title,
        description: parsed.description ?? null,
        source_domain: parsed.sourceDomain,
        status: "draft",
      })
      .select("*")
      .single();

    if (planError) throw planError;

    if (parsed.steps.length > 0) {
      const stepInserts = parsed.steps.map((step, idx) => ({
        user_id: userId,
        plan_id: plan.id,
        position: idx,
        title: step.title,
        action_type: step.actionType,
        requires_approval: step.requiresApproval,
        input_payload: step.inputPayload,
        status: "pending",
      }));
      await supabase.from("action_plan_steps").insert(stepInserts);
    }

    return NextResponse.json({ plan }, { status: 201 });
  } catch (error) {
    return apiError(error, "Could not create action plan.");
  }
}
