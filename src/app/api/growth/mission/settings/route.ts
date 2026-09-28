import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";
import { defaultMissionSettings, missionSettingsSchema } from "@/lib/revenue-mission";

export async function GET() {
  try {
    const { supabase, userId } = await requireUser();
    const { data, error } = await supabase.from("revenue_mission_settings").select("start_date,duration_days,pace_goals,daily_actions").eq("user_id", userId).maybeSingle();
    if (error) throw error;
    return NextResponse.json({ settings: data ? missionSettingsSchema.parse(data) : defaultMissionSettings });
  } catch (error) { return apiError(error, "Mission settings could not be loaded. Apply the latest database migration if this is a new installation."); }
}
export async function PUT(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const parsed = missionSettingsSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Check the mission dates, goals, and daily tasks." }, { status: 400 });
    const { error } = await supabase.from("revenue_mission_settings").upsert({ ...parsed.data, user_id: userId, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) throw error;
    return NextResponse.json({ settings: parsed.data });
  } catch (error) { return apiError(error, "Mission settings could not be saved."); }
}
