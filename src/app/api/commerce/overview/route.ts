import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { getCommerceContext, loadFullCommerceState } from "@/lib/commerce-server";

export async function GET() {
  try {
    const { supabase, userId, companyId, isConfigured } = await getCommerceContext();
    if (!isConfigured || !companyId) {
      return NextResponse.json({
        configured: false,
        message: "Active company not configured.",
        currencyBuckets: {},
        productsCount: 0,
        activeRisks: [],
        nextMove: null,
      });
    }

    const state = await loadFullCommerceState(supabase, userId, companyId);

    const reorderNowCount = state.products.filter((p) => p.reorder.state === "reorder_now").length;
    const reviewSoonCount = state.products.filter((p) => p.reorder.state === "review_soon").length;
    const slowStockCount = state.slowStock.length;
    const lateOrdersCount = state.supplierOrders.filter((o) => o.health.state === "late").length;
    const openDiscrepanciesCount = state.discrepancies.filter(
      (d) => d.status === "investigating" || d.status === "verified"
    ).length;

    return NextResponse.json({
      configured: true,
      companyId,
      currencyBuckets: state.currencyBuckets,
      productsCount: state.products.length,
      suppliersCount: state.suppliers.length,
      metrics: {
        reorderNowCount,
        reviewSoonCount,
        slowStockCount,
        lateOrdersCount,
        openDiscrepanciesCount,
        missingCostCount: state.missingCostCount,
      },
      activeRisks: state.activeRisks.slice(0, 10),
      nextMove: state.nextMove,
    });
  } catch (error) {
    return apiError(error, "Commerce overview could not be loaded.");
  }
}
