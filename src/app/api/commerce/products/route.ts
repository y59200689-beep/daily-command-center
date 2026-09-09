import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { getCommerceContext, loadFullCommerceState } from "@/lib/commerce-server";
import { currencyCodeSchema } from "@/lib/commerce";

const blank = (value: unknown) => (typeof value === "string" && !value.trim() ? null : value);
const optionalNumber = z.preprocess(blank, z.coerce.number().finite().nonnegative().nullable().optional());
const optionalText = (max = 240) => z.preprocess(blank, z.string().trim().max(max).nullable().optional());

const productCreateSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(240),
  sku: optionalText(160),
  category: optionalText(160),
  brand: optionalText(160),
  currency: currencyCodeSchema,
  unit_cost: optionalNumber,
  selling_price: optionalNumber,
  active: z.boolean().default(true),
});

export async function GET() {
  try {
    const { supabase, userId, companyId, isConfigured } = await getCommerceContext();
    if (!isConfigured || !companyId) {
      return NextResponse.json({ configured: false, products: [] });
    }

    const state = await loadFullCommerceState(supabase, userId, companyId);
    return NextResponse.json({
      configured: true,
      products: state.products,
      count: state.products.length,
    });
  } catch (error) {
    return apiError(error, "Commerce products could not be loaded.");
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, userId, companyId, isConfigured } = await getCommerceContext();
    if (!isConfigured || !companyId) {
      return NextResponse.json({ error: "Active company not configured." }, { status: 400 });
    }

    const input = productCreateSchema.parse(await request.json());
    const row = {
      ...input,
      user_id: userId,
      company_id: companyId,
      updated_at: new Date().toISOString(),
    };

    let result;
    if (input.id) {
      result = await supabase
        .from("product_catalog_refs")
        .update(row as never)
        .eq("id", input.id)
        .eq("user_id", userId)
        .eq("company_id", companyId)
        .select("*")
        .maybeSingle();
    } else {
      result = await supabase
        .from("product_catalog_refs")
        .insert(row as never)
        .select("*")
        .single();
    }

    if (result.error) throw result.error;
    if (!result.data) {
      return NextResponse.json({ error: "Product not found or not owned." }, { status: 404 });
    }

    return NextResponse.json({ product: result.data }, { status: input.id ? 200 : 201 });
  } catch (error) {
    return apiError(error, "Commerce product could not be saved.");
  }
}
