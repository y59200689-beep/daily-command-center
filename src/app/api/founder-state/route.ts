import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import { apiError } from "@/lib/api";
import { loadFounderState } from "@/lib/founder-os/server";
const bodySchema = z.object({ action: z.enum(["snapshot", "dismiss"]), signalId: z.string().max(240).optional() }).strict();
async function context() {
  const auth = await requireUser();
  const { data, error } = await auth.supabase.from("profiles").select("timezone").eq("id", auth.userId).maybeSingle();
  if (error) throw error;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: data?.timezone ?? "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return { ...auth, today };
}
export async function GET() {
  try { const { supabase, userId, today } = await context(); return NextResponse.json(await loadFounderState(supabase, userId, today)); }
  catch (error) { return apiError(error, "Founder State could not be loaded."); }
}
export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    const { supabase, userId, today } = await context();
    const state = await loadFounderState(supabase, userId, today);
    if (body.action === "dismiss") {
      if (!state.signals.some(s => s.id === body.signalId)) return NextResponse.json({ error: "Signal not found." }, { status: 404 });
      const { error } = await supabase.from("executive_signal_dismissals").upsert({ user_id: userId, signal_key: body.signalId, dismissed_until: new Date(Date.now() + 86400000).toISOString() }, { onConflict: "user_id,signal_key" });
      if (error) throw error;
    } else {
      if (state.coverage.some(c => c.status !== "available")) return NextResponse.json({ error: "A complete snapshot needs all monitored sources. Restore unavailable sources first." }, { status: 409 });
      const { error } = await supabase.from("executive_snapshots").insert({ user_id: userId, scope: "combined", snapshot_date: today, founder_signals: state.signals, summary: `Founder State: ${state.status}` });
      if (error) throw error;
    }
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error, "Founder State action could not be saved."); }
}
