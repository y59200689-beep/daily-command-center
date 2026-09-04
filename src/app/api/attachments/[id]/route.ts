import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { getOwnedAttachment, hydrateAttachments, removeOwnedAttachment } from "@/lib/attachments";
import { requireUser } from "@/lib/supabase/server";

type Context = { params: Promise<{ id: string }> };
const updateSchema = z.object({ file_name: z.string().trim().min(1).max(240).optional(), description: z.string().trim().max(1000).nullable().optional() }).refine((value) => Object.keys(value).length > 0);

export async function GET(_: NextRequest, { params }: Context) {
  try {
    const { id } = await params;
    const { supabase, userId } = await requireUser();
    const attachment = await getOwnedAttachment(supabase, userId, id);
    if (!attachment) return NextResponse.json({ error: "File not found." }, { status: 404 });
    const signed = await supabase.storage.from(attachment.storage_bucket).createSignedUrl(attachment.storage_path, 60);
    if (signed.error) return NextResponse.json({ error: "This file is unavailable. It may have been removed." }, { status: 404 });
    return NextResponse.json({ url: signed.data.signedUrl, expiresIn: 60 }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error, "File could not be opened."); }
}

export async function PATCH(request: NextRequest, { params }: Context) {
  try {
    const { id } = await params;
    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) throw parsed.error;
    const { supabase, userId } = await requireUser();
    const current = await getOwnedAttachment(supabase, userId, id);
    if (!current) return NextResponse.json({ error: "File not found." }, { status: 404 });
    const { data, error } = await supabase.from("attachments").update({ ...parsed.data, description: parsed.data.description || null } as never).eq("id", id).eq("user_id", userId).is("deleted_at", null).select("*").maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "This file is no longer available." }, { status: 404 });
    const [attachment] = await hydrateAttachments(supabase, userId, [data as typeof current]);
    return NextResponse.json({ attachment });
  } catch (error) { return apiError(error, "File details could not be updated."); }
}

export async function DELETE(_: NextRequest, { params }: Context) {
  try {
    const { id } = await params;
    const { supabase, userId } = await requireUser();
    const attachment = await getOwnedAttachment(supabase, userId, id);
    if (!attachment) return NextResponse.json({ error: "File not found." }, { status: 404 });
    try { await removeOwnedAttachment(supabase, userId, attachment); }
    catch (error) {
      if (error instanceof Error && error.message === "STORAGE_DELETE_FAILED") return NextResponse.json({ error: "The stored file could not be deleted. Try again." }, { status: 502 });
      return NextResponse.json({ error: "The file was removed, but its record could not be updated. Try again." }, { status: 500 });
    }
    return new NextResponse(null, { status: 204 });
  } catch (error) { return apiError(error, "File could not be deleted."); }
}
