import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { safeProvider } from "@/lib/integrations/provider-registry";
import { syncProvider } from "@/lib/integrations/sync";
import { requireUser } from "@/lib/supabase/server";
import { encryptToken } from "@/lib/integrations/crypto";

export async function GET(_: Request, { params }: { params: Promise<{ provider: string }> }) {
  const provider = safeProvider((await params).provider);
  if (!provider) return NextResponse.json({ error: "Unknown integration." }, { status: 404 });
  try {
    const { supabase, userId } = await requireUser();
    const { data, error } = await supabase
      .from("integrations")
      .select("provider,status,provider_email,display_name,last_synced_at,last_successful_sync_at,sync_status,last_error,provider_metadata")
      .eq("user_id", userId)
      .eq("provider", provider)
      .maybeSingle();
    if (error) throw error;
    return NextResponse.json({
      connected: data?.status === "connected",
      connection: data ?? null,
    });
  } catch (error) {
    return apiError(error, "Integration status could not be loaded.");
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const provider = safeProvider((await params).provider);
  if (!provider || provider === "google") return NextResponse.json({ error: "Unknown integration." }, { status: 404 });
  try {
    const { supabase, userId } = await requireUser();

    let body: Record<string, unknown> = {};
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      // Empty body is a standard sync trigger
    }

    // Direct API key or token submission (e.g. Hevy API key or Strava personal token)
    if (body.apiKey && typeof body.apiKey === "string" && body.apiKey.trim()) {
      const token = body.apiKey.trim();
      const displayName = typeof body.displayName === "string" && body.displayName.trim()
        ? body.displayName.trim()
        : `${provider.slice(0, 1).toUpperCase() + provider.slice(1)} Connected`;
      const metadata = body.metadata && typeof body.metadata === "object" ? body.metadata : {};

      const { error: upsertErr } = await supabase.from("integrations").upsert({
        user_id: userId,
        provider,
        status: "connected",
        display_name: displayName,
        access_token_encrypted: encryptToken(token),
        sync_status: "idle",
        provider_metadata: metadata,
        last_error: null,
      }, { onConflict: "user_id,provider" });

      if (upsertErr) throw upsertErr;

      const result = await syncProvider(supabase, userId, provider);
      return NextResponse.json({ connected: true, ...result });
    }

    // Direct data payload (e.g. Pacer steps or MyFitnessPal nutrition)
    if (body.provider_metadata && typeof body.provider_metadata === "object") {
      const displayName = typeof body.displayName === "string" && body.displayName.trim()
        ? body.displayName.trim()
        : `${provider.slice(0, 1).toUpperCase() + provider.slice(1)} Synced`;

      const { error: metaErr } = await supabase.from("integrations").upsert({
        user_id: userId,
        provider,
        status: "connected",
        display_name: displayName,
        access_token_encrypted: encryptToken("local_data_vault"),
        sync_status: "idle",
        provider_metadata: body.provider_metadata,
        last_error: null,
      }, { onConflict: "user_id,provider" });

      if (metaErr) throw metaErr;

      const result = await syncProvider(supabase, userId, provider);
      return NextResponse.json({ connected: true, ...result });
    }

    return NextResponse.json(await syncProvider(supabase, userId, provider));
  } catch (error) {
    return apiError(error, "Integration sync could not be completed.");
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ provider: string }> }) {
  const provider = safeProvider((await params).provider);
  if (!provider) return NextResponse.json({ error: "Unknown integration." }, { status: 404 });
  try {
    const { supabase, userId } = await requireUser();
    const { error } = await supabase
      .from("integrations")
      .update({
        status: "disconnected",
        access_token_encrypted: null,
        refresh_token_encrypted: null,
        expires_at: null,
        sync_status: "idle",
        last_error: null,
      })
      .eq("user_id", userId)
      .eq("provider", provider);
    if (error) throw error;
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return apiError(error, "Integration could not be disconnected.");
  }
}
