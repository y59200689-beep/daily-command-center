"use client";
import Link from "next/link";
import { useCallback, useState } from "react";
import { Icons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { useDeferredEffect } from "@/lib/use-deferred-effect";
type Provider = "gmail" | "google_drive" | "github" | "strava";
type State = { connected: boolean; connection: null | { provider_email?: string | null; display_name?: string | null; last_synced_at?: string | null; last_successful_sync_at?: string | null; sync_status?: string | null } };

const PROVIDER_ICONS: Record<Provider, typeof Icons.Zap> = {
  gmail: Icons.MessageSquareText,
  google_drive: Icons.Paperclip,
  github: Icons.BriefcaseBusiness,
  strava: Icons.Dumbbell,
};

const ICON_MAP: Record<string, typeof Icons.Zap> = {
  "message-square-text": Icons.MessageSquareText,
  "paperclip": Icons.Paperclip,
  "briefcase-business": Icons.BriefcaseBusiness,
  "dumbbell": Icons.Dumbbell,
  "calendar": Icons.CalendarDays,
  "zap": Icons.Zap,
};

export function IntegrationCard({ provider, name, detail, iconName }: { provider: Provider; name: string; detail: string; iconName?: string }) {
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const Icon = (iconName && ICON_MAP[iconName]) || PROVIDER_ICONS[provider] || Icons.Zap;
  const load = useCallback(async () => { try { const response = await fetch(`/api/integrations/${provider}`, { cache: "no-store" }); const body = await response.json(); if (!response.ok) throw new Error(body.error); setState(body); } catch { setError("Connection status is unavailable."); } }, [provider]); useDeferredEffect(useCallback(() => { void load(); }, [load]));
  const action = async (method: "POST" | "DELETE") => { setBusy(true); setError(""); try { const response = await fetch(`/api/integrations/${provider}`, { method }); if (!response.ok) { const body = await response.json(); throw new Error(body.error); } await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Connection could not be updated."); } finally { setBusy(false); } };
  const connected = state?.connected; const connection = state?.connection; return <article className="project-card"><div className="project-card__top"><span className="command-result__icon"><Icon size={17}/></span><span className={connected ? "status status--blue" : "status"}>{connected ? "Connected" : "Not connected"}</span></div><h2>{name}</h2><p>{detail}</p>{connected ? <><small>{connection?.display_name ?? connection?.provider_email ?? "Connected account"}</small><div className="integration-actions"><Button emphasis="outline" disabled={busy} onClick={() => void action("POST")}>{busy ? "Syncing…" : "Sync now"}</Button><Button emphasis="ghost" disabled={busy} onClick={() => void action("DELETE")}>Disconnect</Button></div><small>Last sync · {connection?.last_successful_sync_at ? new Date(connection.last_successful_sync_at).toLocaleString() : "Never"}</small></> : <Link className="button button--outline button--neutral" href={`/api/integrations/${provider}/connect`}>Connect {name}</Link>}{error ? <p className="field-error" role="alert">{error}</p> : null}</article>; }
