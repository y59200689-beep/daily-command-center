"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { useDeferredEffect } from "@/lib/use-deferred-effect";

type SystemRow = Record<string, unknown> & { id: string };

function healthBadgeClass(h: string) {
  if (h === "Operational") return "badge--healthy";
  if (h === "Degraded") return "badge--warning";
  if (h === "Down") return "badge--danger";
  return "badge--muted";
}

export function SystemsRegistry() {
  const [systems, setSystems] = useState<SystemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [vendor, setVendor] = useState("");
  const [tier, setTier] = useState("Tier 1");
  const [blastRadius, setBlastRadius] = useState("High");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/operations/systems", { cache: "no-store" });
      const body = await res.json();
      if (res.ok) {
        setSystems(body.systems || []);
      } else {
        setError(body.error || "Failed to load systems");
      }
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useDeferredEffect(useCallback(() => { void load(); }, [load]));

  const handleCreateSystem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      const res = await fetch("/api/operations/systems", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          purpose: purpose.trim() || null,
          vendor: vendor.trim() || null,
          criticality_tier: tier,
          blast_radius: blastRadius,
          health_status: "Operational",
        }),
      });
      if (res.ok) {
        setShowModal(false);
        setName("");
        setPurpose("");
        setVendor("");
        void load();
      } else {
        const body = await res.json();
        setError(body.error || "Failed to create system");
      }
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

  return (
    <main className="domain-page operations-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Operations · Technical Infrastructure</p>
          <h1>Systems Registry.</h1>
          <p>
            {systems.length} documented internal system{systems.length === 1 ? "" : "s"} & third-party dependency tools
          </p>
        </div>
        <div className="operations-header-actions">
          <Link href="/operations"><Button emphasis="outline">Overview</Button></Link>
          <Link href="/operations/runbooks"><Button emphasis="outline">Runbooks</Button></Link>
          <Button intent="brand" onClick={() => setShowModal(true)}>Register System</Button>
        </div>
      </header>

      {error ? <p role="alert" className="field-error">{error}</p> : null}

      <div className="operations-systems-grid">
        {loading ? (
          <p className="faint-note">Loading systems...</p>
        ) : systems.length === 0 ? (
          <p className="faint-note">No systems registered yet.</p>
        ) : (
          systems.map((sys) => (
            <div key={sys.id} className="operations-system-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <strong>{String(sys.name)}</strong>
                  <small style={{ display: "block", color: "var(--muted)" }}>
                    {sys.vendor ? `Vendor: ${String(sys.vendor)}` : "Internal"}
                  </small>
                </div>
                <span className={`operations-badge ${healthBadgeClass(String(sys.health_status || "Operational"))}`}>
                  {String(sys.health_status || "Operational")}
                </span>
              </div>
              <p style={{ margin: "6px 0", fontSize: "12px", color: "var(--muted)", lineHeight: 1.4 }}>
                {String(sys.purpose || "No description provided.")}
              </p>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "auto", paddingTop: "8px" }}>
                <span className="operations-badge badge--muted">{String(sys.criticality_tier || "Tier 2")}</span>
                <span className="operations-badge badge--muted">Blast: {String(sys.blast_radius || "Medium")}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <h2>Register Internal System or Tool</h2>
            <form onSubmit={handleCreateSystem}>
              <label>
                System Name
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Stripe Billing Engine / Supabase DB"
                />
              </label>
              <label>
                Vendor / Host
                <input
                  type="text"
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                  placeholder="e.g. Stripe, AWS, Vercel"
                />
              </label>
              <label>
                Purpose & Scope
                <textarea
                  rows={3}
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="What does this system power?"
                />
              </label>
              <label>
                Criticality Tier
                <select value={tier} onChange={(e) => setTier(e.target.value)}>
                  <option value="Tier 1">Tier 1 (Mission Critical - Revenue/Data)</option>
                  <option value="Tier 2">Tier 2 (Important - Day-to-day)</option>
                  <option value="Tier 3">Tier 3 (Non-critical - Back-office)</option>
                </select>
              </label>
              <label>
                Blast Radius
                <select value={blastRadius} onChange={(e) => setBlastRadius(e.target.value)}>
                  <option value="Critical">Critical (Whole company stalled)</option>
                  <option value="High">High (Major client impact)</option>
                  <option value="Medium">Medium (Internal workflow blocked)</option>
                  <option value="Low">Low (Isolated nuisance)</option>
                </select>
              </label>
              <div className="modal__actions">
                <Button type="button" emphasis="outline" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" intent="brand">
                  Register System
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
