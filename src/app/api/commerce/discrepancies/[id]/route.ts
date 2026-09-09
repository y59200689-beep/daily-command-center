import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { getCommerceContext } from "@/lib/commerce-server";

const blank = (value: unknown) => (typeof value === "string" && !value.trim() ? null : value);
const optionalText = (max = 5000) => z.preprocess(blank, z.string().trim().max(max).nullable().optional());

const discrepancyUpdateSchema = z.object({
  status: z.enum(["investigating", "verified", "adjusted", "dismissed"]).optional(),
  resolution_notes: optionalText(5000),
  discrepancy_type: z
    .enum(["shrinkage", "counting_error", "damage", "supplier_variance", "admin_error", "unexplained"])
    .optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { supabase, userId, companyId, isConfigured } = await getCommerceContext();
    if (!isConfigured || !companyId) {
      return NextResponse.json({ error: "Active company not configured." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("inventory_discrepancies")
      .select("*, product_catalog_refs(name, sku)")
      .eq("id", id)
      .eq("user_id", userId)
      .eq("company_id", companyId)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: "Discrepancy not found." }, { status: 404 });
    }

    return NextResponse.json({ discrepancy: data });
  } catch (error) {
    return apiError(error, "Discrepancy could not be loaded.");
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const input = discrepancyUpdateSchema.parse(body);
    const { supabase, userId, companyId, isConfigured } = await getCommerceContext();
    if (!isConfigured || !companyId) {
      return NextResponse.json({ error: "Active company not configured." }, { status: 400 });
    }

    const resolvedAt =
      input.status === "adjusted" || input.status === "dismissed"
        ? new Date().toISOString()
        : null;

    const result = await supabase
      .from("inventory_discrepancies")
      .update({
        ...input,
        resolved_at: resolvedAt,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", id)
      .eq("user_id", userId)
      .eq("company_id", companyId)
      .select("*, product_catalog_refs(name, sku)")
      .maybeSingle();

    if (result.error) throw result.error;
    if (!result.data) {
      return NextResponse.json({ error: "Discrepancy not found." }, { status: 404 });
    }

    return NextResponse.json({ discrepancy: result.data });
  } catch (error) {
    return apiError(error, "Discrepancy could not be updated.");
  }
}
