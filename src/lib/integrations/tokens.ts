import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptToken, encryptToken } from "@/lib/integrations/crypto";
import { configFor, type Provider } from "@/lib/integrations/provider-registry";

type Connection = { id: string; user_id: string; access_token_encrypted: string | null; refresh_token_encrypted: string | null; expires_at: string | null; status: string };
const pending = new Map<string, Promise<string>>();

export async function validProviderToken(client: SupabaseClient, userId: string, provider: Provider) {
  const { data, error } = await client.from("integrations").select("*").eq("user_id", userId).eq("provider", provider).eq("status", "connected").maybeSingle();
  if (error) throw error; if (!data) throw new Error(`${configFor(provider).label} is not connected.`);
  const connection = data as Connection;
  if (connection.access_token_encrypted && (!connection.expires_at || new Date(connection.expires_at).getTime() > Date.now() + 60_000)) return decryptToken(connection.access_token_encrypted);
  if (!connection.refresh_token_encrypted) return expire(client, connection, userId, provider);
  const key = `${userId}:${provider}`; let refresh = pending.get(key);
  if (!refresh) { refresh = refreshToken(client, connection, userId, provider).finally(() => pending.delete(key)); pending.set(key, refresh); }
  return refresh;
}

async function refreshToken(client: SupabaseClient, connection: Connection, userId: string, provider: Provider) {
  const config = configFor(provider); if (!config.clientId || !config.clientSecret) return expire(client, connection, userId, provider);
  const body = provider === "strava" ? new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, grant_type: "refresh_token", refresh_token: decryptToken(connection.refresh_token_encrypted!) }) : new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, grant_type: "refresh_token", refresh_token: decryptToken(connection.refresh_token_encrypted!) });
  const response = await fetch(config.tokenUrl, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, body });
  if (!response.ok) return expire(client, connection, userId, provider);
  const token = await response.json() as { access_token?: string; refresh_token?: string; expires_in?: number; expires_at?: number };
  if (!token.access_token) return expire(client, connection, userId, provider);
  const expiresAt = token.expires_at ? new Date(token.expires_at * 1000).toISOString() : new Date(Date.now() + Number(token.expires_in ?? 3600) * 1000).toISOString();
  const { error } = await client.from("integrations").update({ access_token_encrypted: encryptToken(token.access_token), refresh_token_encrypted: token.refresh_token ? encryptToken(token.refresh_token) : connection.refresh_token_encrypted, expires_at: expiresAt, status: "connected", sync_status: "idle", last_error: null }).eq("id", connection.id).eq("user_id", userId);
  if (error) throw error; return token.access_token;
}
async function expire(client: SupabaseClient, connection: Connection, userId: string, provider: Provider): Promise<never> { await client.from("integrations").update({ status: "expired", sync_status: "attention", last_error: "Connection needs attention." }).eq("id", connection.id).eq("user_id", userId); throw new Error(`${configFor(provider).label} needs to be reconnected.`); }
