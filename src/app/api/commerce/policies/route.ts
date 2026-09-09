import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { getCommerceContext } from "@/lib/commerce-server";
import { inventoryPolicySchema, validateForeignOwnership } from "@/lib/commerce";

export async function GET() {
  try {
    const { supabase, userId, companyId, isConfigured } = await getCommerceContext();
    if (!isConfigured || !companyId) {
      return NextResponse.json({ configured: false, policies: [] });
    }

    const { data, error } = await supabase
      .from("inventory_policies")
      .select("*, product_catalog_refs(name, sku)")
      .eq("user_id", userId)
      .eq("company_id", companyId);

    if (error) throw error;

    return NextResponse.json({
      configured: true,
      policies: data ?? [],
      count: (data ?? []).length,
    });
  } catch (error) {
    return apiError(error, "Inventory policies could not be loaded.");
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, userId, companyId, isConfigured } = await getCommerceContext();
    if (!isConfigured || !companyId) {
      return NextResponse.json({ error: "Active company not configured." }, { status: 400 });
    }

    const input = inventoryPolicySchema.parse(await request.json());

    // Validate product ownership
    const check = await validateForeignOwnership(supabase, userId, companyId, {
      productId: input.product_id,
    });
    if (!check.valid) {
      return NextResponse.json({ error: check.error }, { status: 403 });
    }

    const row = {
      ...input,
      user_id: userId,
      company_id: companyId,
      updated_at: new Date().toISOString(),
    };

    let result;
    if (input.id) {
      result = await supabase
        .from("inventory_policies")
        .update(row as never)
        .eq("id", input.id)
        .eq("user_id", userId)
        .eq("company_id", companyId)
        .select("*, product_catalog_refs(name, sku)")
        .maybeSingle();
    } else {
      // Upsert based on (company_id, product_id)
      result = await supabase
        .from("inventory_policies")
        .upsert(row as never, { onConflict: "company_id,product_id" })
        .select("*, product_catalog_refs(name, sku)")
        .single();
    }

    if (result.error) throw result.error;

    return NextResponse.json({ policy: result.data }, { status: 200 });
  } catch (error) {
    return apiError(error, "Inventory policy could not be saved.");
  }
}
