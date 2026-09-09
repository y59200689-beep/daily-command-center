import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";

const runbookSchema = z.object({
  sop_id: z.string().uuid().optional().nullable(),
  title: z.string().trim().min(1).max(240),
  trigger: z.string().trim().min(1),
  severity: z.enum(["low", "medium", "high", "critical"]).default("high"),
  symptoms: z.string().trim().min(1),
  diagnostic_steps: z.string().trim().min(1),
  recovery_steps: z.string().trim().min(1),
  escalation: z.string().optional().nullable(),
  validation: z.string().optional().nullable(),
  post_incident_steps: z.string().optional().nullable(),
});

export async function GET(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const { searchParams } = new URL(request.url);
    const emergencyOnly = searchParams.get("emergency") === "1";

    let query = supabase
      .from("operational_runbooks")
      .select("*,operational_sops(title)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (emergencyOnly) {
      query = query.eq("severity", "critical");
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ runbooks: data ?? [] });
  } catch (error) {
    return apiError(error, "Runbooks could not be loaded.");
  }
}

export async function POST(request: Request) {
  try {
    const input = runbookSchema.parse(await request.json());
    const { supabase, userId } = await requireUser();

    const { data, error } = await supabase
      .from("operational_runbooks")
      .insert({
        user_id: userId,
        sop_id: input.sop_id ?? null,
        title: input.title,
        trigger: input.trigger,
        severity: input.severity,
        symptoms: input.symptoms,
        diagnostic_steps: input.diagnostic_steps,
        recovery_steps: input.recovery_steps,
        escalation: input.escalation ?? null,
        validation: input.validation ?? null,
        post_incident_steps: input.post_incident_steps ?? null,
      })
      .select("*")
      .single();

    if (error) throw error;
    return NextResponse.json({ runbook: data }, { status: 201 });
  } catch (error) {
    return apiError(error, "Runbook could not be created.");
  }
}
