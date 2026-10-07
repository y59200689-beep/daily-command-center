import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { RadiologyReportStore } from "./radiology-reports";
export function createRadiologyReportStore(): RadiologyReportStore {
 const supabase = createAdminClient();
 return {
  async find(userId,externalId) { const {data,error}=await supabase.from("executive_reports").select("id").eq("user_id",userId).eq("integration_source","radiology-growth").eq("external_id",externalId).maybeSingle();if(error)throw error;return data?.id??null; },
  async insert(values) {const {data,error}=await supabase.from("executive_reports").insert(values).select("id").single();if(error)throw error;return data.id;},
 };
}
