import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createRadiologyReportHandler } from "@/lib/integrations/radiology-reports";
export const runtime = "nodejs";
export const POST = createRadiologyReportHandler({
  config: () => ({ secret: process.env.RADIOLOGY_REPORTS_INTEGRATION_SECRET, userId: process.env.RADIOLOGY_REPORTS_USER_ID }),
  store: () => {
    const supabase = createAdminClient();
    return {
      async find(userId, externalId) {
        const { data, error } = await supabase.from("executive_reports").select("id").eq("user_id", userId).eq("integration_source", "radiology-growth").eq("external_id", externalId).maybeSingle();
        if (error) throw error; return data?.id ?? null;
      },
      async insert(values) {
        const { data, error } = await supabase.from("executive_reports").insert(values).select("id").single();
        if (error) throw error; return data.id;
      },
    };
  },
  log: (event, details) => {
    // Never log bearer credentials, briefing content, sources or raw DB errors.
    if (["configuration_error", "database_error"].includes(event)) console.error("[radiology-reports]", event, details ?? {});
    else if (["unauthorized", "invalid_payload"].includes(event)) console.warn("[radiology-reports]", event);
    else console.info("[radiology-reports]", event, details ?? {});
  },
});
