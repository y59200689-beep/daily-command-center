import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { getCommerceContext } from "@/lib/commerce-server";

export async function GET() {
  try {
    const { supabase, userId, companyId, isConfigured } = await getCommerceContext();
    if (!isConfigured || !companyId) {
      return NextResponse.json({ configured: false, movements: [] });
    }

    const [adjustmentsRes, orderItemsRes, supplierOrderItemsRes] = await Promise.all([
      supabase
        .from("inventory_adjustments")
        .select("*, product_catalog_refs(name, sku)")
        .eq("user_id", userId)
        .eq("company_id", companyId)
        .order("recorded_at", { ascending: false })
        .limit(50),
      supabase
        .from("commerce_order_items")
        .select("id, order_id, product_id, product_name, sku, quantity, created_at")
        .eq("user_id", userId)
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("supplier_order_items")
        .select("id, supplier_order_id, product_id, product_name, quantity_received, created_at")
        .eq("user_id", userId)
        .eq("company_id", companyId)
        .gt("quantity_received", 0)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    const movements = [];

    for (const adj of adjustmentsRes.data ?? []) {
      movements.push({
        id: `adj-${adj.id}`,
        type: "adjustment" as const,
        productId: adj.product_id,
        productName: adj.product_catalog_refs?.name || "Unknown Product",
        sku: adj.product_catalog_refs?.sku || null,
        delta: Number(adj.quantity_delta),
        previousStock: adj.previous_stock,
        newStock: adj.new_stock,
        reason: `${adj.adjustment_type}: ${adj.reason}`,
        timestamp: adj.recorded_at,
      });
    }

    for (const sale of orderItemsRes.data ?? []) {
      movements.push({
        id: `sale-${sale.id}`,
        type: "sale" as const,
        productId: sale.product_id,
        productName: sale.product_name,
        sku: sale.sku || null,
        delta: -(Number(sale.quantity) || 0),
        previousStock: null,
        newStock: null,
        reason: `Sales Order #${sale.order_id.slice(0, 8)}`,
        timestamp: sale.created_at,
      });
    }

    for (const receipt of supplierOrderItemsRes.data ?? []) {
      movements.push({
        id: `rcpt-${receipt.id}`,
        type: "receipt" as const,
        productId: receipt.product_id,
        productName: receipt.product_name,
        sku: null,
        delta: Number(receipt.quantity_received) || 0,
        previousStock: null,
        newStock: null,
        reason: `Supplier PO #${receipt.supplier_order_id.slice(0, 8)}`,
        timestamp: receipt.created_at,
      });
    }

    movements.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({
      configured: true,
      movements: movements.slice(0, 100),
      count: movements.length,
    });
  } catch (error) {
    return apiError(error, "Inventory movements could not be loaded.");
  }
}
