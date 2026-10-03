import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClinahirLeadHandler } from "@/lib/integrations/clinahir";

export const runtime = "nodejs";
export const POST = createClinahirLeadHandler({
  config: () => ({ secret: process.env.CLINAHIR_INTEGRATION_SECRET, userId: process.env.CLINAHIR_LEADS_USER_ID }),
  store: () => {
    const supabase = createAdminClient();
    return {
      async find(userId, externalId) {
        const { data, error } = await supabase.from("leads").select("id").eq("user_id", userId).eq("source", "clinahir").eq("external_id", externalId).maybeSingle();
        if (error) throw error;
        return data?.id ?? null;
      },
      async insert(values) {
        const { data, error } = await supabase.from("leads").insert(values).select("id").single();
        if (error) throw error;
        return data.id;
      },
    };
  },
  log: (event, details) => {
    // Never log payloads, contact details, authorization headers, or secret values.
    if (["database_error", "configuration_error"].includes(event)) console.error("[clinahir]", event, details ?? {});
    else if (["unauthorized", "invalid_payload"].includes(event)) console.warn("[clinahir]", event);
    else console.info("[clinahir]", event, details ?? {});
  },
});
