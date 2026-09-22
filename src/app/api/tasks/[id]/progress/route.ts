import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";

const progressInput = z.object({
    amount: z.coerce.number().finite().min(0.01, "Amount must be positive"),
});

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context) {
    try {
        const { id } = await context.params;
        const parsed = progressInput.safeParse(await request.json());
        if (!parsed.success) throw parsed.error;

        const { amount } = parsed.data;
        const { supabase, userId } = await requireUser();

        // Load the task
        const { data: task, error: fetchError } = await supabase
            .from("tasks")
            .select("id,user_id,status,target_count,current_count,title")
            .eq("id", id)
            .eq("user_id", userId)
            .is("deleted_at", null)
            .maybeSingle();

        if (fetchError) throw fetchError;
        if (!task) return NextResponse.json({ error: "Task not found." }, { status: 404 });
        if (!task.target_count) {
            return NextResponse.json({ error: "This task does not have a progress target." }, { status: 400 });
        }

        const prev = Number(task.current_count ?? 0);
        const newCount = Math.min(prev + amount, Number(task.target_count));
        const reached = newCount >= Number(task.target_count);

        const patch: Record<string, unknown> = { current_count: newCount };
        if (reached && task.status !== "completed") {
            patch.status = "completed";
            patch.completed_at = new Date().toISOString();
        }

        const { data: updated, error: updateError } = await supabase
            .from("tasks")
            .update(patch)
            .eq("id", id)
            .eq("user_id", userId)
            .select("*")
            .maybeSingle();

        if (updateError) throw updateError;
        return NextResponse.json({ record: updated, reached }, { status: 200 });
    } catch (error) {
        return apiError(error, "Progress could not be recorded.");
    }
}
