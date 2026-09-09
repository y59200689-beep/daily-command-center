import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { getCommerceContext } from "@/lib/commerce-server";
import { inventoryAdjustmentSchema, validateForeignOwnership } from "@/lib/commerce";

export async function GET() {
  try {
    const { supabase, userId, companyId, isConfigured } = await getCommerceContext();
    if (!isConfigured || !companyId) {
      return NextResponse.json({ configured: false, adjustments: [] });
    }

    const { data, error } = await supabase
      .from("inventory_adjustments")
      .select("*, product_catalog_refs(name, sku)")
      .eq("user_id", userId)
      .eq("company_id", companyId)
      .order("recorded_at", { ascending: false })
      .limit(100);

    if (error) throw error;

    return NextResponse.json({
      configured: true,
      adjustments: data ?? [],
      count: (data ?? []).length,
    });
  } catch (error) {
    return apiError(error, "Adjustments could not be loaded.");
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, userId, companyId, isConfigured } = await getCommerceContext();
    if (!isConfigured || !companyId) {
      return NextResponse.json({ error: "Active company not configured." }, { status: 400 });
    }

    const input = inventoryAdjustmentSchema.parse(await request.json());

    // Validate foreign ownership
    const check = await validateForeignOwnership(supabase, userId, companyId, {
      productId: input.product_id,
      auditId: input.audit_id || undefined,
    });
    if (!check.valid) {
      return NextResponse.json({ error: check.error }, { status: 403 });
    }

    // Get current available stock from latest snapshot
    const latestSnap = await supabase
      .from("inventory_snapshots")
      .select("available_stock, reserved_stock, reorder_level")
      .eq("product_id", input.product_id)
      .eq("user_id", userId)
      .eq("company_id", companyId)
      .order("captured_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const previousStock = latestSnap.data ? Number(latestSnap.data.available_stock) || 0 : 0;
    const newStock = Math.max(0, previousStock + Number(input.quantity_delta));
    const nowIso = new Date().toISOString();

    // 1. Insert adjustment record
    const adjRow = {
      ...input,
      user_id: userId,
      company_id: companyId,
      previous_stock: previousStock,
      new_stock: newStock,
      recorded_at: input.recorded_at || nowIso,
      created_at: nowIso,
    };

    const adjResult = await supabase
      .from("inventory_adjustments")
      .insert(adjRow as never)
      .select("*, product_catalog_refs(name, sku)")
      .single();

    if (adjResult.error) throw adjResult.error;

    // 2. Insert new inventory snapshot
    await supabase.from("inventory_snapshots").insert({
      user_id: userId,
      company_id: companyId,
      product_id: input.product_id,
      available_stock: newStock,
      reserved_stock: latestSnap.data?.reserved_stock ?? 0,
      reorder_level: latestSnap.data?.reorder_level ?? null,
      captured_at: nowIso,
      source: "adjustment",
    } as never);

    // 3. If tied to discrepancy, update discrepancy status
    if (input.discrepancy_id) {
      await supabase
        .from("inventory_discrepancies")
        .update({
          status: "adjusted",
          resolved_at: nowIso,
          updated_at: nowIso,
        } as never)
        .eq("id", input.discrepancy_id)
        .eq("user_id", userId)
        .eq("company_id", companyId);
    }

    return NextResponse.json({ adjustment: adjResult.data }, { status: 201 });
  } catch (error) {
    return apiError(error, "Adjustment could not be recorded.");
  }
}
