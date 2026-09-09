import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { getCommerceContext } from "@/lib/commerce-server";
import { inventoryAuditLineSchema, validateForeignOwnership } from "@/lib/commerce";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: auditId } = await params;
    const body = await request.json();
    const input = inventoryAuditLineSchema.parse({ ...body, audit_id: auditId });
    const { supabase, userId, companyId, isConfigured } = await getCommerceContext();
    if (!isConfigured || !companyId) {
      return NextResponse.json({ error: "Active company not configured." }, { status: 400 });
    }

    const check = await validateForeignOwnership(supabase, userId, companyId, {
      auditId,
      productId: input.product_id,
    });
    if (!check.valid) {
      return NextResponse.json({ error: check.error }, { status: 403 });
    }

    const varianceUnits = Number((input.counted_units - input.expected_units).toFixed(2));
    let costVariance: number | null = null;
    if (input.unit_cost !== null && input.unit_cost !== undefined) {
      costVariance = Number((varianceUnits * input.unit_cost).toFixed(2));
    }

    const lineRow = {
      ...input,
      variance_units: varianceUnits,
      cost_variance: costVariance,
      user_id: userId,
      company_id: companyId,
      created_at: new Date().toISOString(),
    };

    const lineResult = await supabase
      .from("inventory_audit_lines")
      .insert(lineRow as never)
      .select("*, product_catalog_refs(name, sku)")
      .single();

    if (lineResult.error) throw lineResult.error;

    // If variance is non-zero, automatically log discrepancy
    if (varianceUnits !== 0) {
      await supabase.from("inventory_discrepancies").insert({
        user_id: userId,
        company_id: companyId,
        product_id: input.product_id,
        audit_id: auditId,
        expected_stock: input.expected_units,
        actual_stock: input.counted_units,
        discrepancy_units: varianceUnits,
        cost_impact: costVariance,
        currency: input.currency,
        discrepancy_type: "counting_error",
        status: "investigating",
        resolution_notes: `Detected during audit line verification (${input.notes || "Count variance"}).`,
        reported_at: new Date().toISOString(),
      } as never);
    }

    return NextResponse.json({ line: lineResult.data }, { status: 201 });
  } catch (error) {
    return apiError(error, "Audit line could not be recorded.");
  }
}
