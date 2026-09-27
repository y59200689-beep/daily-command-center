import { NextResponse } from "next/server";
import { settingsProfileInput } from "@/lib/settings-profile";
import { requireUser } from "@/lib/supabase/server";
import { apiError } from "@/lib/api";

export async function PATCH(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const parsed = settingsProfileInput.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check your details." }, { status: 422 });
    const { data, error } = await supabase.from("profiles").upsert({ id: userId, ...parsed.data }, { onConflict: "id" }).select("display_name,timezone,week_starts_on").single();
    if (error) throw error;
    return NextResponse.json({ profile: data });
  } catch (error) { return apiError(error, "Your settings could not be saved."); }
}
