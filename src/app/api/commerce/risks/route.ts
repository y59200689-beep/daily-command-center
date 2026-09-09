import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { getCommerceContext, loadFullCommerceState } from "@/lib/commerce-server";

export async function GET() {
  try {
    const { supabase, userId, companyId, isConfigured } = await getCommerceContext();
    if (!isConfigured || !companyId) {
      return NextResponse.json({ configured: false, risks: [], nextMove: null });
    }

    const state = await loadFullCommerceState(supabase, userId, companyId);
    return NextResponse.json({
      configured: true,
      risks: state.activeRisks,
      nextMove: state.nextMove,
      count: state.activeRisks.length,
    });
  } catch (error) {
    return apiError(error, "Commerce risks could not be loaded.");
  }
}
