import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { getCommerceContext, loadFullCommerceState } from "@/lib/commerce-server";

export async function GET() {
  try {
    const { supabase, userId, companyId, isConfigured } = await getCommerceContext();
    if (!isConfigured || !companyId) {
      return NextResponse.json({ configured: false, items: [] });
    }

    const state = await loadFullCommerceState(supabase, userId, companyId);

    return NextResponse.json({
      configured: true,
      items: state.slowStock,
      count: state.slowStock.length,
    });
  } catch (error) {
    return apiError(error, "Slow-moving stock items could not be loaded.");
  }
}
