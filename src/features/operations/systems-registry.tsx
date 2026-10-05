"use client";

import { Modal } from "@/components/ui/modal";
import { StyledSelect } from "@/components/ui/styled-select";

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
  const [schemaUnavailable, setSchemaUnavailable] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
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
        setSchemaUnavailable(body.schemaStatus === "unavailable");
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
    if (saving) return;
    if (!name.trim()) { setError("Enter a system name."); return; }
    setError("");
    setSaving(true);
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
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="domain-page operations-page">
      <header className="task-context-header">
        <div>
          <nav className="task-context-header__breadcrumb" aria-label="Breadcrumb">
            <span>Operations</span>
            <span>/</span>
            <span className="current">Systems</span>
          </nav>
          <div className="task-context-header__title-row">
            <h1>Systems Registry</h1>
            <span className="task-context-header__total-badge">{systems.length} systems</span>
          </div>
          <p className="task-context-header__description">
            Internal systems &amp; third-party dependencies
          </p>
        </div>
        <div className="task-context-header__actions">
          <Link href="/operations">Overview</Link>
          <Link href="/operations/runbooks">Runbooks</Link>
          {!error && !schemaUnavailable ? <Button intent="brand" onClick={() => setShowModal(true)}>Register System</Button> : null}
        </div>
      </header>

      {schemaUnavailable ? (
        <section className="data-surface empty-state">
          <h2>Systems Registry is unavailable</h2>
          <p>This workspace is missing the optional V11 operations schema. Registration will be available after that dependency is installed.</p>
        </section>
      ) : error ? (
        <section className="data-surface empty-state" role="alert">
          <h2>Systems Registry is unavailable</h2>
          <p>{error} This workspace is missing the optional V11 operations schema; registration is disabled until that dependency is installed.</p>
        </section>
      ) : <div className="operations-systems-grid">
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
      </div>}

      <Modal open={showModal} onClose={() => { if (!saving) setShowModal(false); }} title="Register Internal System or Tool">
            <form className="operating-editor" noValidate onSubmit={handleCreateSystem}>
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
                <textarea className="resize-none"
                  rows={3}
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="What does this system power?"
                />
              </label>
              <label>
                Criticality Tier
                <StyledSelect menuMinWidth={280} label="Criticality tier" value={tier} onChange={setTier} options={[{ value: "Tier 1", label: "Tier 1 (Mission Critical - Revenue/Data)" }, { value: "Tier 2", label: "Tier 2 (Important - Day-to-day)" }, { value: "Tier 3", label: "Tier 3 (Non-critical - Back-office)" }]} />
              </label>
              <label>
                Blast Radius
                <StyledSelect menuMinWidth={280} label="Blast radius" value={blastRadius} onChange={setBlastRadius} options={[{ value: "Critical", label: "Critical (Whole company stalled)" }, { value: "High", label: "High (Major client impact)" }, { value: "Medium", label: "Medium (Internal workflow blocked)" }, { value: "Low", label: "Low (Isolated nuisance)" }]} />
              </label>
              {error && <p role="alert" className="field-error">{error}</p>}
              <div className="modal__actions">
                <Button type="button" disabled={saving} emphasis="outline" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving} intent="brand">
                  {saving ? "Saving…" : "Register System"}
                </Button>
              </div>
            </form>
      </Modal>
    </main>
  );
}
