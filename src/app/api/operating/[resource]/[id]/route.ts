import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";
import { z } from "zod";
import { resources, isResource } from "@/lib/founder-os/resources";
import { saveOperatingRecord, removeOperatingRecord } from "@/lib/founder-os/repository";
export async function PATCH(request: Request, context: { params: Promise<{ resource: string; id: string }> }) {
  try {
    const { resource, id } = await context.params;
    if (!isResource(resource)) return NextResponse.json({ error: "Unknown resource." }, { status: 404 });
    const { supabase, userId } = await requireUser();
    const record = await saveOperatingRecord(supabase, userId, resource, await request.json(), id);
    return record ? NextResponse.json({ record }) : NextResponse.json({ error: "Record not found." }, { status: 404 });
  } catch (error) { return apiError(error, "Record could not be updated."); }
}

export async function GET(_request: Request, context: { params: Promise<{ resource: string; id: string }> }) {
  try {
    const { resource, id } = await context.params;
    if (!isResource(resource)) return NextResponse.json({ error: "Unknown resource." }, { status: 404 });
    z.uuid().parse(id);
    const { supabase, userId } = await requireUser();
    const { data, error } = await supabase.from(resources[resource].table).select("*").eq("user_id", userId).eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? NextResponse.json({ record: data }) : NextResponse.json({ error: "Record not found." }, { status: 404 });
  } catch (error) { return apiError(error, "Record could not be loaded."); }
}

export async function DELETE(_request: Request, context: { params: Promise<{ resource: string; id: string }> }) {
  try {
    const { resource, id } = await context.params;
    if (!isResource(resource)) return NextResponse.json({ error: "Unknown resource." }, { status: 404 });
    const { supabase, userId } = await requireUser();
    const record = await removeOperatingRecord(supabase, userId, resource, id);
    return record ? NextResponse.json({ record }) : NextResponse.json({ error: "Record not found." }, { status: 404 });
  } catch (error) { return apiError(error, "Record could not be removed."); }
}
