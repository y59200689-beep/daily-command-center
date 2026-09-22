"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Icons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { useDeferredEffect } from "@/lib/use-deferred-effect";

type Connection = {
  provider: string;
  status: string;
  display_name?: string | null;
  provider_email?: string | null;
  last_synced_at?: string | null;
  last_successful_sync_at?: string | null;
};

type Props = {
  onSyncComplete?: () => void;
};

export function FitnessSyncBar({ onSyncComplete }: Props) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<"steps" | "nutrition" | null>(null);

  // Quick steps form state
  const [stepDate, setStepDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [steps, setSteps] = useState("10000");
  const [distanceKm, setDistanceKm] = useState("7.5");
  const [stepCalories, setStepCalories] = useState("350");

  // Quick nutrition form state
  const [nutrDate, setNutrDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [caloriesIn, setCaloriesIn] = useState("2200");
  const [protein, setProtein] = useState("160");
  const [carbs, setCarbs] = useState("240");
  const [fat, setFat] = useState("65");

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/fitness/sync-all", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.connections)) {
        setConnections(data.connections);
      }
    } catch {
      // Non-blocking
    }
  }, []);

  useDeferredEffect(useCallback(() => { void loadStatus(); }, [loadStatus]));

  const handleSyncAll = async () => {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/fitness/sync-all", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to sync fitness integrations");
      setMessage(data.message || `Successfully synced ${data.synced ?? 0} activities.`);
      await loadStatus();
      if (onSyncComplete) onSyncComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync error");
    } finally {
      setBusy(false);
    }
  };

  const handleLogSteps = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/pacer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: stepDate,
          steps: parseInt(steps, 10) || 0,
          distance_km: parseFloat(distanceKm) || 0,
          calories: parseInt(stepCalories, 10) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessage(`Logged ${steps} steps for ${stepDate}!`);
      setActiveModal(null);
      await loadStatus();
      if (onSyncComplete) onSyncComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to log steps");
    } finally {
      setBusy(false);
    }
  };

  const handleLogNutrition = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/myfitnesspal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: nutrDate,
          calories_in: parseInt(caloriesIn, 10) || 0,
          protein_g: parseFloat(protein) || 0,
          carbs_g: parseFloat(carbs) || 0,
          fat_g: parseFloat(fat) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessage(`Logged ${caloriesIn} kcal for ${nutrDate}!`);
      setActiveModal(null);
      await loadStatus();
      if (onSyncComplete) onSyncComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to log nutrition");
    } finally {
      setBusy(false);
    }
  };

  const isConnected = (p: string) => connections.some((c) => c.provider === p && c.status === "connected");

  const providerList = [
    { id: "strava", label: "Strava", icon: Icons.Dumbbell, desc: "Runs & Rides" },
    { id: "hevy", label: "Hevy", icon: Icons.Activity, desc: "Gym Workouts" },
    { id: "pacer", label: "Pacer", icon: Icons.Footprints, desc: "Daily Steps" },
    { id: "myfitnesspal", label: "MyFitnessPal", icon: Icons.Apple, desc: "Nutrition & Macros" },
  ];

  return (
    <section
      className="fitness-sync-hub"
      style={{
        margin: "1rem 0 1.5rem 0",
        padding: "1rem 1.25rem",
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: "10px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ display: "flex", alignItems: "center", color: "var(--attention)" }}>
              <Icons.Zap size={16} />
            </span>
            <strong style={{ fontSize: "0.95rem", color: "var(--ink)" }}>Connected Fitness Ecosystem</strong>
          </div>
          <p style={{ margin: "0.2rem 0 0 0", fontSize: "0.8rem", color: "var(--muted)" }}>
            Unified tracking across Strava, Hevy, Pacer, and MyFitnessPal.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
          <Button
            emphasis="outline"
            onClick={() => setActiveModal(activeModal === "steps" ? null : "steps")}
            style={{ fontSize: "0.8rem", padding: "0.35rem 0.7rem" }}
          >
            <Icons.Footprints size={14} style={{ marginRight: "0.3rem" }} />
            + Steps
          </Button>

          <Button
            emphasis="outline"
            onClick={() => setActiveModal(activeModal === "nutrition" ? null : "nutrition")}
            style={{ fontSize: "0.8rem", padding: "0.35rem 0.7rem" }}
          >
            <Icons.Apple size={14} style={{ marginRight: "0.3rem" }} />
            + Nutrition
          </Button>

          <Button
            emphasis="solid"
            disabled={busy}
            onClick={() => void handleSyncAll()}
            style={{ fontSize: "0.8rem", padding: "0.35rem 0.85rem" }}
          >
            <Icons.RefreshCw
              size={13}
              style={{
                marginRight: "0.4rem",
                animation: busy ? "spin 1s linear infinite" : "none",
              }}
            />
            {busy ? "Syncing all…" : "Sync All Fitness"}
          </Button>

          <Link
            href="/settings/integrations"
            className="button button--ghost"
            style={{ fontSize: "0.8rem", padding: "0.35rem 0.6rem", color: "var(--muted)" }}
            title="Configure fitness integrations"
          >
            <Icons.Settings size={14} />
          </Link>
        </div>
      </div>

      {/* Provider Status Badges */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "0.6rem",
          marginTop: "0.9rem",
          paddingTop: "0.8rem",
          borderTop: "1px solid var(--line-subtle, rgba(255,255,255,0.05))",
        }}
      >
        {providerList.map((item) => {
          const connected = isConnected(item.id);
          const Icon = item.icon;
          return (
            <div
              key={item.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.6rem",
                padding: "0.5rem 0.75rem",
                borderRadius: "6px",
                background: connected ? "color-mix(in srgb, var(--surface) 80%, var(--success-soft, #10b98115))" : "var(--bg-subtle, rgba(255,255,255,0.02))",
                border: "1px solid var(--line)",
              }}
            >
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  background: connected ? "rgba(16, 185, 129, 0.15)" : "rgba(255, 255, 255, 0.05)",
                  color: connected ? "var(--success, #10b981)" : "var(--muted)",
                }}
              >
                <Icon size={14} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <strong style={{ fontSize: "0.82rem", color: "var(--ink)" }}>{item.label}</strong>
                  <span
                    style={{
                      fontSize: "0.65rem",
                      fontWeight: "600",
                      padding: "0.1rem 0.4rem",
                      borderRadius: "4px",
                      textTransform: "uppercase",
                      letterSpacing: "0.03em",
                      background: connected ? "rgba(16, 185, 129, 0.15)" : "rgba(255, 255, 255, 0.05)",
                      color: connected ? "var(--success, #10b981)" : "var(--muted)",
                    }}
                  >
                    {connected ? "Active" : "Not connected"}
                  </span>
                </div>
                <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>{item.desc}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Messages */}
      {message && (
        <div style={{ marginTop: "0.75rem", padding: "0.4rem 0.6rem", borderRadius: "6px", background: "rgba(16, 185, 129, 0.1)", color: "var(--success, #10b981)", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <Icons.Check size={14} />
          <span>{message}</span>
        </div>
      )}
      {error && (
        <div style={{ marginTop: "0.75rem", padding: "0.4rem 0.6rem", borderRadius: "6px", background: "rgba(239, 68, 68, 0.1)", color: "var(--error-fg, #ef4444)", fontSize: "0.8rem" }}>
          {error}
        </div>
      )}

      {/* Inline Quick Modal: Log Steps */}
      {activeModal === "steps" && (
        <form
          onSubmit={(e) => void handleLogSteps(e)}
          style={{
            marginTop: "1rem",
            padding: "1rem",
            background: "var(--bg-subtle)",
            borderRadius: "8px",
            border: "1px solid var(--line)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
            <h4 style={{ margin: 0, fontSize: "0.9rem" }}>Quick Log Daily Steps (Pacer)</h4>
            <button
              type="button"
              onClick={() => setActiveModal(null)}
              style={{ background: "transparent", border: 0, color: "var(--muted)", cursor: "pointer" }}
            >
              <Icons.X size={14} />
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "0.6rem" }}>
            <div>
              <label style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block" }}>Date</label>
              <input
                type="date"
                value={stepDate}
                onChange={(e) => setStepDate(e.target.value)}
                style={{ width: "100%", padding: "0.35rem 0.5rem", borderRadius: "4px", border: "1px solid var(--border-color)", background: "var(--bg-base)", color: "inherit", fontSize: "0.85rem" }}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block" }}>Steps</label>
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
              <label style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block" }}>Distance (km)</label>
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
              <label style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block" }}>Calories Burned</label>
              <input
                type="number"
                value={stepCalories}
                onChange={(e) => setStepCalories(e.target.value)}
                placeholder="350"
                style={{ width: "100%", padding: "0.35rem 0.5rem", borderRadius: "4px", border: "1px solid var(--border-color)", background: "var(--bg-base)", color: "inherit", fontSize: "0.85rem" }}
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
            <Button emphasis="solid" disabled={busy} type="submit">
              {busy ? "Saving…" : "Save Steps"}
            </Button>
            <Button emphasis="ghost" disabled={busy} type="button" onClick={() => setActiveModal(null)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {/* Inline Quick Modal: Log Nutrition */}
      {activeModal === "nutrition" && (
        <form
          onSubmit={(e) => void handleLogNutrition(e)}
          style={{
            marginTop: "1rem",
            padding: "1rem",
            background: "var(--bg-subtle)",
            borderRadius: "8px",
            border: "1px solid var(--line)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
            <h4 style={{ margin: 0, fontSize: "0.9rem" }}>Quick Log Nutrition & Calories (MyFitnessPal)</h4>
            <button
              type="button"
              onClick={() => setActiveModal(null)}
              style={{ background: "transparent", border: 0, color: "var(--muted)", cursor: "pointer" }}
            >
              <Icons.X size={14} />
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "0.6rem" }}>
            <div>
              <label style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block" }}>Date</label>
              <input
                type="date"
                value={nutrDate}
                onChange={(e) => setNutrDate(e.target.value)}
                style={{ width: "100%", padding: "0.35rem 0.5rem", borderRadius: "4px", border: "1px solid var(--border-color)", background: "var(--bg-base)", color: "inherit", fontSize: "0.85rem" }}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block" }}>Calories In (kcal)</label>
              <input
                type="number"
                value={caloriesIn}
                onChange={(e) => setCaloriesIn(e.target.value)}
                placeholder="2200"
                style={{ width: "100%", padding: "0.35rem 0.5rem", borderRadius: "4px", border: "1px solid var(--border-color)", background: "var(--bg-base)", color: "inherit", fontSize: "0.85rem" }}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block" }}>Protein (g)</label>
              <input
                type="number"
                step="0.1"
                value={protein}
                onChange={(e) => setProtein(e.target.value)}
                placeholder="160"
                style={{ width: "100%", padding: "0.35rem 0.5rem", borderRadius: "4px", border: "1px solid var(--border-color)", background: "var(--bg-base)", color: "inherit", fontSize: "0.85rem" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block" }}>Carbs (g)</label>
              <input
                type="number"
                step="0.1"
                value={carbs}
                onChange={(e) => setCarbs(e.target.value)}
                placeholder="240"
                style={{ width: "100%", padding: "0.35rem 0.5rem", borderRadius: "4px", border: "1px solid var(--border-color)", background: "var(--bg-base)", color: "inherit", fontSize: "0.85rem" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block" }}>Fat (g)</label>
              <input
                type="number"
                step="0.1"
                value={fat}
                onChange={(e) => setFat(e.target.value)}
                placeholder="65"
                style={{ width: "100%", padding: "0.35rem 0.5rem", borderRadius: "4px", border: "1px solid var(--border-color)", background: "var(--bg-base)", color: "inherit", fontSize: "0.85rem" }}
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
            <Button emphasis="solid" disabled={busy} type="submit">
              {busy ? "Saving…" : "Save Nutrition"}
            </Button>
            <Button emphasis="ghost" disabled={busy} type="button" onClick={() => setActiveModal(null)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
