import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { apiError } from "@/lib/api";

const DOMAIN_ROUTES: Record<string, string> = {
  finance: "/finance",
  growth: "/growth",
  success: "/success",
  commerce: "/commerce",
  operations: "/operations",
  team: "/team",
  strategy: "/control-tower",
  knowledge: "/knowledge",
  life: "/life",
};

export async function GET() {
  try {
    const { supabase, userId } = await requireUser();
    const res = await supabase
      .from("executive_assumptions")
      .select("id,domain,statement,status,notes,created_at,review_at,linked_entities")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    // Gracefully handle table-not-found (migration not applied)
    if (res.error && (res.error as { code?: string }).code === "42P01") {
      return NextResponse.json({ assumptions: [] }, { headers: { "Cache-Control": "private, no-store" } });
    }
    if (res.error) throw res.error;

    const assumptions = (res.data ?? []).map((a) => ({
      id: a.id,
      domain: a.domain ?? "strategy",
      statement: a.statement,
      status: a.status === "cracked" ? "cracked"
        : a.status === "invalidated" ? "invalidated"
        : a.status === "active" ? "holding"
        : "unverified",
      evidence: a.notes ?? "No evidence recorded.",
      addedAt: a.created_at,
      reviewedAt: a.review_at ?? undefined,
      route: DOMAIN_ROUTES[a.domain ?? "strategy"] ?? "/executive",
    }));

    return NextResponse.json({ assumptions }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error, "Failed to load assumptions.");
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const body = await request.json();
    const res = await supabase
      .from("executive_assumptions")
      .insert({
        user_id: userId,
        statement: body.statement,
        domain: body.domain ?? "strategy",
        source: body.source ?? "manual",
        review_at: body.review_at ?? null,
        status: body.status ?? "active",
        confidence_label: body.confidence_label ?? null,
        linked_entities: body.linked_entities ?? [],
        notes: body.notes ?? null,
      })
      .select("*")
      .single();
    if (res.error) throw res.error;
    return NextResponse.json({ assumption: res.data }, { status: 201 });
  } catch (error) {
    return apiError(error, "Failed to create assumption.");
  }
}
