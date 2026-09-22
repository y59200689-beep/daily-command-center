import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";
import { syncProvider } from "@/lib/integrations/sync";
import type { Provider } from "@/lib/integrations/provider-registry";

export async function GET() {
  try {
    const { supabase, userId } = await requireUser();
    const { data: connections, error } = await supabase
      .from("integrations")
      .select("provider,status,display_name,provider_email,last_synced_at,last_successful_sync_at,sync_status,metadata")
      .eq("user_id", userId)
      .in("provider", ["strava", "hevy", "pacer", "myfitnesspal"]);

    if (error) throw error;
    return NextResponse.json({
      connections: connections || [],
    });
  } catch (error) {
    return apiError(error, "Fitness integration status could not be loaded.");
  }
}

export async function POST() {
  try {
    const { supabase, userId } = await requireUser();

    // Query connected fitness providers
    const { data: connections, error } = await supabase
      .from("integrations")
      .select("provider,status,last_synced_at")
      .eq("user_id", userId)
      .in("provider", ["strava", "hevy", "pacer", "myfitnesspal"])
      .eq("status", "connected");

    if (error) throw error;

    if (!connections || connections.length === 0) {
      return NextResponse.json({
        synced: 0,
        results: [],
        message: "No fitness integrations are currently connected. Connect Strava, Hevy, Pacer, or MyFitnessPal in Settings > Integrations.",
      });
    }

    const tasks = connections.map(async (conn) => {
      try {
        const res = await syncProvider(supabase, userId, conn.provider as Exclude<Provider, "google">);
        return {
          provider: conn.provider,
          success: true,
          affected: res.affected,
          lastSyncedAt: res.lastSyncedAt,
        };
      } catch (err) {
        return {
          provider: conn.provider,
          success: false,
          error: err instanceof Error ? err.message : "Sync failed",
        };
      }
    });

    const settled = await Promise.all(tasks);
    const totalAffected = settled.reduce((acc, curr) => acc + (curr.affected ?? 0), 0);

    return NextResponse.json({
      synced: totalAffected,
      results: settled,
      message: `Sync complete: ${totalAffected} records updated across ${settled.length} service(s).`,
    });
  } catch (error) {
    return apiError(error, "Fitness sync could not be completed.");
  }
}
