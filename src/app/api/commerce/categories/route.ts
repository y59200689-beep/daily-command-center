import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { getCommerceContext, loadFullCommerceState } from "@/lib/commerce-server";

export async function GET() {
  try {
    const { supabase, userId, companyId, isConfigured } = await getCommerceContext();
    if (!isConfigured || !companyId) {
      return NextResponse.json({ configured: false, categories: [] });
    }

    const state = await loadFullCommerceState(supabase, userId, companyId);
    const catMap = new Map<string, {
      name: string;
      productCount: number;
      availableStockUnits: number;
      soldUnits30d: number;
      currencyTotals: Record<string, { inventoryValue: number; salesValue30d: number }>;
      stockoutCount: number;
      overstockCount: number;
    }>();

    for (const p of state.products) {
      const cName = p.category?.trim() || "Uncategorized";
      if (!catMap.has(cName)) {
        catMap.set(cName, {
          name: cName,
          productCount: 0,
          availableStockUnits: 0,
          soldUnits30d: 0,
          currencyTotals: {},
          stockoutCount: 0,
          overstockCount: 0,
        });
      }

      const entry = catMap.get(cName)!;
      entry.productCount += 1;
      entry.availableStockUnits += p.availableStock;
      entry.soldUnits30d += p.totalSold30d;

      const curr = p.currency || "MAD";
      if (!entry.currencyTotals[curr]) {
        entry.currencyTotals[curr] = { inventoryValue: 0, salesValue30d: 0 };
      }
      if (p.unit_cost && p.availableStock > 0) {
        entry.currencyTotals[curr].inventoryValue += Number((p.unit_cost * p.availableStock).toFixed(2));
      }
      if (p.selling_price && p.totalSold30d > 0) {
        entry.currencyTotals[curr].salesValue30d += Number((p.selling_price * p.totalSold30d).toFixed(2));
      }

      if (p.stockout.state === "critical" || p.stockout.state === "high") {
        entry.stockoutCount += 1;
      }
      if (p.overstock.state === "high" || p.overstock.state === "elevated") {
        entry.overstockCount += 1;
      }
    }

    const categories = Array.from(catMap.values()).sort((a, b) => b.productCount - a.productCount);

    return NextResponse.json({
      configured: true,
      categories,
      count: categories.length,
    });
  } catch (error) {
    return apiError(error, "Categories aggregation could not be loaded.");
  }
}
