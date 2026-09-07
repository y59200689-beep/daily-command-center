import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";
import { computeOfferIntelligence } from "@/lib/growth";

export async function GET() {
  try {
    const { supabase, userId } = await requireUser();

    const [servicesRes, itemsRes, proposalsRes, oppsRes] = await Promise.all([
      supabase.from("services").select("id,name,category,default_price,pricing_type,active").eq("user_id", userId).is("archived_at", null),
      supabase.from("proposal_items").select("id,proposal_id,service_id,total").eq("user_id", userId),
      supabase.from("proposals").select("id,status,total,discount_amount").eq("user_id", userId).is("archived_at", null),
      supabase.from("opportunities").select("id,stage,estimated_value").eq("user_id", userId).is("archived_at", null),
    ]);

    if (servicesRes.error) throw servicesRes.error;
    if (itemsRes.error) throw itemsRes.error;
    if (proposalsRes.error) throw proposalsRes.error;
    if (oppsRes.error) throw oppsRes.error;

    const metrics = computeOfferIntelligence(
      servicesRes.data ?? [],
      itemsRes.data ?? [],
      proposalsRes.data ?? [],
      oppsRes.data ?? []
    );

    return NextResponse.json({ offers: metrics });
  } catch (error) {
    return apiError(error, "Offer intelligence could not be loaded.");
  }
}
