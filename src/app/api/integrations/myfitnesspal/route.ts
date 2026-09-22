import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const body = (await request.json()) as {
      date?: string;
      calories?: number;
      protein_g?: number;
      carbs_g?: number;
      fat_g?: number;
      water_ml?: number;
      days?: Array<{ date: string; calories: number; protein_g?: number; carbs_g?: number; fat_g?: number }>;
      csvText?: string;
    };

    const entriesToSync: Array<{ date: string; calories: number; protein_g?: number; carbs_g?: number; fat_g?: number }> = [];

    if (body.date && typeof body.calories === "number") {
      entriesToSync.push({
        date: body.date.slice(0, 10),
        calories: Math.max(0, Math.round(body.calories)),
        protein_g: body.protein_g ? Math.round(body.protein_g) : undefined,
        carbs_g: body.carbs_g ? Math.round(body.carbs_g) : undefined,
        fat_g: body.fat_g ? Math.round(body.fat_g) : undefined,
      });
    }

    if (Array.isArray(body.days)) {
      for (const d of body.days) {
        if (d.date && typeof d.calories === "number") {
          entriesToSync.push({
            date: d.date.slice(0, 10),
            calories: Math.max(0, Math.round(d.calories)),
            protein_g: d.protein_g,
            carbs_g: d.carbs_g,
            fat_g: d.fat_g,
          });
        }
      }
    }

    // Parse MyFitnessPal CSV export
    if (body.csvText && typeof body.csvText === "string") {
      const lines = body.csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      for (const line of lines.slice(1)) {
        const parts = line.split(",").map((p) => p.trim().replace(/^["']|["']$/g, ""));
        const dateMatch = parts[0]?.match(/^\d{4}-\d{2}-\d{2}/) || parts[0]?.match(/^\d{1,2}\/\d{1,2}\/\d{4}/);
        const cals = parseInt(parts[1] || parts[2] || "0", 10);
        if (dateMatch && !isNaN(cals) && cals > 0) {
          const rawDate = dateMatch[0];
          const isoDate = rawDate.includes("/")
            ? new Date(rawDate).toISOString().slice(0, 10)
            : rawDate;
          entriesToSync.push({
            date: isoDate,
            calories: cals,
            fat_g: parseFloat(parts[2] || parts[3] || "0") || undefined,
            carbs_g: parseFloat(parts[3] || parts[4] || "0") || undefined,
            protein_g: parseFloat(parts[4] || parts[5] || "0") || undefined,
          });
        }
      }
    }

    if (!entriesToSync.length) {
      return NextResponse.json({ error: "Please provide valid date and calorie details or CSV." }, { status: 400 });
    }

    let affected = 0;
    for (const item of entriesToSync) {
      const macroDesc = [
        item.protein_g != null ? `${item.protein_g}g P` : null,
        item.carbs_g != null ? `${item.carbs_g}g C` : null,
        item.fat_g != null ? `${item.fat_g}g F` : null,
      ].filter(Boolean).join(" · ");

      const { error: upsertErr } = await supabase.from("fitness_activities").upsert({
        user_id: userId,
        activity_type: "Other",
        activity_date: item.date,
        calories: item.calories,
        source: "myfitnesspal",
        external_activity_id: `mfp-${item.date}`,
        external_id: `mfp-${item.date}`,
        notes: `Nutrition: ${item.calories} kcal${macroDesc ? ` (${macroDesc})` : ""} via MyFitnessPal`,
        metadata: {
          calories_in: item.calories,
          protein: item.protein_g,
          carbs: item.carbs_g,
          fat: item.fat_g,
          source: "myfitnesspal",
        },
      }, { onConflict: "user_id,source,external_id" });

      if (!upsertErr) affected++;
    }

    const now = new Date().toISOString();
    await supabase.from("integrations").upsert({
      user_id: userId,
      provider: "myfitnesspal",
      status: "connected",
      display_name: "MyFitnessPal Nutrition",
      last_synced_at: now,
      last_successful_sync_at: now,
      sync_status: "healthy",
      last_error: null,
      provider_metadata: { recent_nutrition: entriesToSync.slice(-14) },
    }, { onConflict: "user_id,provider" });

    return NextResponse.json({
      success: true,
      affected,
      message: `Successfully synced ${affected} nutrition log(s) from MyFitnessPal.`,
    });
  } catch (error) {
    return apiError(error, "MyFitnessPal sync could not be completed.");
  }
}
