import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { getCommerceContext } from "@/lib/commerce-server";
import { evaluateSupplierPerformance, currencyCodeSchema } from "@/lib/commerce";

const blank = (value: unknown) => (typeof value === "string" && !value.trim() ? null : value);
const optionalNumber = z.preprocess(blank, z.coerce.number().finite().nonnegative().nullable().optional());
const optionalInt = z.preprocess(blank, z.coerce.number().int().finite().nonnegative().nullable().optional());
const optionalText = (max = 5000) => z.preprocess(blank, z.string().trim().max(max).nullable().optional());

const supplierUpdateSchema = z.object({
  name: z.string().trim().min(1).max(240).optional(),
  contact_reference: optionalText(500),
  lead_time_days: optionalInt,
  minimum_order_value: optionalNumber,
  currency: currencyCodeSchema.optional(),
  payment_terms: optionalText(500),
  notes: optionalText(5000),
  active: z.boolean().optional(),
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

    const [supplierRes, ordersRes, linksRes] = await Promise.all([
      supabase
        .from("supplier_records")
        .select("*")
        .eq("id", id)
        .eq("user_id", userId)
        .eq("company_id", companyId)
        .maybeSingle(),
      supabase
        .from("supplier_orders")
        .select("*, supplier_order_items(*)")
        .eq("supplier_id", id)
        .eq("user_id", userId)
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("product_supplier_links")
        .select("*, product_catalog_refs(name, sku)")
        .eq("supplier_id", id)
        .eq("user_id", userId)
        .eq("company_id", companyId),
    ]);

    if (supplierRes.error) throw supplierRes.error;
    if (!supplierRes.data) {
      return NextResponse.json({ error: "Supplier not found." }, { status: 404 });
    }

    const orders = ordersRes.data ?? [];
    const allItems = orders.flatMap(
      (o) =>
        ((o as { supplier_order_items?: Array<{ supplier_order_id: string; quantity: string | number; quantity_received?: string | number | null }> })
          .supplier_order_items || [])
    );
    const performance = evaluateSupplierPerformance({
      supplier: supplierRes.data,
      orders,
      orderItems: allItems,
    });

    return NextResponse.json({
      supplier: supplierRes.data,
      orders,
      linkedProducts: linksRes.data ?? [],
      performance,
    });
  } catch (error) {
    return apiError(error, "Supplier details could not be loaded.");
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const input = supplierUpdateSchema.parse(body);
    const { supabase, userId, companyId, isConfigured } = await getCommerceContext();
    if (!isConfigured || !companyId) {
      return NextResponse.json({ error: "Active company not configured." }, { status: 400 });
    }

    const result = await supabase
      .from("supplier_records")
      .update({ ...input, updated_at: new Date().toISOString() } as never)
      .eq("id", id)
      .eq("user_id", userId)
      .eq("company_id", companyId)
      .select("*")
      .maybeSingle();

    if (result.error) throw result.error;
    if (!result.data) {
      return NextResponse.json({ error: "Supplier not found." }, { status: 404 });
    }

    return NextResponse.json({ supplier: result.data });
  } catch (error) {
    return apiError(error, "Supplier could not be updated.");
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { supabase, userId, companyId, isConfigured } = await getCommerceContext();
    if (!isConfigured || !companyId) {
      return NextResponse.json({ error: "Active company not configured." }, { status: 400 });
    }

    const result = await supabase
      .from("supplier_records")
      .update({ active: false, updated_at: new Date().toISOString() } as never)
      .eq("id", id)
      .eq("user_id", userId)
      .eq("company_id", companyId)
      .select("*")
      .maybeSingle();

    if (result.error) throw result.error;
    if (!result.data) {
      return NextResponse.json({ error: "Supplier not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true, supplier: result.data });
  } catch (error) {
    return apiError(error, "Supplier could not be deleted.");
  }
}
