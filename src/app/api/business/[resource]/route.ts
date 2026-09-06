import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { businessResourceSchemas, businessResourceTables, isBusinessResource, proposalTotals, type BusinessResource } from "@/lib/business";
import { requireUser } from "@/lib/supabase/server";

const archivedColumn: Partial<Record<BusinessResource, string>> = { leads: "archived_at", services: "archived_at", opportunities: "archived_at", proposals: "archived_at" };

function tableFor(resource: Exclude<BusinessResource, "settings">) { return businessResourceTables[resource]; }
async function owned(client: Awaited<ReturnType<typeof requireUser>>["supabase"], userId: string, table: string, id: string | null | undefined) {
  if (!id) return;
  const { data, error } = await client.from(table).select("id").eq("id", id).eq("user_id", userId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("A linked record is not available in your workspace.");
}
async function validateLinks(client: Awaited<ReturnType<typeof requireUser>>["supabase"], userId: string, values: Record<string, unknown>) {
  await Promise.all([
    owned(client, userId, "leads", values.lead_id as string | null | undefined), owned(client, userId, "clients", values.client_id as string | null | undefined),
    owned(client, userId, "opportunities", values.opportunity_id as string | null | undefined), owned(client, userId, "projects", values.project_id as string | null | undefined),
    owned(client, userId, "services", values.service_id as string | null | undefined), owned(client, userId, "proposal_items", values.proposal_item_id as string | null | undefined),
  ]);
}
async function audit(client: Awaited<ReturnType<typeof requireUser>>["supabase"], userId: string, action: string, entityType: string, entityId: string, summary: string) {
  await client.from("action_audit_log").insert({ user_id: userId, actor: "user", action_type: action, entity_type: entityType, entity_id: entityId, summary } as never);
}

export async function GET(request: NextRequest, context: { params: Promise<{ resource: string }> }) {
  try {
    const { resource } = await context.params;
    if (!isBusinessResource(resource)) return NextResponse.json({ error: "Business collection not found." }, { status: 404 });
    const { supabase, userId } = await requireUser();
    if (resource === "settings") {
      const { data, error } = await supabase.from("business_settings").select("*").eq("user_id", userId).maybeSingle();
      if (error) throw error;
      return NextResponse.json({ record: data ?? { default_currency: "MAD", internal_hourly_cost: null, default_proposal_validity_days: null, default_tax_rate: null } });
    }
    const page = Math.max(1, Number(request.nextUrl.searchParams.get("page") ?? 1));
    const pageSize = Math.min(100, Math.max(10, Number(request.nextUrl.searchParams.get("pageSize") ?? 50)));
    const search = request.nextUrl.searchParams.get("q")?.trim();
    const table = tableFor(resource);
    let query = supabase.from(table).select("*", { count: "exact" }).eq("user_id", userId).order("updated_at", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
    const archive = archivedColumn[resource];
    if (archive) query = query.is(archive, null);
    if (search) {
      const searchColumn = resource === "leads" || resource === "services" ? "name" : resource === "scope-changes" ? "description" : "title";
      query = query.ilike(searchColumn, `%${search.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`);
    }
    const { data, error, count } = await query;
    if (error) throw error;
    if (resource === "proposals") {
      const ids = (data ?? []).map((row) => String(row.id));
      const { data: items, error: itemsError } = ids.length ? await supabase.from("proposal_items").select("*").eq("user_id", userId).in("proposal_id", ids).order("position") : { data: [], error: null };
      if (itemsError) throw itemsError;
      return NextResponse.json({ records: (data ?? []).map((proposal) => ({ ...proposal, items: (items ?? []).filter((item) => item.proposal_id === proposal.id) })), total: count ?? 0, page, pageSize });
    }
    return NextResponse.json({ records: data ?? [], total: count ?? 0, page, pageSize });
  } catch (error) { return apiError(error, "Business records could not be loaded."); }
}

export async function POST(request: Request, context: { params: Promise<{ resource: string }> }) {
  try {
    const { resource } = await context.params;
    if (!isBusinessResource(resource) || resource === "settings") return NextResponse.json({ error: "Business collection not found." }, { status: 404 });
    const parsed = businessResourceSchemas[resource].parse(await request.json()) as Record<string, unknown>;
    const { supabase, userId } = await requireUser();
    await validateLinks(supabase, userId, parsed);
    if (resource === "proposals") {
      const { items, ...proposal } = parsed as Record<string, unknown> & { items: Array<Record<string, unknown>> };
      await Promise.all(items.map((item) => owned(supabase, userId, "services", item.service_id as string | null | undefined)));
      const totals = proposalTotals(items.map((item) => ({ quantity: Number(item.quantity), unit_price: Number(item.unit_price) })), Number(proposal.discount_amount ?? 0), Number(proposal.tax_amount ?? 0));
      const { data, error } = await supabase.from("proposals").insert({ ...proposal, user_id: userId, subtotal: totals.subtotal, total: totals.total } as never).select("*").single();
      if (error) throw error;
      if (items.length) {
        const { error: itemError } = await supabase.from("proposal_items").insert(items.map((item, index) => ({ ...item, user_id: userId, proposal_id: data.id, position: Number(item.position ?? index), total: totals.itemTotals[index] })) as never);
        if (itemError) throw itemError;
      }
      await audit(supabase, userId, "proposal_created", "proposal", data.id, `Created proposal ${data.title}.`);
      return NextResponse.json({ record: data }, { status: 201 });
    }
    const table = tableFor(resource);
    const { data, error } = await supabase.from(table).insert({ ...parsed, user_id: userId } as never).select("*").single();
    if (error) throw error;
    if (resource === "opportunities") await supabase.from("opportunity_stage_history").insert({ user_id: userId, opportunity_id: data.id, to_stage: data.stage } as never);
    await audit(supabase, userId, `${resource.slice(0, -1)}_created`, resource.slice(0, -1), data.id, `Created ${resource.slice(0, -1)} ${String(data.name ?? data.title)}.`);
    return NextResponse.json({ record: data }, { status: 201 });
  } catch (error) { return apiError(error, "Business record could not be saved."); }
}

export async function PATCH(request: Request, context: { params: Promise<{ resource: string }> }) {
  try {
    const { resource } = await context.params;
    if (!isBusinessResource(resource)) return NextResponse.json({ error: "Business collection not found." }, { status: 404 });
    const body = await request.json() as { id?: string } & Record<string, unknown>;
    const { supabase, userId } = await requireUser();
    if (resource === "settings") {
      const settingsChanges = { ...body }; delete settingsChanges.id;
      const values = businessResourceSchemas.settings.parse(settingsChanges);
      const { data, error } = await supabase.from("business_settings").upsert({ ...values, user_id: userId } as never, { onConflict: "user_id" }).select("*").single();
      if (error) throw error;
      await audit(supabase, userId, "business_settings_changed", "business_settings", userId, "Updated business settings.");
      return NextResponse.json({ record: data });
    }
    if (!body.id || !zUuid(body.id)) return NextResponse.json({ error: "Record is unavailable." }, { status: 400 });
    const { id, ...changes } = body;
    const parsed = businessResourceSchemas[resource].partial().parse(changes) as Record<string, unknown>;
    await validateLinks(supabase, userId, parsed);
    const table = tableFor(resource);
    const { data: previous, error: previousError } = await supabase.from(table).select("*").eq("id", id).eq("user_id", userId).maybeSingle();
    if (previousError) throw previousError;
    if (!previous) return NextResponse.json({ error: "Record is unavailable." }, { status: 404 });
    if (resource === "proposals" && previous.status !== "draft" && Object.keys(parsed).some((key) => !["status"].includes(key))) {
      const { data: oldItems, error: oldItemsError } = await supabase.from("proposal_items").select("*").eq("user_id", userId).eq("proposal_id", id).order("position");
      if (oldItemsError) throw oldItemsError;
      const { count, error: versionError } = await supabase.from("proposal_versions").select("id", { count: "exact", head: true }).eq("proposal_id", id).eq("user_id", userId);
      if (versionError) throw versionError;
      const { error: snapshotError } = await supabase.from("proposal_versions").insert({ user_id: userId, proposal_id: id, version_number: (count ?? 0) + 1, snapshot: { proposal: previous, items: oldItems ?? [] }, reason: "Edited after sending" } as never);
      if (snapshotError) throw snapshotError;
    }
    let proposalItems: Array<Record<string, unknown>> | undefined;
    if (resource === "proposals" && "items" in parsed) {
      proposalItems = Array.isArray(parsed.items) ? parsed.items as Array<Record<string, unknown>> : [];
      await Promise.all(proposalItems.map((item) => owned(supabase, userId, "services", item.service_id as string | null | undefined)));
      delete parsed.items;
      const totals = proposalTotals(proposalItems.map((item) => ({ quantity: Number(item.quantity), unit_price: Number(item.unit_price) })), Number(parsed.discount_amount ?? previous.discount_amount ?? 0), Number(parsed.tax_amount ?? previous.tax_amount ?? 0));
      parsed.subtotal = totals.subtotal; parsed.total = totals.total;
    }
    const { data, error } = await supabase.from(table).update(parsed as never).eq("id", id).eq("user_id", userId).select("*").single();
    if (error) throw error;
    if (resource === "proposals" && proposalItems) {
      const { error: removeError } = await supabase.from("proposal_items").delete().eq("proposal_id", id).eq("user_id", userId);
      if (removeError) throw removeError;
      if (proposalItems.length) {
        const lineTotals = proposalTotals(proposalItems.map((item) => ({ quantity: Number(item.quantity), unit_price: Number(item.unit_price) }))).itemTotals;
        const { error: insertError } = await supabase.from("proposal_items").insert(proposalItems.map((item, index) => ({ ...item, user_id: userId, proposal_id: id, position: Number(item.position ?? index), total: lineTotals[index] })) as never);
        if (insertError) throw insertError;
      }
    }
    if (resource === "opportunities" && parsed.stage && parsed.stage !== previous.stage) {
      const stage = String(parsed.stage);
      await supabase.from("opportunity_stage_history").insert({ user_id: userId, opportunity_id: id, from_stage: previous.stage, to_stage: stage } as never);
      await audit(supabase, userId, stage === "won" ? "opportunity_won" : stage === "lost" ? "opportunity_lost" : "opportunity_stage_changed", "opportunity", id, `Moved opportunity to ${stage}.`);
    }
    if (resource === "proposals" && parsed.status) await audit(supabase, userId, `proposal_${String(parsed.status)}`, "proposal", id, `Updated proposal status to ${String(parsed.status)}.`);
    return NextResponse.json({ record: data });
  } catch (error) { return apiError(error, "Business record could not be updated."); }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ resource: string }> }) {
  try {
    const { resource } = await context.params;
    const id = request.nextUrl.searchParams.get("id");
    if (!id || !isBusinessResource(resource) || resource === "settings") return NextResponse.json({ error: "Record is unavailable." }, { status: 400 });
    const { supabase, userId } = await requireUser();
    const archive = archivedColumn[resource];
    const table = tableFor(resource);
    const { data, error } = archive ? await supabase.from(table).update({ [archive]: new Date().toISOString() } as never).eq("id", id).eq("user_id", userId).select("id").maybeSingle() : await supabase.from(table).delete().eq("id", id).eq("user_id", userId).select("id").maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Record is unavailable." }, { status: 404 });
    await audit(supabase, userId, `${resource.slice(0, -1)}_archived`, resource.slice(0, -1), id, `Archived ${resource.slice(0, -1)}.`);
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error, "Business record could not be archived."); }
}

function zUuid(value: string) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
