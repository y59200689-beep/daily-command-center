import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";
import { computeChannelPerformance } from "@/lib/growth";

export async function GET() {
  try {
    const { supabase, userId } = await requireUser();

    const [leadsRes, oppsRes, proposalsRes, campaignsRes] = await Promise.all([
      supabase.from("leads").select("id,source,status").eq("user_id", userId).is("archived_at", null),
      supabase.from("opportunities").select("id,source,stage,estimated_value").eq("user_id", userId).is("archived_at", null),
      supabase.from("proposals").select("id,opportunity_id,status,total").eq("user_id", userId).is("archived_at", null),
      supabase.from("campaigns").select("id,name,status").eq("user_id", userId).is("deleted_at", null),
    ]);

    if (leadsRes.error) throw leadsRes.error;
    if (oppsRes.error) throw oppsRes.error;
    if (proposalsRes.error) throw proposalsRes.error;

    const data = computeChannelPerformance(
      leadsRes.data ?? [],
      oppsRes.data ?? [],
      proposalsRes.data ?? []
    );

    return NextResponse.json({
      ...data,
      campaigns: campaignsRes.data ?? [],
    });
  } catch (error) {
    return apiError(error, "Channel performance could not be loaded.");
  }
}
