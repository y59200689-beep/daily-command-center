import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { apiError } from "@/lib/api";
import { ChiefOfStaffAutonomyLevel } from "@/lib/chief-of-staff";

export async function GET() {
  try {
    const { supabase, userId } = await requireUser();

    // Retrieve user settings or fallback to sensible defaults
    const { data: profile } = await supabase
      .from("profiles")
      .select("settings")
      .eq("id", userId)
      .maybeSingle();

    const profileSettings = profile?.settings as Record<string, unknown> | null;
    const settings = (profileSettings?.chief_of_staff_settings as Record<string, unknown> | null) || {
      autonomyLevel: "level_1_propose_and_draft" as ChiefOfStaffAutonomyLevel,
      emailApprovalRequired: true,
      calendarApprovalRequired: true,
      financialOperationsBlocked: true,
      maxRetries: 3,
      preflightTimeoutSecs: 30,
      notificationDigestHour: 8,
      escalationThresholdHours: 24,
    };

    return NextResponse.json({ settings });
  } catch (error) {
    return apiError(error, "Failed to load Chief of Staff settings.");
  }
}

export async function POST(req: NextRequest) {
  try {
    const { supabase, userId } = await requireUser();
    const body = await req.json();

    // Validate autonomy level: Level 3 is strictly forbidden / unsupported
    let autonomyLevel: ChiefOfStaffAutonomyLevel = "level_1_propose_and_draft";
    if (
      body.autonomyLevel === "level_0_read_only" ||
      body.autonomyLevel === "level_1_propose_and_draft" ||
      body.autonomyLevel === "level_2_safe_internal_autonomous" ||
      body.autonomyLevel === 0 ||
      body.autonomyLevel === 1 ||
      body.autonomyLevel === 2
    ) {
      autonomyLevel = body.autonomyLevel;
    }

    const newSettings = {
      autonomyLevel,
      emailApprovalRequired: body.emailApprovalRequired ?? true,
      calendarApprovalRequired: body.calendarApprovalRequired ?? true,
      financialOperationsBlocked: true, // always forced true for safety
      maxRetries: Math.min(Math.max(Number(body.maxRetries) || 3, 1), 5),
      preflightTimeoutSecs: Math.min(Math.max(Number(body.preflightTimeoutSecs) || 30, 10), 120),
      notificationDigestHour: Math.min(Math.max(Number(body.notificationDigestHour) || 8, 0), 23),
      escalationThresholdHours: Math.min(Math.max(Number(body.escalationThresholdHours) || 24, 1), 168),
      updatedAt: new Date().toISOString(),
    };

    // Retrieve existing profile settings to merge
    const { data: profile } = await supabase
      .from("profiles")
      .select("settings")
      .eq("id", userId)
      .maybeSingle();

    const existingSettings = (profile?.settings as Record<string, unknown> | null) || {};
    await supabase
      .from("profiles")
      .update({
        settings: {
          ...existingSettings,
          chief_of_staff_settings: newSettings,
        },
      })
      .eq("id", userId);

    return NextResponse.json({ success: true, settings: newSettings });
  } catch (error) {
    return apiError(error, "Failed to save Chief of Staff settings.");
  }
}
