"use client";

import { useCallback, useState } from "react";
import { Icons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { useDeferredEffect } from "@/lib/use-deferred-effect";

type Connection = {
  display_name?: string | null;
  last_successful_sync_at?: string | null;
  sync_status?: string | null;
  metadata?: Record<string, unknown>;
};

type State = {
  connected: boolean;
  connection: Connection | null;
};

export function PacerCard() {
  const [state, setState] = useState<State | null>(null);
  const [activeTab, setActiveTab] = useState<"quick" | "csv" | "shortcut" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Quick form state
  const [steps, setSteps] = useState("10000");
  const [distanceKm, setDistanceKm] = useState("7.5");
  const [durationMin, setDurationMin] = useState("60");
  const [calories, setCalories] = useState("350");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  // CSV file state
  const [csvContent, setCsvContent] = useState("");
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/integrations/pacer", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setState(body);
    } catch {
      setError("Pacer status is unavailable.");
    }
  }, []);

  useDeferredEffect(useCallback(() => { void load(); }, [load]));

  const handleQuickLog = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/integrations/pacer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          steps: parseInt(steps, 10) || 0,
          distance_km: parseFloat(distanceKm) || 0,
          duration_minutes: parseInt(durationMin, 10) || 0,
          calories: parseInt(calories, 10) || 0,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setSuccess(`Logged ${steps} steps for ${date}!`);
      setActiveTab(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to log steps.");
    } finally {
      setBusy(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setCsvContent((event.target?.result as string) || "");
    };
    reader.readAsText(file);
  };

  const handleCsvSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvContent.trim()) {
      setError("Please choose a CSV file first.");
      return;
    }
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/integrations/pacer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: csvContent }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setSuccess(`Imported ${data.affected ?? 0} step records!`);
      setActiveTab(null);
      setCsvContent("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "CSV import failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Are you sure you want to disconnect Pacer?")) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/integrations/pacer", { method: "DELETE" });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error);
      }
      setSuccess("Pacer disconnected.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not disconnect.");
    } finally {
      setBusy(false);
    }
  };

  const copyEndpoint = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const endpoint = `${origin}/api/integrations/pacer`;
    void navigator.clipboard.writeText(endpoint);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const connected = state?.connected;
  const connection = state?.connection;

  return (
    <article className="project-card">
      <div className="project-card__top">
        <span className="command-result__icon">
          <Icons.Footprints size={17} />
        </span>
        <span className={connected ? "status status--blue" : "status"}>
          {connected ? "Active" : "Not configured"}
        </span>
      </div>

      <h2>Pacer & Steps</h2>
      <p>Log daily steps, walking distance, and active minutes with Apple Health, iOS Shortcuts, or CSV import.</p>

      {connected ? (
        <small style={{ color: "var(--fg-muted)" }}>
          {connection?.display_name || "Pacer Pedometer"} · Last sync:{" "}
          {connection?.last_successful_sync_at ? new Date(connection.last_successful_sync_at).toLocaleDateString() : "Active"}
        </small>
      ) : null}

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginTop: "0.6rem" }}>
        <Button
          emphasis={activeTab === "quick" ? "solid" : "outline"}
          onClick={() => setActiveTab(activeTab === "quick" ? null : "quick")}
        >
          Quick Log Steps
        </Button>
        <Button
          emphasis={activeTab === "csv" ? "solid" : "outline"}
          onClick={() => setActiveTab(activeTab === "csv" ? null : "csv")}
        >
          Import CSV
        </Button>
        <Button
          emphasis={activeTab === "shortcut" ? "solid" : "outline"}
          onClick={() => setActiveTab(activeTab === "shortcut" ? null : "shortcut")}
        >
          iOS Automation
        </Button>
        {connected ? (
          <Button emphasis="ghost" disabled={busy} onClick={() => void handleDisconnect()}>
            Disconnect
          </Button>
        ) : null}
      </div>

      {activeTab === "quick" && (
        <form onSubmit={(e) => void handleQuickLog(e)} style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.8rem", padding: "0.8rem", background: "var(--bg-subtle)", borderRadius: "8px" }}>
          <h4 style={{ margin: "0 0 0.3rem 0", fontSize: "0.9rem" }}>Log Daily Steps</h4>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
            <div>
              <label style={{ fontSize: "0.75rem", color: "var(--fg-muted)" }}>Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={{ width: "100%", padding: "0.35rem 0.5rem", borderRadius: "4px", border: "1px solid var(--border-color)", background: "var(--bg-base)", color: "inherit", fontSize: "0.85rem" }}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: "0.75rem", color: "var(--fg-muted)" }}>Steps</label>
              <input
                type="number"
                value={steps}
                onChange={(e) => setSteps(e.target.value)}
                placeholder="10000"
                style={{ width: "100%", padding: "0.35rem 0.5rem", borderRadius: "4px", border: "1px solid var(--border-color)", background: "var(--bg-base)", color: "inherit", fontSize: "0.85rem" }}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: "0.75rem", color: "var(--fg-muted)" }}>Distance (km)</label>
              <input
                type="number"
                step="0.1"
                value={distanceKm}
                onChange={(e) => setDistanceKm(e.target.value)}
                placeholder="7.5"
                style={{ width: "100%", padding: "0.35rem 0.5rem", borderRadius: "4px", border: "1px solid var(--border-color)", background: "var(--bg-base)", color: "inherit", fontSize: "0.85rem" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "0.75rem", color: "var(--fg-muted)" }}>Calories Burned</label>
              <input
                type="number"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
                placeholder="350"
                style={{ width: "100%", padding: "0.35rem 0.5rem", borderRadius: "4px", border: "1px solid var(--border-color)", background: "var(--bg-base)", color: "inherit", fontSize: "0.85rem" }}
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.4rem" }}>
            <Button emphasis="solid" disabled={busy} type="submit">
              {busy ? "Saving…" : "Save Record"}
            </Button>
            <Button emphasis="ghost" disabled={busy} type="button" onClick={() => setActiveTab(null)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {activeTab === "csv" && (
        <form onSubmit={(e) => void handleCsvSubmit(e)} style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.8rem", padding: "0.8rem", background: "var(--bg-subtle)", borderRadius: "8px" }}>
          <h4 style={{ margin: "0 0 0.3rem 0", fontSize: "0.9rem" }}>Import Pacer / Apple Health CSV</h4>
          <p style={{ fontSize: "0.75rem", color: "var(--fg-muted)", margin: "0" }}>
            Export steps from Pacer or Health app as CSV and select it here:
          </p>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileUpload}
            style={{ fontSize: "0.85rem" }}
          />
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.4rem" }}>
            <Button emphasis="solid" disabled={busy || !csvContent} type="submit">
              {busy ? "Importing…" : "Upload & Sync"}
            </Button>
            <Button emphasis="ghost" disabled={busy} type="button" onClick={() => setActiveTab(null)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {activeTab === "shortcut" && (
        <div style={{ marginTop: "0.8rem", padding: "0.8rem", background: "var(--bg-subtle)", borderRadius: "8px", fontSize: "0.8rem" }}>
          <h4 style={{ margin: "0 0 0.4rem 0", fontSize: "0.9rem" }}>iOS Shortcuts / Apple Health Webhook</h4>
          <p style={{ color: "var(--fg-muted)", margin: "0 0 0.5rem 0" }}>
            Create an iOS Shortcut that triggers at 11:59 PM to read Apple Health Steps and POST to your endpoint:
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "var(--bg-base)", padding: "0.4rem 0.6rem", borderRadius: "4px", border: "1px solid var(--border-color)", wordBreak: "break-all" }}>
            <code>/api/integrations/pacer</code>
            <Button emphasis="outline" onClick={copyEndpoint} style={{ marginLeft: "auto", fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}>
              {copied ? "Copied!" : "Copy"}
            </Button>
          </div>
          <pre style={{ margin: "0.5rem 0 0 0", padding: "0.5rem", background: "var(--bg-base)", borderRadius: "4px", fontSize: "0.75rem", overflowX: "auto" }}>
{`POST /api/integrations/pacer
{
  "date": "2026-09-22",
  "steps": 10540,
  "distance_km": 7.8,
  "calories": 420
}`}
          </pre>
        </div>
      )}

      {error ? <p className="field-error" role="alert" style={{ marginTop: "0.5rem", color: "var(--error-fg, #ef4444)" }}>{error}</p> : null}
      {success ? <p style={{ marginTop: "0.5rem", color: "var(--success-fg, #10b981)", fontSize: "0.85rem" }}>{success}</p> : null}
    </article>
  );
}
