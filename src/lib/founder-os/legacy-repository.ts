import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
export async function validateLegacyReferences(client: SupabaseClient, userId: string, input: Record<string, unknown>) {
  const refs = { company_id: "companies", supplier_id: "supplier_records", project_id: "projects", deployment_id: "deployment_records", order_id: "commerce_orders", product_id: "product_catalog_refs" };
  await Promise.all(Object.entries(refs).map(async ([field, table]) => {
    if (!input[field]) return;
    const { data, error } = await client.from(table).select("id").eq("user_id", userId).eq("id", input[field]).maybeSingle();
    if (error) throw error;
    if (!data) throw new z.ZodError([{ code: "custom", path: [field], message: "Related record is unavailable in your workspace." }]);
  }));
}
