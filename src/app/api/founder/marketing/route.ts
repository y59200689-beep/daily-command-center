import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";

type Attribution = { campaign_id: string | null; channel: string | null; utm_source: string | null; utm_campaign: string | null; snapshot_date: string; currency: string; spend: number | string | null; attributed_revenue: number | string | null; orders_count: number | null; new_customers: number | null };

export async function GET() {
  try {
    const { supabase, userId } = await requireUser();
    const company = await supabase.from("companies").select("id").eq("user_id", userId).eq("active", true).maybeSingle();
    if (company.error) throw company.error;
    if (!company.data) return NextResponse.json({ campaigns: [], comparisons: {} });
    const records = await supabase.from("marketing_attribution_records").select("campaign_id,channel,utm_source,utm_campaign,snapshot_date,currency,spend,attributed_revenue,orders_count,new_customers").eq("user_id", userId).eq("company_id", company.data.id).order("snapshot_date", { ascending: false }).limit(500);
    if (records.error) throw records.error;
    const campaignIds = [...new Set((records.data ?? []).flatMap((record) => record.campaign_id ? [record.campaign_id] : []))];
    const campaigns = campaignIds.length ? await supabase.from("campaigns").select("id,name").eq("user_id", userId).in("id", campaignIds) : { data: [], error: null };
    if (campaigns.error) throw campaigns.error;
    const names = new Map((campaigns.data ?? []).map((campaign) => [campaign.id, campaign.name]));
    const grouped = new Map<string, { id: string; name: string; channel: string | null; source: string | null; periodStart: string; periodEnd: string; currency: string; spend: number | null; revenue: number | null; orders: number | null; customers: number | null; rows: number }>();
    for (const record of (records.data ?? []) as Attribution[]) {
      const campaignId = record.campaign_id ?? `unlinked:${record.utm_campaign ?? record.utm_source ?? record.channel ?? "campaign"}`;
      const key = `${campaignId}:${record.currency}`;
      const current = grouped.get(key) ?? { id: campaignId, name: record.campaign_id ? names.get(record.campaign_id) ?? "Campaign unavailable" : record.utm_campaign ?? "Unlinked tracked campaign", channel: record.channel, source: record.utm_source, periodStart: record.snapshot_date, periodEnd: record.snapshot_date, currency: record.currency, spend: null, revenue: null, orders: null, customers: null, rows: 0 };
      current.periodStart = current.periodStart < record.snapshot_date ? current.periodStart : record.snapshot_date;
      current.periodEnd = current.periodEnd > record.snapshot_date ? current.periodEnd : record.snapshot_date;
      if (record.spend != null) current.spend = (current.spend ?? 0) + Number(record.spend);
      if (record.attributed_revenue != null) current.revenue = (current.revenue ?? 0) + Number(record.attributed_revenue);
      if (record.orders_count != null) current.orders = (current.orders ?? 0) + Number(record.orders_count);
      if (record.new_customers != null) current.customers = (current.customers ?? 0) + Number(record.new_customers);
      current.rows++;
      grouped.set(key, current);
    }
    const list = [...grouped.values()].map((campaign) => ({ ...campaign, roas: campaign.spend && campaign.revenue != null ? campaign.revenue / campaign.spend : null, cac: campaign.spend != null && campaign.customers ? campaign.spend / campaign.customers : null }));
    const comparisons = Object.fromEntries(Object.entries(list.reduce<Record<string, typeof list>>((result, campaign) => { (result[campaign.currency] ??= []).push(campaign); return result; }, {})).map(([currency, rows]) => {
      const eligible = rows.filter((row) => row.rows >= 3);
      if (eligible.length < 2) return [currency, null];
      return [currency, { highestRevenue: [...eligible].filter((row) => row.revenue != null).sort((a, b) => Number(b.revenue) - Number(a.revenue))[0]?.name ?? null, highestRoas: [...eligible].filter((row) => row.roas != null).sort((a, b) => Number(b.roas) - Number(a.roas))[0]?.name ?? null, lowestCac: [...eligible].filter((row) => row.cac != null).sort((a, b) => Number(a.cac) - Number(b.cac))[0]?.name ?? null }];
    }));
    return NextResponse.json({ campaigns: list, comparisons });
  } catch (error) { return apiError(error, "Campaign performance could not be loaded."); }
}
