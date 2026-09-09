import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";

const updateIncidentSchema = z.object({
  title: z.string().trim().min(1).max(240).optional(),
  description: z.string().optional(),
  severity: z.enum(["low", "medium", "high", "critical"]).optional(),
  status: z.enum(["open", "investigating", "corrective_action", "monitoring", "resolved", "archived"]).optional(),
  root_cause: z.string().optional().nullable(),
  corrective_action: z.string().optional().nullable(),
  preventive_action: z.string().optional().nullable(),
  corrective_task_id: z.string().uuid().optional().nullable(),
  resolved: z.boolean().optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const input = updateIncidentSchema.parse(await request.json());
    const { supabase, userId } = await requireUser();

    let resolved_at: string | null = null;
    let status = input.status;

    if (input.resolved || input.status === "resolved") {
      status = "resolved";
      resolved_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from("quality_incidents")
      .update({
        ...(input.title ? { title: input.title } : {}),
        ...(input.description ? { description: input.description } : {}),
        ...(input.severity ? { severity: input.severity } : {}),
        ...(status ? { status } : {}),
        ...(resolved_at ? { resolved_at } : {}),
        ...(input.root_cause !== undefined ? { root_cause: input.root_cause } : {}),
        ...(input.corrective_action !== undefined ? { corrective_action: input.corrective_action } : {}),
        ...(input.preventive_action !== undefined ? { preventive_action: input.preventive_action } : {}),
        ...(input.corrective_task_id !== undefined ? { corrective_task_id: input.corrective_task_id } : {}),
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", id)
      .eq("user_id", userId)
      .select("*")
      .maybeSingle();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Incident not found." }, { status: 404 });

    return NextResponse.json({ incident: data });
  } catch (error) {
    return apiError(error, "Incident could not be updated.");
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { supabase, userId } = await requireUser();

    const { error } = await supabase
      .from("quality_incidents")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error, "Incident could not be deleted.");
  }
}
