import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { getCommerceContext, loadFullCommerceState } from "@/lib/commerce-server";
import { currencyCodeSchema } from "@/lib/commerce";

const blank = (value: unknown) => (typeof value === "string" && !value.trim() ? null : value);
const optionalNumber = z.preprocess(blank, z.coerce.number().finite().nonnegative().nullable().optional());
const optionalInt = z.preprocess(blank, z.coerce.number().int().finite().nonnegative().nullable().optional());
const optionalText = (max = 5000) => z.preprocess(blank, z.string().trim().max(max).nullable().optional());

const supplierSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(240),
  contact_reference: optionalText(500),
  lead_time_days: optionalInt.default(7),
  minimum_order_value: optionalNumber,
  currency: currencyCodeSchema,
  payment_terms: optionalText(500),
  notes: optionalText(5000),
  active: z.boolean().default(true),
});

export async function GET() {
  try {
    const { supabase, userId, companyId, isConfigured } = await getCommerceContext();
    if (!isConfigured || !companyId) {
      return NextResponse.json({ configured: false, suppliers: [] });
    }

    const state = await loadFullCommerceState(supabase, userId, companyId);
    return NextResponse.json({
      configured: true,
      suppliers: state.suppliers,
      count: state.suppliers.length,
    });
  } catch (error) {
    return apiError(error, "Suppliers could not be loaded.");
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, userId, companyId, isConfigured } = await getCommerceContext();
    if (!isConfigured || !companyId) {
      return NextResponse.json({ error: "Active company not configured." }, { status: 400 });
    }

    const input = supplierSchema.parse(await request.json());
    const row = {
      ...input,
      user_id: userId,
      company_id: companyId,
      updated_at: new Date().toISOString(),
    };

    let result;
    if (input.id) {
      result = await supabase
        .from("supplier_records")
        .update(row as never)
        .eq("id", input.id)
        .eq("user_id", userId)
        .eq("company_id", companyId)
        .select("*")
        .maybeSingle();
    } else {
      result = await supabase
        .from("supplier_records")
        .insert(row as never)
        .select("*")
        .single();
    }

    if (result.error) throw result.error;
    if (!result.data) {
      return NextResponse.json({ error: "Supplier not found or not owned." }, { status: 404 });
    }

    return NextResponse.json({ supplier: result.data }, { status: input.id ? 200 : 201 });
  } catch (error) {
    return apiError(error, "Supplier could not be saved.");
  }
}
