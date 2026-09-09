import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { apiError } from "@/lib/api";

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const body = await request.json();
    if (!body.signal_key) {
      return NextResponse.json({ error: "Missing signal_key" }, { status: 400 });
    }

    const res = await supabase
      .from("executive_signal_dismissals")
      .upsert({
        user_id: userId,
        signal_key: body.signal_key,
        dismissed_until: body.until ?? new Date(Date.now() + 7 * 86400000).toISOString(),
        dismissed_reason: body.reason ?? null,
        snoozed: !!body.snoozed,
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (res.error) throw res.error;
    return NextResponse.json({ dismissal: res.data });
  } catch (error) {
    return apiError(error, "Failed to dismiss executive signal.");
  }
}
