import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { ATTACHMENT_BUCKET, attachmentContentType, attachmentKind, attachmentStoragePath, isAttachmentEntityType, validateAttachmentContents } from "@/lib/attachment-policy";
import { hydrateAttachments, requireOwnedAttachmentEntity, type AttachmentRow } from "@/lib/attachments";
import { requireUser } from "@/lib/supabase/server";

const idSchema = z.uuid();

export async function GET(request: NextRequest) {
  try {
    const { supabase, userId } = await requireUser();
    const entityType = request.nextUrl.searchParams.get("entityType");
    const entityId = request.nextUrl.searchParams.get("entityId");
    const attachmentId = request.nextUrl.searchParams.get("attachment");
    if ((entityType && !isAttachmentEntityType(entityType)) || (entityId && !idSchema.safeParse(entityId).success) || (attachmentId && !idSchema.safeParse(attachmentId).success)) return NextResponse.json({ error: "Invalid attachment filter." }, { status: 400 });
    if (entityType && entityId) {
      if (!isAttachmentEntityType(entityType) || !(await requireOwnedAttachmentEntity(supabase, userId, entityType, entityId))) return NextResponse.json({ error: "Related record not found." }, { status: 404 });
    }

    let query = supabase.from("attachments").select("*").eq("user_id", userId).is("deleted_at", null).order("created_at", { ascending: false }).limit(500);
    if (entityType) query = query.eq("entity_type", entityType);
    if (entityId) query = query.eq("entity_id", entityId);
    if (attachmentId) query = query.eq("id", attachmentId);
    const { data, error } = await query;
    if (error) throw error;
    let rows = await hydrateAttachments(supabase, userId, (data ?? []) as AttachmentRow[]);
    const project = request.nextUrl.searchParams.get("project");
    const client = request.nextUrl.searchParams.get("client");
    const kind = request.nextUrl.searchParams.get("type");
    const recent = Number(request.nextUrl.searchParams.get("recent") ?? 0);
    if (project) rows = rows.filter((row) => row.related.projectId === project);
    if (client) rows = rows.filter((row) => row.related.clientId === client);
    if (kind) rows = rows.filter((row) => attachmentKind(row.mime_type, row.file_name) === kind);
    if (recent > 0) { const threshold = Date.now() - Math.min(recent, 365) * 86400000; rows = rows.filter((row) => new Date(row.created_at).getTime() >= threshold); }
    const requestedPage = Number(request.nextUrl.searchParams.get("page") ?? 1);
    const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    const pageSize = 50;
    return NextResponse.json(
      { attachments: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length, page, pageSize },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) { return apiError(error, "Files could not be loaded."); }
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, userId } = await requireUser();
    const form = await request.formData();
    const entityType = String(form.get("entityType") ?? "");
    const entityId = String(form.get("entityId") ?? "");
    const file = form.get("file");
    if (!isAttachmentEntityType(entityType) || !idSchema.safeParse(entityId).success) return NextResponse.json({ error: "Choose a valid record for this file." }, { status: 400 });
    if (!(await requireOwnedAttachmentEntity(supabase, userId, entityType, entityId))) return NextResponse.json({ error: "The selected record is not available in your workspace." }, { status: 404 });
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });
    const validationError = await validateAttachmentContents(file);
    if (validationError) return NextResponse.json({ error: validationError }, { status: validationError.includes("6 MB") ? 413 : 400 });

    const storagePath = attachmentStoragePath(userId, entityType, entityId, file.name);
    const mimeType = attachmentContentType(file);
    const uploaded = await supabase.storage.from(ATTACHMENT_BUCKET).upload(storagePath, await file.arrayBuffer(), { contentType: mimeType, upsert: false });
    if (uploaded.error) return NextResponse.json({ error: "The file could not be uploaded. Check your connection and try again." }, { status: 502 });
    const saved = await supabase.from("attachments").insert({ user_id: userId, entity_type: entityType, entity_id: entityId, storage_bucket: ATTACHMENT_BUCKET, storage_path: storagePath, file_name: file.name, mime_type: mimeType, size_bytes: file.size } as never).select("*").single();
    if (saved.error) {
      const cleanup = await supabase.storage.from(ATTACHMENT_BUCKET).remove([storagePath]);
      if (cleanup.error) console.error("Attachment upload cleanup failed.", { storagePath, error: cleanup.error });
      throw saved.error;
    }
    const [attachment] = await hydrateAttachments(supabase, userId, [saved.data as AttachmentRow]);
    return NextResponse.json({ attachment }, { status: 201 });
  } catch (error) { return apiError(error, "File could not be uploaded."); }
}
