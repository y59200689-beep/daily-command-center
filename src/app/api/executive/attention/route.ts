import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { apiError } from "@/lib/api";
import { loadExecutiveContext } from "@/lib/executive-server";
import type { ExecutiveSignal } from "@/lib/executive";

type AttentionItem = {
  id: string;
  domain: string;
  title: string;
  reason: string;
  urgency: "now" | "today" | "this_week";
  route: string;
};

function toAttentionItem(s: ExecutiveSignal, urgency: "now" | "today" | "this_week"): AttentionItem {
  return { id: s.id, domain: s.domain, title: s.title, reason: s.reason, urgency, route: s.route };
}

export async function GET() {
  try {
    const { supabase, userId } = await requireUser();
    const context = await loadExecutiveContext(supabase, userId, "business");

    const immediate: AttentionItem[] = [];
    const today: AttentionItem[] = [];
    const thisWeek: AttentionItem[] = [];

    for (const s of context.signals) {
      if (s.severity === "critical") immediate.push(toAttentionItem(s, "now"));
      else if (s.severity === "important") today.push(toAttentionItem(s, "today"));
      else thisWeek.push(toAttentionItem(s, "this_week"));
    }

    return NextResponse.json(
      {
        immediate: immediate.slice(0, 5),
        today: today.slice(0, 8),
        thisWeek: thisWeek.slice(0, 8),
        delegationCandidates: context.delegationCandidates,
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    return apiError(error, "Attention allocation data is unavailable.");
  }
}
