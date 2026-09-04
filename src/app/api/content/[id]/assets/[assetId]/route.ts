import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";

export async function GET(_: Request, { params }: { params: Promise<{ id: string; assetId: string }> }) {
  try {
    const { id, assetId } = await params;
    const { supabase, userId } = await requireUser();
    const asset = await supabase.from("content_assets").select("storage_path").eq("id", assetId).eq("content_item_id", id).eq("user_id", userId).is("deleted_at", null).maybeSingle();
    if (asset.error) throw asset.error;
    if (!asset.data?.storage_path) return NextResponse.json({ error: "Uploaded asset not found." }, { status: 404 });
    const signed = await supabase.storage.from("attachments").createSignedUrl(asset.data.storage_path, 60);
    if (signed.error) throw signed.error;
    return NextResponse.redirect(signed.data.signedUrl);
  } catch (error) {
    return apiError(error, "Asset could not be opened.");
  }
}
