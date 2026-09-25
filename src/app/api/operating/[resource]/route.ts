import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";
import { isResource } from "@/lib/founder-os/resources";
import { listOperatingRecords, operatingOptions, pageSchema, saveOperatingRecord } from "@/lib/founder-os/repository";
export async function GET(request: NextRequest, context: { params: Promise<{ resource: string }> }) {
  try {
    const { resource } = await context.params;
    if (!isResource(resource)) return NextResponse.json({ error: "Unknown resource." }, { status: 404 });
    const { supabase, userId } = await requireUser();
    if (request.nextUrl.searchParams.get("options") === "true") return NextResponse.json(await operatingOptions(supabase, userId, resource, { q: (request.nextUrl.searchParams.get("q") ?? "").slice(0, 240), source: request.nextUrl.searchParams.get("source_type") ?? undefined, dependency: request.nextUrl.searchParams.get("dependency_type") ?? undefined }));
    return NextResponse.json(await listOperatingRecords(supabase, userId, resource, pageSchema.parse(request.nextUrl.searchParams.get("page") ?? 1), (request.nextUrl.searchParams.get("q") ?? "").slice(0, 240), Object.fromEntries(request.nextUrl.searchParams)));
  } catch (error) { return apiError(error, "Operating records could not be loaded. Check that the Founder OS migration is installed."); }
}
export async function POST(request: NextRequest, context: { params: Promise<{ resource: string }> }) {
  try {
    const { resource } = await context.params;
    if (!isResource(resource)) return NextResponse.json({ error: "Unknown resource." }, { status: 404 });
    const { supabase, userId } = await requireUser();
    return NextResponse.json({ record: await saveOperatingRecord(supabase, userId, resource, await request.json()) }, { status: 201 });
  } catch (error) { return apiError(error, "Record could not be saved."); }
}
