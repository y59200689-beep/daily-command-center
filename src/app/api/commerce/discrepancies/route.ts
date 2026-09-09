import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { getCommerceContext } from "@/lib/commerce-server";
import { inventoryDiscrepancySchema, validateForeignOwnership } from "@/lib/commerce";

export async function GET() {
  try {
    const { supabase, userId, companyId, isConfigured } = await getCommerceContext();
    if (!isConfigured || !companyId) {
      return NextResponse.json({ configured: false, discrepancies: [] });
    }

    const { data, error } = await supabase
      .from("inventory_discrepancies")
      .select("*, product_catalog_refs(name, sku)")
      .eq("user_id", userId)
      .eq("company_id", companyId)
      .order("reported_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      configured: true,
      discrepancies: data ?? [],
      count: (data ?? []).length,
    });
  } catch (error) {
    return apiError(error, "Discrepancies could not be loaded.");
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, userId, companyId, isConfigured } = await getCommerceContext();
    if (!isConfigured || !companyId) {
      return NextResponse.json({ error: "Active company not configured." }, { status: 400 });
    }

    const input = inventoryDiscrepancySchema.parse(await request.json());

    // Validate product ownership
    const check = await validateForeignOwnership(supabase, userId, companyId, {
      productId: input.product_id,
      auditId: input.audit_id || undefined,
    });
    if (!check.valid) {
      return NextResponse.json({ error: check.error }, { status: 403 });
    }

    const row = {
      ...input,
      user_id: userId,
      company_id: companyId,
      reported_at: input.reported_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const result = await supabase
      .from("inventory_discrepancies")
      .insert(row as never)
      .select("*, product_catalog_refs(name, sku)")
      .single();

    if (result.error) throw result.error;

    return NextResponse.json({ discrepancy: result.data }, { status: 201 });
  } catch (error) {
    return apiError(error, "Discrepancy could not be recorded.");
  }
}
