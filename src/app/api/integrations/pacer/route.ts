import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const body = (await request.json()) as {
      date?: string;
      steps?: number;
      distance_km?: number;
      duration_minutes?: number;
      calories?: number;
      days?: Array<{ date: string; steps: number; distance_km?: number; duration_minutes?: number; calories?: number }>;
      csvText?: string;
    };

    const daysToSync: Array<{ date: string; steps: number; distance_km?: number; duration_minutes?: number; calories?: number }> = [];

    if (body.date && typeof body.steps === "number") {
      daysToSync.push({
        date: body.date.slice(0, 10),
        steps: Math.max(0, Math.round(body.steps)),
        distance_km: body.distance_km,
        duration_minutes: body.duration_minutes,
        calories: body.calories,
      });
    }

    if (Array.isArray(body.days)) {
      for (const d of body.days) {
        if (d.date && typeof d.steps === "number") {
          daysToSync.push({
            date: d.date.slice(0, 10),
            steps: Math.max(0, Math.round(d.steps)),
            distance_km: d.distance_km,
            duration_minutes: d.duration_minutes,
            calories: d.calories,
          });
        }
      }
    }

    // Parse CSV export if provided
    if (body.csvText && typeof body.csvText === "string") {
      const lines = body.csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      for (const line of lines.slice(1)) {
        const parts = line.split(",").map((p) => p.trim().replace(/^["']|["']$/g, ""));
        const dateMatch = parts[0]?.match(/^\d{4}-\d{2}-\d{2}/) || parts[0]?.match(/^\d{1,2}\/\d{1,2}\/\d{4}/);
        const stepsVal = parseInt(parts[1] || parts[2] || "0", 10);
        if (dateMatch && !isNaN(stepsVal) && stepsVal > 0) {
          const rawDate = dateMatch[0];
          const isoDate = rawDate.includes("/")
            ? new Date(rawDate).toISOString().slice(0, 10)
            : rawDate;
          daysToSync.push({
            date: isoDate,
            steps: stepsVal,
            distance_km: parseFloat(parts[2] || parts[3] || "0") || undefined,
            calories: parseInt(parts[3] || parts[4] || "0", 10) || undefined,
          });
        }
      }
    }

    if (!daysToSync.length) {
      return NextResponse.json({ error: "Please provide a valid date and step count or CSV." }, { status: 400 });
    }

    let affected = 0;
    for (const item of daysToSync) {
      const distance = item.distance_km ?? Number(((item.steps * 0.75) / 1000).toFixed(2));
      const duration = item.duration_minutes ?? Math.round(item.steps / 100);
      const calories = item.calories ?? Math.round(item.steps * 0.04);

      const { error: upsertErr } = await supabase.from("fitness_activities").upsert({
        user_id: userId,
        activity_type: "Walking",
        activity_date: item.date,
        distance_km: distance,
        distance_meters: distance * 1000,
        duration_minutes: duration,
        duration_seconds: duration * 60,
        calories,
        source: "pacer",
        external_activity_id: `pacer-${item.date}`,
        external_id: `pacer-${item.date}`,
        notes: `${item.steps.toLocaleString()} steps logged via Pacer`,
        metadata: { steps: item.steps, source: "pacer" },
      }, { onConflict: "user_id,source,external_id" });

      if (!upsertErr) affected++;
    }

    const now = new Date().toISOString();
    await supabase.from("integrations").upsert({
      user_id: userId,
      provider: "pacer",
      status: "connected",
      display_name: "Pacer Steps",
      last_synced_at: now,
      last_successful_sync_at: now,
      sync_status: "healthy",
      last_error: null,
      provider_metadata: { recent_days: daysToSync.slice(-14) },
    }, { onConflict: "user_id,provider" });

    return NextResponse.json({
      success: true,
      affected,
      message: `Successfully synced ${affected} day(s) from Pacer.`,
    });
  } catch (error) {
    return apiError(error, "Pacer sync could not be completed.");
  }
}
