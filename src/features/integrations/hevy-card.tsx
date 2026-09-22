"use client";

import { useCallback, useState } from "react";
import { Icons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { useDeferredEffect } from "@/lib/use-deferred-effect";

type Connection = {
  display_name?: string | null;
  provider_email?: string | null;
  last_successful_sync_at?: string | null;
  last_synced_at?: string | null;
  sync_status?: string | null;
};

type State = {
  connected: boolean;
  connection: Connection | null;
};

export function HevyCard() {
  const [state, setState] = useState<State | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showConnectForm, setShowConnectForm] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/integrations/hevy", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setState(body);
    } catch {
      setError("Hevy status is unavailable.");
    }
  }, []);

  useDeferredEffect(useCallback(() => { void load(); }, [load]));

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) {
      setError("Please enter your Hevy API key.");
      return;
    }
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/integrations/hevy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: apiKey.trim(),
          displayName: displayName.trim() || "Hevy Account",
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to connect Hevy.");
      setSuccess("Hevy connected successfully!");
      setShowConnectForm(false);
      setApiKey("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect Hevy.");
    } finally {
      setBusy(false);
    }
  };

  const handleSync = async () => {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/integrations/hevy", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setSuccess(data.affected ? `Synced ${data.affected} workout(s) from Hevy!` : "Hevy is up to date.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Are you sure you want to disconnect Hevy?")) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/integrations/hevy", { method: "DELETE" });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error);
      }
      setSuccess("Hevy disconnected.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not disconnect.");
    } finally {
      setBusy(false);
    }
  };

  const connected = state?.connected;
  const connection = state?.connection;

  return (
    <article className="project-card">
      <div className="project-card__top">
        <span className="command-result__icon">
          <Icons.Activity size={17} />
        </span>
        <span className={connected ? "status status--blue" : "status"}>
          {connected ? "Connected" : "Not connected"}
        </span>
      </div>

      <h2>Hevy</h2>
      <p>Sync weightlifting workouts, exercises, sets, reps, and total lifted volume (kg) via official API.</p>

      {connected ? (
        <>
          <small>{connection?.display_name || "Hevy Account"}</small>
          <div className="integration-actions" style={{ marginTop: "0.5rem", display: "flex", gap: "0.5rem" }}>
            <Button emphasis="outline" disabled={busy} onClick={() => void handleSync()}>
              {busy ? "Syncing…" : "Sync workouts"}
            </Button>
            <Button emphasis="ghost" disabled={busy} onClick={() => void handleDisconnect()}>
              Disconnect
            </Button>
          </div>
          <small style={{ display: "block", marginTop: "0.5rem", color: "var(--fg-muted)" }}>
            Last sync · {connection?.last_successful_sync_at ? new Date(connection.last_successful_sync_at).toLocaleString() : "Never"}
          </small>
        </>
      ) : showConnectForm ? (
        <form onSubmit={(e) => void handleConnect(e)} style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginTop: "0.5rem" }}>
          <div>
            <label style={{ fontSize: "0.8rem", color: "var(--fg-muted)", display: "block", marginBottom: "0.2rem" }}>
              Hevy API Key
            </label>
            <input
              type="password"
              className="text-input"
              style={{ width: "100%", padding: "0.4rem 0.6rem", borderRadius: "6px", border: "1px solid var(--border-color)", background: "var(--bg-subtle)", color: "inherit", fontSize: "0.85rem" }}
              placeholder="e.g. hev_live_..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              required
            />
          </div>
          <div>
            <label style={{ fontSize: "0.8rem", color: "var(--fg-muted)", display: "block", marginBottom: "0.2rem" }}>
              Display Name (optional)
            </label>
            <input
              type="text"
              className="text-input"
              style={{ width: "100%", padding: "0.4rem 0.6rem", borderRadius: "6px", border: "1px solid var(--border-color)", background: "var(--bg-subtle)", color: "inherit", fontSize: "0.85rem" }}
              placeholder="e.g. My Hevy Account"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
          <p style={{ fontSize: "0.75rem", color: "var(--fg-muted)", margin: "0" }}>
            Open Hevy app → <strong>Profile</strong> → <strong>Settings</strong> → <strong>Developer API</strong> → Generate Key.
          </p>
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem" }}>
            <Button emphasis="solid" disabled={busy} type="submit">
              {busy ? "Saving…" : "Save & Connect"}
            </Button>
            <Button emphasis="ghost" disabled={busy} type="button" onClick={() => setShowConnectForm(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div style={{ marginTop: "0.5rem" }}>
          <Button emphasis="outline" onClick={() => setShowConnectForm(true)}>
            Connect Hevy
          </Button>
        </div>
      )}

      {error ? <p className="field-error" role="alert" style={{ marginTop: "0.5rem", color: "var(--error-fg, #ef4444)" }}>{error}</p> : null}
      {success ? <p style={{ marginTop: "0.5rem", color: "var(--success-fg, #10b981)", fontSize: "0.85rem" }}>{success}</p> : null}
    </article>
  );
}
