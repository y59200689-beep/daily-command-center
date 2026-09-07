import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";
import { buildGrowthForecast } from "@/lib/growth";

export async function GET() {
  try {
    const { supabase, userId } = await requireUser();

    const [oppsRes, proposalsRes] = await Promise.all([
      supabase.from("opportunities").select("id,title,stage,estimated_value,currency,expected_close_date,probability").eq("user_id", userId).is("archived_at", null),
      supabase.from("proposals").select("id,opportunity_id,status,total,currency").eq("user_id", userId).is("archived_at", null),
    ]);

    if (oppsRes.error) throw oppsRes.error;
    if (proposalsRes.error) throw proposalsRes.error;

    const forecast = buildGrowthForecast(
      oppsRes.data ?? [],
      proposalsRes.data ?? []
    );

    return NextResponse.json(forecast);
  } catch (error) {
    return apiError(error, "Growth forecast could not be loaded.");
  }
}
