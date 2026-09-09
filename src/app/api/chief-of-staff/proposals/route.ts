import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { apiError } from "@/lib/api";
import { prepareActionProposal } from "@/lib/chief-of-staff-server";
import { z } from "zod";

const createProposalSchema = z.object({
  title: z.string().trim().min(1).max(240),
  description: z.string().trim().optional(),
  sourceDomain: z.string().trim().default("chief_of_staff"),
  actionType: z.string().trim().min(1),
  targetType: z.string().trim().optional(),
  targetId: z.string().uuid().optional(),
  proposedPayload: z.record(z.string(), z.unknown()).default({}),
  reason: z.string().trim().min(1),
  evidence: z.string().trim().optional(),
  createApprovalImmediately: z.boolean().default(true),
});

export async function GET() {
  try {
    const { supabase, userId } = await requireUser();
    const { data, error } = await supabase
      .from("action_proposals")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return NextResponse.json({ proposals: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error, "Action proposals could not be loaded.");
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const body = await request.json();
    const parsed = createProposalSchema.parse(body);
    const proposal = await prepareActionProposal(supabase, userId, parsed);
    return NextResponse.json({ proposal }, { status: 201 });
  } catch (error) {
    return apiError(error, "Could not create action proposal.");
  }
}
