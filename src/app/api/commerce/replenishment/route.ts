import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { getCommerceContext, loadFullCommerceState } from "@/lib/commerce-server";

export async function GET() {
  try {
    const { supabase, userId, companyId, isConfigured } = await getCommerceContext();
    if (!isConfigured || !companyId) {
      return NextResponse.json({ configured: false, recommendations: [] });
    }

    const state = await loadFullCommerceState(supabase, userId, companyId);
    const supplierMap = new Map(state.suppliers.map((s) => [s.id, s.name]));

    const recommendations = state.products
      .map((p) => {
        const supName = p.reorder.primarySupplierId
          ? supplierMap.get(p.reorder.primarySupplierId) ?? "Unknown Supplier"
          : "Unassigned Supplier";
        return {
          ...p.reorder,
          supplierName: supName,
          availableStock: p.availableStock,
          dailyVelocity: p.dailyVelocity,
          unitCost: p.unit_cost,
        };
      })
      .filter((r) => r.state === "reorder_now" || r.state === "review_soon")
      .sort((a, b) => {
        if (a.state === "reorder_now" && b.state !== "reorder_now") return -1;
        if (a.state !== "reorder_now" && b.state === "reorder_now") return 1;
        return (a.coverageDays ?? 999) - (b.coverageDays ?? 999);
      });

    return NextResponse.json({
      configured: true,
      recommendations,
      count: recommendations.length,
    });
  } catch (error) {
    return apiError(error, "Replenishment recommendations could not be loaded.");
  }
}
