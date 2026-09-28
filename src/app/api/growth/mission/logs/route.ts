import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";
import { defaultMissionActions, missionLogSchema } from "@/lib/revenue-mission";

export async function GET(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const date = new URL(request.url).searchParams.get("date");
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "Choose a valid log date." }, { status: 400 });
    const { data, error } = await supabase.from("revenue_mission_logs").select("log_date,action_id,quantity,status,note").eq("user_id", userId).eq("log_date", date);
    if (error) throw error;
    return NextResponse.json({ logs: data ?? [] });
  } catch (error) { return apiError(error, "Daily mission logs could not be loaded."); }
}
export async function PUT(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const parsed = missionLogSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Enter a valid quantity, status, and note." }, { status: 400 });
    const { data: settings, error: settingsError } = await supabase.from("revenue_mission_settings").select("daily_actions").eq("user_id", userId).maybeSingle();
    if (settingsError) throw settingsError;
    const actionIds = (settings?.daily_actions ?? defaultMissionActions).map((item: { id: string }) => item.id);
    if (!actionIds.includes(parsed.data.action_id)) return NextResponse.json({ error: "Save this action in mission settings before logging it." }, { status: 400 });
    const { error } = await supabase.from("revenue_mission_logs").upsert({ ...parsed.data, user_id: userId, updated_at: new Date().toISOString() }, { onConflict: "user_id,log_date,action_id" });
    if (error) throw error;
    return NextResponse.json({ log: parsed.data });
  } catch (error) { return apiError(error, "Daily mission log could not be saved."); }
}
