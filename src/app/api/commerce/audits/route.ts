import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { getCommerceContext } from "@/lib/commerce-server";
import { inventoryAuditSchema } from "@/lib/commerce";

export async function GET() {
  try {
    const { supabase, userId, companyId, isConfigured } = await getCommerceContext();
    if (!isConfigured || !companyId) {
      return NextResponse.json({ configured: false, audits: [] });
    }

    const { data, error } = await supabase
      .from("inventory_audits")
      .select("*, inventory_audit_lines(*)")
      .eq("user_id", userId)
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      configured: true,
      audits: data ?? [],
      count: (data ?? []).length,
    });
  } catch (error) {
    return apiError(error, "Inventory audits could not be loaded.");
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, userId, companyId, isConfigured } = await getCommerceContext();
    if (!isConfigured || !companyId) {
      return NextResponse.json({ error: "Active company not configured." }, { status: 400 });
    }

    const input = inventoryAuditSchema.parse(await request.json());
    const nowIso = new Date().toISOString();

    const row = {
      ...input,
      user_id: userId,
      company_id: companyId,
      started_at: input.started_at || (input.status === "in_progress" ? nowIso : null),
      created_at: nowIso,
      updated_at: nowIso,
    };

    const result = await supabase
      .from("inventory_audits")
      .insert(row as never)
      .select("*")
      .single();

    if (result.error) throw result.error;

    return NextResponse.json({ audit: result.data }, { status: 201 });
  } catch (error) {
    return apiError(error, "Audit session could not be created.");
  }
}
