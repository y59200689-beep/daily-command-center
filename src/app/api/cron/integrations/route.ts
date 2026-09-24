import { emitFounderNotifications } from "@/lib/founder-os/notifications";
import { NextResponse } from "next/server";
import { syncGoogleCalendar } from "@/lib/integrations/google-calendar";
import { syncProvider } from "@/lib/integrations/sync";
import { emitWorkspaceNotifications } from "@/lib/notification-producers";
import { emitStrategyNotifications } from "@/lib/strategy-notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import {financialAutomationTypes,financialAutomationDue,runFinancialAutomation} from '@/lib/financial-notifications';

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const client = createAdminClient();
  const [connections, strategyUsers] = await Promise.all([
    client.from("integrations").select("user_id,provider").eq("status", "connected").in("provider", ["google", "gmail", "google_drive", "github", "strava"]),
    client.from("automations").select("user_id").eq("enabled", true).in("type", ["weekly_planning_reminder", "monthly_planning_reminder", "quarterly_planning_reminder", "milestone_risk_check", "blocked_commitment_check"]),
  ]);
  if (connections.error || strategyUsers.error) return NextResponse.json({ error: "Sync inventory unavailable." }, { status: 500 });
  let attempted = 0; let failed = 0; const users = new Set<string>((strategyUsers.data ?? []).map((item) => item.user_id));
  for (const item of connections.data ?? []) { try { attempted += 1; users.add(item.user_id); if (item.provider === "google") await syncGoogleCalendar(client, item.user_id); else await syncProvider(client, item.user_id, item.provider as "gmail" | "google_drive" | "github" | "strava"); } catch { failed += 1; } }
  for (const userId of users) { await emitWorkspaceNotifications(client, userId); await emitStrategyNotifications(client, userId); }
  const financial=await client.from('automations').select('*').eq('enabled',true).in('type',[...financialAutomationTypes]);
  if(financial.error)return NextResponse.json({error:'Financial automation inventory unavailable.'},{status:500});
  for(const automation of financial.data??[]){try{
    const profile=await client.from('profiles').select('timezone').eq('id',automation.user_id).maybeSingle();if(profile.error)throw profile.error;
    const slot=financialAutomationDue(automation.type,automation.schedule_or_condition??{},profile.data?.timezone??'UTC',automation.last_run_at);
    if(slot){attempted++;await runFinancialAutomation(client,automation.user_id,automation.id,slot);}
  }catch{failed++;}}
  // Include owners without an external connection; their internal deadlines still matter.
  for (let offset = 0; ; offset += 100) {
    const profiles = await client.from("profiles").select("id,timezone").order("id").range(offset, offset + 99);
    if (profiles.error) { failed++; break; }
    for (const profile of profiles.data ?? []) {
      try {
        const today = new Intl.DateTimeFormat("en-CA", { timeZone: profile.timezone || "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
        const result = await emitFounderNotifications(client, profile.id, today);
        if (result.unavailable) failed++;
      } catch { failed++; }
    }
    if ((profiles.data?.length ?? 0) < 100) break;
  }
  return NextResponse.json({ attempted, failed });
}
