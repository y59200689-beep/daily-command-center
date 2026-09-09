import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { getCommerceContext } from "@/lib/commerce-server";

const blank = (value: unknown) => (typeof value === "string" && !value.trim() ? null : value);
const optionalText = (max = 5000) => z.preprocess(blank, z.string().trim().max(max).nullable().optional());

const auditUpdateSchema = z.object({
  status: z.enum(["draft", "in_progress", "completed", "cancelled"]).optional(),
  title: z.string().trim().min(1).max(240).optional(),
  location: optionalText(160),
  notes: optionalText(5000),
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

    const [auditRes, linesRes] = await Promise.all([
      supabase
        .from("inventory_audits")
        .select("*")
        .eq("id", id)
        .eq("user_id", userId)
        .eq("company_id", companyId)
        .maybeSingle(),
      supabase
        .from("inventory_audit_lines")
        .select("*, product_catalog_refs(name, sku)")
        .eq("audit_id", id)
        .eq("user_id", userId)
        .eq("company_id", companyId),
    ]);

    if (auditRes.error) throw auditRes.error;
    if (!auditRes.data) {
      return NextResponse.json({ error: "Audit not found." }, { status: 404 });
    }

    return NextResponse.json({
      audit: auditRes.data,
      lines: linesRes.data ?? [],
    });
  } catch (error) {
    return apiError(error, "Audit detail could not be loaded.");
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const input = auditUpdateSchema.parse(body);
    const { supabase, userId, companyId, isConfigured } = await getCommerceContext();
    if (!isConfigured || !companyId) {
      return NextResponse.json({ error: "Active company not configured." }, { status: 400 });
    }

    const nowIso = new Date().toISOString();
    const completedAt = input.status === "completed" ? nowIso : undefined;
    const startedAt = input.status === "in_progress" ? nowIso : undefined;

    const updates: Record<string, unknown> = {
      ...input,
      updated_at: nowIso,
    };
    if (completedAt) updates.completed_at = completedAt;
    if (startedAt) updates.started_at = startedAt;

    const result = await supabase
      .from("inventory_audits")
      .update(updates as never)
      .eq("id", id)
      .eq("user_id", userId)
      .eq("company_id", companyId)
      .select("*")
      .maybeSingle();

    if (result.error) throw result.error;
    if (!result.data) {
      return NextResponse.json({ error: "Audit not found." }, { status: 404 });
    }

    return NextResponse.json({ audit: result.data });
  } catch (error) {
    return apiError(error, "Audit could not be updated.");
  }
}
