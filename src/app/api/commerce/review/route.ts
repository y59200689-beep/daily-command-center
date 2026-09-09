import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { getCommerceContext } from "@/lib/commerce-server";
import { commerceReviewSchema } from "@/lib/commerce";

export async function GET() {
  try {
    const { supabase, userId, companyId, isConfigured } = await getCommerceContext();
    if (!isConfigured || !companyId) {
      return NextResponse.json({ configured: false, review: null });
    }

    const { data, error } = await supabase
      .from("commerce_review_records")
      .select("*")
      .eq("user_id", userId)
      .eq("company_id", companyId)
      .order("conducted_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({
      configured: true,
      review: data ?? null,
    });
  } catch (error) {
    return apiError(error, "Commerce review record could not be loaded.");
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, userId, companyId, isConfigured } = await getCommerceContext();
    if (!isConfigured || !companyId) {
      return NextResponse.json({ error: "Active company not configured." }, { status: 400 });
    }

    const input = commerceReviewSchema.parse(await request.json());
    const nowIso = new Date().toISOString();

    const row = {
      ...input,
      user_id: userId,
      company_id: companyId,
      conducted_at: input.conducted_at || nowIso,
      created_at: nowIso,
      updated_at: nowIso,
    };

    const result = await supabase
      .from("commerce_review_records")
      .insert(row as never)
      .select("*")
      .single();

    if (result.error) throw result.error;

    return NextResponse.json({ review: result.data }, { status: 201 });
  } catch (error) {
    return apiError(error, "Commerce review record could not be saved.");
  }
}
