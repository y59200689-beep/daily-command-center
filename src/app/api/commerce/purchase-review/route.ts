import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { getCommerceContext, loadFullCommerceState } from "@/lib/commerce-server";

export async function GET() {
  try {
    const { supabase, userId, companyId, isConfigured } = await getCommerceContext();
    if (!isConfigured || !companyId) {
      return NextResponse.json({ configured: false, reviewItems: [] });
    }

    const state = await loadFullCommerceState(supabase, userId, companyId);
    const attentionOrders = state.supplierOrders
      .filter((o) => o.health.state === "late" || o.health.state === "needs_attention" || o.health.state === "partial")
      .sort((a, b) => {
        if (a.health.state === "late" && b.health.state !== "late") return -1;
        if (a.health.state !== "late" && b.health.state === "late") return 1;
        return b.health.daysOverdue - a.health.daysOverdue;
      });

    return NextResponse.json({
      configured: true,
      reviewItems: attentionOrders,
      count: attentionOrders.length,
    });
  } catch (error) {
    return apiError(error, "Purchase review items could not be loaded.");
  }
}
