import "server-only";
import { createRadiologyReportStore } from "@/lib/integrations/radiology-report-store";
import { createRadiologyReportHandler } from "@/lib/integrations/radiology-reports";
export const runtime = "nodejs";
export const POST = createRadiologyReportHandler({
  config: () => ({ secret: process.env.RADIOLOGY_REPORTS_INTEGRATION_SECRET, userId: process.env.RADIOLOGY_REPORTS_USER_ID }),
  store: createRadiologyReportStore,
  log: (event, details) => {
    // Never log bearer credentials, briefing content, sources or raw DB errors.
    if (["configuration_error", "database_error"].includes(event)) console.error("[radiology-reports]", event, details ?? {});
    else if (["unauthorized", "invalid_payload"].includes(event)) console.warn("[radiology-reports]", event);
    else console.info("[radiology-reports]", event, details ?? {});
  },
});
