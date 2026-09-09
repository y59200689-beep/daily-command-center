import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { getCommerceContext } from "@/lib/commerce-server";
import { commerceProductUpdateSchema } from "@/lib/commerce";

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

    const [productRes, snapshotsRes, policiesRes, linksRes, discrepanciesRes] =
      await Promise.all([
        supabase
          .from("product_catalog_refs")
          .select("*")
          .eq("id", id)
          .eq("user_id", userId)
          .eq("company_id", companyId)
          .maybeSingle(),
        supabase
          .from("inventory_snapshots")
          .select("*")
          .eq("product_id", id)
          .eq("user_id", userId)
          .eq("company_id", companyId)
          .order("captured_at", { ascending: false })
          .limit(20),
        supabase
          .from("inventory_policies")
          .select("*")
          .eq("product_id", id)
          .eq("user_id", userId)
          .eq("company_id", companyId)
          .maybeSingle(),
        supabase
          .from("product_supplier_links")
          .select("*, supplier_records(name)")
          .eq("product_id", id)
          .eq("user_id", userId)
          .eq("company_id", companyId),
        supabase
          .from("inventory_discrepancies")
          .select("*")
          .eq("product_id", id)
          .eq("user_id", userId)
          .eq("company_id", companyId)
          .order("reported_at", { ascending: false })
          .limit(10),
      ]);

    if (productRes.error) throw productRes.error;
    if (!productRes.data) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    return NextResponse.json({
      product: productRes.data,
      snapshots: snapshotsRes.data ?? [],
      policy: policiesRes.data ?? null,
      supplierLinks: linksRes.data ?? [],
      discrepancies: discrepanciesRes.data ?? [],
    });
  } catch (error) {
    return apiError(error, "Product details could not be loaded.");
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const input = commerceProductUpdateSchema.parse({ ...body, id });
    const { supabase, userId, companyId, isConfigured } = await getCommerceContext();
    if (!isConfigured || !companyId) {
      return NextResponse.json({ error: "Active company not configured." }, { status: 400 });
    }

    const updateFields = { ...input };
    delete (updateFields as { id?: string }).id;
    const result = await supabase
      .from("product_catalog_refs")
      .update({ ...updateFields, updated_at: new Date().toISOString() } as never)
      .eq("id", id)
      .eq("user_id", userId)
      .eq("company_id", companyId)
      .select("*")
      .maybeSingle();

    if (result.error) throw result.error;
    if (!result.data) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    return NextResponse.json({ product: result.data });
  } catch (error) {
    return apiError(error, "Product could not be updated.");
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

    // Soft-delete by setting active=false
    const result = await supabase
      .from("product_catalog_refs")
      .update({ active: false, updated_at: new Date().toISOString() } as never)
      .eq("id", id)
      .eq("user_id", userId)
      .eq("company_id", companyId)
      .select("*")
      .maybeSingle();

    if (result.error) throw result.error;
    if (!result.data) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true, product: result.data });
  } catch (error) {
    return apiError(error, "Product could not be deleted.");
  }
}
