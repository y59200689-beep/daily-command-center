import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";
import { scoreOpportunity, scoreLead } from "@/lib/growth";

export async function GET() {
  try {
    const { supabase, userId } = await requireUser();
    const today = new Date().toISOString().slice(0, 10);

    const [oppsRes, leadsRes, proposalsRes] = await Promise.all([
      supabase.from("opportunities").select("*").eq("user_id", userId).is("archived_at", null).not("stage", "in", '("won","lost")'),
      supabase.from("leads").select("*").eq("user_id", userId).is("archived_at", null).not("status", "in", '("unqualified","lost","converted")'),
      supabase.from("proposals").select("*").eq("user_id", userId).eq("status", "sent").is("archived_at", null),
    ]);

    if (oppsRes.error) throw oppsRes.error;
    if (leadsRes.error) throw leadsRes.error;
    if (proposalsRes.error) throw proposalsRes.error;

    const actions: Array<{
      id: string;
      actionType: string;
      title: string;
      targetType: "opportunity" | "lead" | "proposal";
      targetId: string;
      value?: number | null;
      currency?: string | null;
      urgency: "critical" | "high" | "medium" | "low";
      reason: string;
      suggestedAction: string;
      route: string;
    }> = [];

    for (const opp of oppsRes.data ?? []) {
      const scored = scoreOpportunity(opp, today);
      const val = Number(opp.estimated_value ?? 0);
      actions.push({
        id: `opp-action:${opp.id}`,
        actionType: opp.stage === "proposal" ? "Follow up" : !opp.next_action ? "Clarify scope" : "Schedule meeting",
        title: opp.title,
        targetType: "opportunity",
        targetId: opp.id,
        value: val,
        currency: opp.currency ?? "MAD",
        urgency: scored.priority.toLowerCase() as "critical" | "high" | "medium" | "low",
        reason: scored.risks[0] ?? scored.reasons[0] ?? "Deal progression required.",
        suggestedAction: scored.nextAction,
        route: `/pipeline?opportunity=${opp.id}`,
      });
    }

    for (const prop of proposalsRes.data ?? []) {
      const val = Number(prop.total ?? 0);
      actions.push({
        id: `prop-action:${prop.id}`,
        actionType: "Follow up",
        title: `Proposal: ${prop.title}`,
        targetType: "proposal",
        targetId: prop.id,
        value: val,
        currency: prop.currency ?? "MAD",
        urgency: "high",
        reason: "Proposal sent awaiting client decision.",
        suggestedAction: "Check in with client on proposal feedback.",
        route: `/proposals?proposal=${prop.id}`,
      });
    }

    for (const lead of leadsRes.data ?? []) {
      const scored = scoreLead(lead, today);
      if (scored.quality === "Hot" || scored.quality === "Warm") {
        actions.push({
          id: `lead-action:${lead.id}`,
          actionType: lead.status === "new" ? "Prepare proposal" : "Follow up",
          title: `Lead: ${lead.name}`,
          targetType: "lead",
          targetId: lead.id,
          value: lead.potential_value,
          currency: lead.currency ?? "MAD",
          urgency: scored.quality === "Hot" ? "high" : "medium",
          reason: scored.reasons[0] ?? "Qualified inbound lead.",
          suggestedAction: scored.nextAction,
          route: `/leads?lead=${lead.id}`,
        });
      }
    }

    return NextResponse.json({ actions });
  } catch (error) {
    return apiError(error, "Sales actions could not be loaded.");
  }
}

const createActionSchema = z.object({
  kind: z.enum(["task", "followup"]),
  title: z.string().trim().min(1).max(240),
  due_date: z.string().optional().nullable(),
  entity_type: z.enum(["opportunity", "lead", "proposal"]).optional(),
  entity_id: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  try {
    const input = createActionSchema.parse(await request.json());
    const { supabase, userId } = await requireUser();

    if (input.kind === "task") {
      const { data, error } = await supabase
        .from("tasks")
        .insert({
          user_id: userId,
          title: input.title,
          due_date: input.due_date ? input.due_date.slice(0, 10) : new Date().toISOString().slice(0, 10),
          status: "planned",
          priority: "high",
        })
        .select("*")
        .single();
      if (error) throw error;
      return NextResponse.json({ item: data, kind: "task" }, { status: 201 });
    } else {
      const { data, error } = await supabase
        .from("followups")
        .insert({
          user_id: userId,
          title: input.title,
          due_at: input.due_date ? new Date(input.due_date).toISOString() : new Date(Date.now() + 2 * 86400000).toISOString(),
          status: "open",
        })
        .select("*")
        .single();
      if (error) throw error;
      return NextResponse.json({ item: data, kind: "followup" }, { status: 201 });
    }
  } catch (error) {
    return apiError(error, "Action could not be created.");
  }
}
