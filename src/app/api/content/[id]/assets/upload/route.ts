import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { ATTACHMENT_BUCKET, attachmentContentType, attachmentStoragePath, validateAttachmentContents } from "@/lib/attachment-policy";
import { hydrateAttachments, requireOwnedAttachmentEntity, type AttachmentRow } from "@/lib/attachments";
import { requireUser } from "@/lib/supabase/server";

// Compatibility endpoint for older Content clients. New UI uses /api/attachments directly.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase, userId } = await requireUser();
    if (!(await requireOwnedAttachmentEntity(supabase, userId, "content", id))) return NextResponse.json({ error: "Content item not found." }, { status: 404 });
    const file = (await request.formData()).get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });
    const validationError = await validateAttachmentContents(file);
    if (validationError) return NextResponse.json({ error: validationError }, { status: validationError.includes("6 MB") ? 413 : 400 });
    const storagePath = attachmentStoragePath(userId, "content", id, file.name);
    const mimeType = attachmentContentType(file);
    const uploaded = await supabase.storage.from(ATTACHMENT_BUCKET).upload(storagePath, await file.arrayBuffer(), { contentType: mimeType, upsert: false });
    if (uploaded.error) return NextResponse.json({ error: "The file could not be uploaded. Check your connection and try again." }, { status: 502 });
    const saved = await supabase.from("attachments").insert({ user_id: userId, entity_type: "content", entity_id: id, storage_bucket: ATTACHMENT_BUCKET, storage_path: storagePath, file_name: file.name, mime_type: mimeType, size_bytes: file.size } as never).select("*").single();
    if (saved.error) { await supabase.storage.from(ATTACHMENT_BUCKET).remove([storagePath]); throw saved.error; }
    const [asset] = await hydrateAttachments(supabase, userId, [saved.data as AttachmentRow]);
    return NextResponse.json({ asset }, { status: 201 });
  } catch (error) { return apiError(error, "File could not be uploaded."); }
}
