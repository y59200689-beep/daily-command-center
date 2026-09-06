import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
    if (query.length < 2) return NextResponse.json({ data: [] });
    const [workspace, products, suppliers, orders, roadmap, incidents, support, githubWork, marketing] = await Promise.all([
      supabase.rpc("search_workspace", { search_query: query, result_limit: 30 }),
      supabase.from("product_catalog_refs").select("id,name,sku").eq("user_id", userId).ilike("name", `%${query.replaceAll("%", "\\%")}%`).limit(8),
      supabase.from("supplier_records").select("id,name,contact_reference").eq("user_id", userId).ilike("name", `%${query.replaceAll("%", "\\%")}%`).limit(8),
      supabase.from("supplier_orders").select("id,reference,status").eq("user_id", userId).ilike("reference", `%${query.replaceAll("%", "\\%")}%`).limit(8),
      supabase.from("product_roadmap_items").select("id,title,status").eq("user_id", userId).ilike("title", `%${query.replaceAll("%", "\\%")}%`).limit(8),
      supabase.from("incidents").select("id,title,severity").eq("user_id", userId).ilike("title", `%${query.replaceAll("%", "\\%")}%`).limit(8),
      supabase.from("support_cases").select("id,summary,category").eq("user_id", userId).ilike("summary", `%${query.replaceAll("%", "\\%")}%`).limit(8),
      supabase.from("github_work_items").select("id,title,kind,state").eq("user_id", userId).ilike("title", `%${query.replaceAll("%", "\\%")}%`).limit(8),
      supabase.from("marketing_attribution_records").select("id,channel,utm_campaign,currency").eq("user_id", userId).or(`channel.ilike.%${query.replaceAll("%", "\\%")}%,utm_campaign.ilike.%${query.replaceAll("%", "\\%")}%`).limit(8),
    ]);
    const failed = [workspace, products, suppliers, orders, roadmap, incidents, support, githubWork, marketing].find((result) => result.error);
    if (failed?.error) throw failed.error;
    const founderRows = [
      ...(products.data ?? []).map((row) => ({ entity_type: "product", entity_id: row.id, title: row.name, snippet: row.sku ?? "Product" })),
      ...(suppliers.data ?? []).map((row) => ({ entity_type: "supplier", entity_id: row.id, title: row.name, snippet: row.contact_reference ?? "Supplier" })),
      ...(orders.data ?? []).map((row) => ({ entity_type: "supplier_order", entity_id: row.id, title: row.reference ?? "Supplier order", snippet: row.status })),
      ...(roadmap.data ?? []).map((row) => ({ entity_type: "roadmap_item", entity_id: row.id, title: row.title, snippet: row.status })),
      ...(incidents.data ?? []).map((row) => ({ entity_type: "incident", entity_id: row.id, title: row.title, snippet: row.severity })),
      ...(support.data ?? []).map((row) => ({ entity_type: "support_case", entity_id: row.id, title: row.summary, snippet: row.category })),
      ...(githubWork.data ?? []).map((row) => ({ entity_type: "github_work_item", entity_id: row.id, title: row.title, snippet: `${row.kind.replace("_", " ")} · ${row.state}` })),
      ...(marketing.data ?? []).map((row) => ({ entity_type: "campaign_performance", entity_id: row.id, title: row.utm_campaign ?? row.channel ?? "Tracked campaign", snippet: row.currency })),
    ];
    return NextResponse.json({ data: [...(workspace.data ?? []), ...founderRows].slice(0, 30) });
  } catch (error) { return NextResponse.json({ error: error instanceof Error && error.message === "AUTH_REQUIRED" ? "Authentication required." : "Search is unavailable." }, { status: error instanceof Error && error.message === "AUTH_REQUIRED" ? 401 : 500 }); }
}
