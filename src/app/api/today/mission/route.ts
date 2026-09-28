import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";
import { madToUsd } from "@/lib/currency/rates";
import { reconcileMissionActivity, sumMissionActivity } from "@/lib/revenue-mission-activity";

type MissionLogRow = { log_date: string; action_id: string; quantity: number; status: string };
const dayOf = (value: string | null | undefined) => value?.slice(0, 10) ?? "";

export async function GET() {
  try {
    const { supabase, userId } = await requireUser();
    const today = new Date().toISOString().slice(0, 10);
    const [settings, recordLinks, clientLinks] = await Promise.all([
      supabase.from("revenue_mission_settings").select("start_date,duration_days").eq("user_id", userId).maybeSingle(),
      supabase.from("revenue_mission_records").select("record_type,record_id").eq("user_id", userId),
      supabase.from("revenue_mission_clients").select("client_id,linked_at").eq("user_id", userId),
    ]);
    for (const result of [settings, recordLinks, clientLinks]) if (result.error) throw result.error;
    const ids = (type: string) => (recordLinks.data ?? []).filter(row => row.record_type === type).map(row => row.record_id);
    const linkedClientIds = (clientLinks.data ?? []).map(row => row.client_id);
    const clients = linkedClientIds.length
      ? await supabase.from("clients").select("id").eq("user_id", userId).is("deleted_at", null).in("id", linkedClientIds)
      : { data: [] as { id: string }[], error: null };
    if (clients.error) throw clients.error;
    const activeClientIds = new Set((clients.data ?? []).map(row => row.id));
    const missionClients = activeClientIds.size;
    const missionStart = settings.data?.start_date;
    const targetRate = await madToUsd(today).catch(() => null);
    const revenueTargetUsd = targetRate ? Math.round(10000 * targetRate.rate * 100) / 100 : null;
    const empty = {
      prospects: 0, contacted: 0, meetings: 0, clients: missionClients, revenueUsd: 0, revenueTargetUsd,
      prospectsToday: 0, outreachToday: 0, videoAuditsToday: 0, videoAudits: 0, videoAuditsWeek: 0,
      missionDay: null, replies: 0, proposals: 0, signedRevenueUsd: 0, pipelineUsd: 0, followupsDue: 0, followupsCompletedToday: 0, repliesToday: 0, meetingsToday: 0, staleOpportunities: 0,
      weekReview: { prospects: 0, outreach: 0, replies: 0, meetings: 0, proposals: 0, clients: 0 },
      opportunities: [], bestSource: null,
    };
    if (!missionStart || missionStart > today) return NextResponse.json(empty);

    const [leads, opportunities, payments, proposals, tasks, events, followups] = await Promise.all([
      ids("lead").length ? supabase.from("leads").select("id,status,created_at,last_contact_at,next_follow_up_at").eq("user_id", userId).is("archived_at", null).in("id", ids("lead")) : Promise.resolve({ data: [], error: null }),
      ids("opportunity").length ? supabase.from("opportunities").select("id,title,stage,estimated_value,currency,created_at,updated_at,next_action,next_action_date,source").eq("user_id", userId).is("archived_at", null).in("id", ids("opportunity")).order("updated_at", { ascending: false }) : Promise.resolve({ data: [], error: null }),
      ids("payment").length ? supabase.from("payments").select("id,amount,currency,payment_date").eq("user_id", userId).is("deleted_at", null).in("id", ids("payment")) : Promise.resolve({ data: [], error: null }),
      ids("proposal").length ? supabase.from("proposals").select("id,status,total,currency,created_at,accepted_at").eq("user_id", userId).is("archived_at", null).in("id", ids("proposal")) : Promise.resolve({ data: [], error: null }),
      ids("task").length ? supabase.from("tasks").select("id,status,completed_at").eq("user_id", userId).is("deleted_at", null).in("id", ids("task")) : Promise.resolve({ data: [], error: null }),
      ids("calendar_event").length ? supabase.from("calendar_events").select("id,status,starts_at").eq("user_id", userId).is("deleted_at", null).in("id", ids("calendar_event")) : Promise.resolve({ data: [], error: null }),
      supabase.from("followups").select("id,status,due_at,client_id,completed_at").eq("user_id", userId).is("deleted_at", null),
    ]);
    for (const result of [leads, opportunities, payments, proposals, tasks, events, followups]) if (result.error) throw result.error;
    const leadRows = (leads.data ?? []).filter(row => dayOf(row.created_at) >= missionStart && dayOf(row.created_at) <= today);
    const opportunityRows = opportunities.data ?? [];
    const paymentRows = (payments.data ?? []).filter(row => dayOf(row.payment_date) >= missionStart && dayOf(row.payment_date) <= today);
    const proposalRows = (proposals.data ?? []).filter(row => dayOf(row.created_at) >= missionStart && dayOf(row.created_at) <= today);
    const taskRows = (tasks.data ?? []).filter(row => row.status === "completed" && row.completed_at && dayOf(row.completed_at) >= missionStart && dayOf(row.completed_at) <= today);
    const meetingRows = (events.data ?? []).filter(row => row.status !== "cancelled" && row.starts_at && dayOf(row.starts_at) >= missionStart && row.starts_at <= new Date().toISOString());
    const linkedFollowupIds = new Set(ids("followup"));
    const followupRows = (followups.data ?? []).filter(row => linkedFollowupIds.has(row.id) || activeClientIds.has(row.client_id));

    const logs: MissionLogRow[] = [];
    for (let page = 0; ; page += 1) {
      const result = await supabase.from("revenue_mission_logs").select("log_date,action_id,quantity,status")
        .eq("user_id", userId).gte("log_date", missionStart).lte("log_date", today)
        .order("log_date").order("action_id").range(page * 1000, page * 1000 + 999);
      if (result.error) throw result.error;
      logs.push(...(result.data ?? []));
      if ((result.data ?? []).length < 1000) break;
    }
    const weekStart = new Date(`${today}T12:00:00Z`);
    weekStart.setUTCDate(weekStart.getUTCDate() - 6);
    const weekStartDay = weekStart.toISOString().slice(0, 10);
    const sumLog = (actionId: string, from = missionStart, to = today) => sumMissionActivity(logs, actionId, from, to);
    const inMission = (value: string | null | undefined) => dayOf(value) >= missionStart && dayOf(value) <= today;
    const inWeek = (value: string | null | undefined) => dayOf(value) >= weekStartDay && dayOf(value) <= today;
    const toConvert = [
      ...paymentRows.filter(row => row.currency === "MAD").map(row => row.payment_date),
      ...proposalRows.filter(row => row.status === "accepted" && row.currency === "MAD").map(row => dayOf(row.accepted_at) || dayOf(row.created_at)),
      ...opportunityRows.filter(row => row.currency === "MAD").map(row => dayOf(row.created_at)),
    ].filter(Boolean);
    const rateDates = [...new Set(toConvert)];
    const rates = new Map(await Promise.all(rateDates.map(async date => [date, (await madToUsd(date)).rate] as const)));
    const asUsd = (amount: number | null, currency: string, date: string) => Number(amount || 0) * (currency === "USD" ? 1 : currency === "MAD" ? (rates.get(date) ?? 0) : 0);
    const revenueUsd = paymentRows.reduce((sum, row) => sum + asUsd(row.amount, row.currency, row.payment_date), 0);
    const signedRevenueUsd = proposalRows.filter(row => row.status === "accepted")
      .reduce((sum, row) => sum + asUsd(row.total, row.currency, dayOf(row.accepted_at) || dayOf(row.created_at)), 0);
    const pipelineUsd = opportunityRows.filter(row => !["won", "lost"].includes(row.stage))
      .reduce((sum, row) => sum + asUsd(row.estimated_value, row.currency, dayOf(row.created_at)), 0);
    const sourceCounts = new Map<string, number>();
    for (const row of opportunityRows) if (row.source) sourceCounts.set(row.source, (sourceCounts.get(row.source) ?? 0) + 1);
    const bestSource = [...sourceCounts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const prospectsToday = Math.max(leadRows.filter(row => dayOf(row.created_at) === today).length, sumLog("prospects", today));
    const outreachToday = Math.max(leadRows.filter(row => dayOf(row.last_contact_at) === today).length, sumLog("outreach", today));
    const staleOpportunities = opportunityRows.filter(row => row.next_action_date && row.next_action_date < today && !["won", "lost"].includes(row.stage)).length;
    const followupsDue = leadRows.filter(row => row.next_follow_up_at && dayOf(row.next_follow_up_at) <= today && !["converted", "lost", "unqualified"].includes(row.status)).length
      + opportunityRows.filter(row => row.next_action_date && row.next_action_date <= today && !["won", "lost"].includes(row.stage)).length
      + followupRows.filter(row => row.status === "open" && row.due_at && dayOf(row.due_at) <= today).length;
    const videosToday = reconcileMissionActivity(sumLog("audits", today), taskRows.filter(row => dayOf(row.completed_at) === today).length);
    const videosWeek = reconcileMissionActivity(sumLog("audits", weekStartDay), taskRows.filter(row => inWeek(row.completed_at)).length);
    const videosTotal = reconcileMissionActivity(sumLog("audits"), taskRows.length);
    const meetingsToday = reconcileMissionActivity(sumLog("meetings", today), meetingRows.filter(row => dayOf(row.starts_at) === today).length);
    const meetingsWeek = reconcileMissionActivity(sumLog("meetings", weekStartDay), meetingRows.filter(row => inWeek(row.starts_at)).length);
    const meetingsTotal = reconcileMissionActivity(sumLog("meetings"), meetingRows.length);
    const missionDay = Math.min(settings.data?.duration_days ?? 30, Math.max(0, Math.floor((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${missionStart}T12:00:00Z`)) / 86400000) + 1));
    return NextResponse.json({
      prospects: reconcileMissionActivity(sumLog("prospects"), leadRows.length),
      contacted: reconcileMissionActivity(sumLog("outreach"), leadRows.filter(row => inMission(row.last_contact_at)).length),
      meetings: meetingsTotal,
      clients: missionClients,
      revenueUsd, revenueTargetUsd, prospectsToday, outreachToday,
      videoAuditsToday: videosToday, videoAudits: videosTotal, videoAuditsWeek: videosWeek,
      missionDay, replies: sumLog("inbound_replies"), repliesToday: sumLog("inbound_replies", today), meetingsToday,
      followupsCompletedToday: reconcileMissionActivity(sumLog("followups", today), followupRows.filter(row => row.status === "done" && dayOf(row.completed_at) === today).length), proposals: proposalRows.length, signedRevenueUsd, pipelineUsd,
      followupsDue, staleOpportunities, bestSource,
      weekReview: {
        prospects: reconcileMissionActivity(sumLog("prospects", weekStartDay), leadRows.filter(row => inWeek(row.created_at)).length),
        outreach: reconcileMissionActivity(sumLog("outreach", weekStartDay), leadRows.filter(row => inWeek(row.last_contact_at)).length),
        replies: sumLog("inbound_replies", weekStartDay), meetings: meetingsWeek,
        proposals: proposalRows.filter(row => inWeek(row.created_at)).length,
        clients: (clientLinks.data ?? []).filter(row => activeClientIds.has(row.client_id) && inWeek(row.linked_at)).length,
      },
      opportunities: opportunityRows.map(row => ({ ...row, estimated_value_usd: asUsd(row.estimated_value, row.currency, dayOf(row.created_at)) })),
    });
  } catch (error) { return apiError(error, "Mission progress could not be loaded."); }
}
