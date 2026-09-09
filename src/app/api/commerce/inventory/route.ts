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
    const items = state.products.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      category: p.category,
      brand: p.brand,
      availableStock: p.availableStock,
      reservedStock: p.reservedStock,
      unitCost: p.unit_cost,
      sellingPrice: p.selling_price,
      currency: p.currency,
      dailyVelocity: p.dailyVelocity,
      totalSold30d: p.totalSold30d,
      stockout: p.stockout,
      overstock: p.overstock,
      leadTimeDays: p.leadTimeDays,
      policy: p.policy,
    }));

    return NextResponse.json({
      configured: true,
      items,
      count: items.length,
    });
  } catch (error) {
    return apiError(error, "Inventory items could not be loaded.");
  }
}
