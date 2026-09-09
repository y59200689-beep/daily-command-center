import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";

const checklistActionSchema = z.object({
  item_id: z.string().uuid(),
  completed: z.boolean(),
  evidence_text: z.string().optional().nullable(),
  evidence_attachment_id: z.string().uuid().optional().nullable(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: runId } = await context.params;
    const input = checklistActionSchema.parse(await request.json());
    const { supabase, userId } = await requireUser();

    // Verify run and checklist item belong to user
    const { data: item, error: itemError } = await supabase
      .from("run_checklist_items")
      .select("*")
      .eq("id", input.item_id)
      .eq("run_id", runId)
      .eq("user_id", userId)
      .maybeSingle();

    if (itemError) throw itemError;
    if (!item) return NextResponse.json({ error: "Checklist item not found." }, { status: 404 });

    // If evidence is required and marking complete, check evidence
    if (item.evidence_required && input.completed) {
      const hasText = input.evidence_text && input.evidence_text.trim();
      const hasAttachment = Boolean(input.evidence_attachment_id);
      if (!hasText && !hasAttachment && !item.evidence_text && !item.evidence_attachment_id) {
        return NextResponse.json(
          { error: "Evidence is required to mark this checklist item complete." },
          { status: 400 }
        );
      }
    }

    const { data: updatedItem, error: updateError } = await supabase
      .from("run_checklist_items")
      .update({
        completed: input.completed,
        completed_at: input.completed ? new Date().toISOString() : null,
        evidence_text: input.evidence_text !== undefined ? input.evidence_text : item.evidence_text,
        evidence_attachment_id: input.evidence_attachment_id !== undefined ? input.evidence_attachment_id : item.evidence_attachment_id,
      } as never)
      .eq("id", input.item_id)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({ item: updatedItem });
  } catch (error) {
    return apiError(error, "Checklist item could not be updated.");
  }
}
