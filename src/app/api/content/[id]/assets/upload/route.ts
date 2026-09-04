import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";

const MAX_FILE_BYTES = 6 * 1024 * 1024;
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf", "text/plain"]);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase, userId } = await requireUser();
    const owned = await supabase.from("content_items").select("id").eq("id", id).eq("user_id", userId).is("deleted_at", null).maybeSingle();
    if (owned.error) throw owned.error;
    if (!owned.data) return NextResponse.json({ error: "Content item not found." }, { status: 404 });
    const file = (await request.formData()).get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });
    if (!file.size || file.size > MAX_FILE_BYTES) return NextResponse.json({ error: "Files must be between 1 byte and 6 MB." }, { status: 400 });
    if (!allowedTypes.has(file.type)) return NextResponse.json({ error: "Upload an image, PDF, or plain-text file." }, { status: 400 });
    const safeName = file.name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-120) || "asset";
    const storagePath = `${userId}/content/${id}/${crypto.randomUUID()}-${safeName}`;
    const uploaded = await supabase.storage.from("attachments").upload(storagePath, await file.arrayBuffer(), { contentType: file.type, upsert: false });
    if (uploaded.error) throw uploaded.error;
    const saved = await supabase.from("content_assets").insert({ user_id: userId, content_item_id: id, asset_type: "upload", label: file.name, storage_path: storagePath, mime_type: file.type, size_bytes: file.size }).select("*").single();
    if (saved.error) {
      await supabase.storage.from("attachments").remove([storagePath]);
      throw saved.error;
    }
    return NextResponse.json({ asset: saved.data }, { status: 201 });
  } catch (error) {
    return apiError(error, "File could not be uploaded.");
  }
}
