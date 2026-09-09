import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { apiError } from "@/lib/api";
import { approveAndExecuteAction } from "@/lib/chief-of-staff-server";
import { z } from "zod";

const approveSchema = z.object({
  reviewed_payload: z.record(z.string(), z.unknown()).default({}),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, userId } = await requireUser();
    const { id } = await context.params;
    const body = await request.json();
    const parsed = approveSchema.parse(body);

    const result = await approveAndExecuteAction(supabase, userId, id, parsed.reviewed_payload);
    if (!result.success) {
      return NextResponse.json({ error: result.message, category: result.errorCategory }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    return apiError(error, "Action approval failed.");
  }
}
