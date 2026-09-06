import type { SupabaseClient } from "@supabase/supabase-js";
import { ATTACHMENT_BUCKET, type AttachmentEntityType } from "@/lib/attachment-policy";

type Client = SupabaseClient<Record<string, unknown>>;
export type AttachmentRow = {
  id: string; entity_type: AttachmentEntityType; entity_id: string; storage_bucket: string; storage_path: string;
  file_name: string; mime_type: string | null; size_bytes: number; description: string | null; created_at: string; updated_at: string;
};

const entities: Record<AttachmentEntityType, { table: string; title: string; select: string; href: (id: string) => string; archived?: boolean }> = {
  task: { table: "tasks", title: "title", select: "id,title,project_id,client_id", href: (id) => `/tasks/${id}` },
  project: { table: "projects", title: "name", select: "id,name,client_id", href: (id) => `/projects/${id}` },
  client: { table: "clients", title: "name", select: "id,name", href: (id) => `/clients/${id}` },
  note: { table: "notes", title: "title", select: "id,title,project_id,client_id", href: (id) => `/notes/${id}` },
  content: { table: "content_items", title: "title", select: "id,title,project_id,client_id", href: (id) => `/content/${id}` },
  decision: { table: "decisions", title: "title", select: "id,title,project_id,client_id", href: (id) => `/decisions/${id}` },
  invoice: { table: "invoices", title: "title", select: "id,title,invoice_number,project_id,client_id", href: (id) => `/invoices/${id}` },
  lead: { table: "leads", title: "name", select: "id,name", href: (id) => `/leads/${id}`, archived: true },
  opportunity: { table: "opportunities", title: "title", select: "id,title,client_id", href: (id) => `/pipeline?opportunity=${id}`, archived: true },
  proposal: { table: "proposals", title: "title", select: "id,title,client_id", href: (id) => `/proposals?proposal=${id}`, archived: true },
};

export async function requireOwnedAttachmentEntity(client: Client, userId: string, entityType: AttachmentEntityType, entityId: string) {
  const entity = entities[entityType];
  let query = client.from(entity.table).select("id").eq("id", entityId).eq("user_id", userId);
  query = query.is(entity.archived ? "archived_at" : "deleted_at", null);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function getOwnedAttachment(client: Client, userId: string, attachmentId: string) {
  const { data, error } = await client.from("attachments").select("*").eq("id", attachmentId).eq("user_id", userId).is("deleted_at", null).maybeSingle();
  if (error) throw error;
  return data as AttachmentRow | null;
}

export async function hydrateAttachments(client: Client, userId: string, rows: AttachmentRow[]) {
  const related = new Map<string, Record<string, unknown>>();
  await Promise.all(Object.entries(entities).map(async ([type, config]) => {
    const ids = rows.filter((row) => row.entity_type === type).map((row) => row.entity_id);
    if (!ids.length) return;
    let query = client.from(config.table).select(config.select).eq("user_id", userId).in("id", ids);
    query = query.is(config.archived ? "archived_at" : "deleted_at", null);
    const { data, error } = await query;
    if (error) throw error;
    for (const item of (data ?? []) as Array<Record<string, unknown> & { id: string }>) related.set(`${type}:${String(item.id)}`, item);
  }));
  return rows.flatMap((row) => {
    const item = related.get(`${row.entity_type}:${row.entity_id}`);
    if (!item) return [];
    const config = entities[row.entity_type];
    const title = String(item[config.title] ?? item.invoice_number ?? "Untitled");
    return [{ ...row, related: { title, href: config.href(row.entity_id), projectId: row.entity_type === "project" ? row.entity_id : item.project_id ? String(item.project_id) : null, clientId: row.entity_type === "client" ? row.entity_id : item.client_id ? String(item.client_id) : null } }];
  });
}

export async function removeOwnedAttachment(client: Client, userId: string, attachment: AttachmentRow) {
  const removed = await client.storage.from(attachment.storage_bucket || ATTACHMENT_BUCKET).remove([attachment.storage_path]);
  if (removed.error) throw new Error("STORAGE_DELETE_FAILED", { cause: removed.error });
  const deleted = await client.from("attachments").update({ deleted_at: new Date().toISOString() } as never).eq("id", attachment.id).eq("user_id", userId).is("deleted_at", null).select("id").maybeSingle();
  if (deleted.error || !deleted.data) {
    console.error("Attachment object was deleted but its database row could not be archived.", { attachmentId: attachment.id, error: deleted.error });
    throw new Error("DATABASE_DELETE_FAILED", { cause: deleted.error });
  }
}
