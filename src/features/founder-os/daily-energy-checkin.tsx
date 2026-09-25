"use client";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { useDeferredEffect } from "@/lib/use-deferred-effect";

type EnergyLevel = "low" | "normal" | "high";
type FocusLevel = "poor" | "normal" | "strong";
type StressLevel = "low" | "normal" | "high";

type DailyStateEntry = {
  id: string;
  date: string;
  energy: EnergyLevel;
  focus: FocusLevel;
  stress_load: StressLevel;
  cognitive_notes: string | null;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function DailyEnergyCheckin() {
  const [entry, setEntry] = useState<DailyStateEntry | null>(null);
  const [energy, setEnergy] = useState<EnergyLevel>("normal");
  const [focus, setFocus] = useState<FocusLevel>("normal");
  const [stress, setStress] = useState<StressLevel>("normal");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/daily-state?limit=1", { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) return;
      const latest: DailyStateEntry | undefined = body.entries?.[0];
      if (latest?.date === today()) {
        setEntry(latest);
        setEnergy(latest.energy);
        setFocus(latest.focus);
        setStress(latest.stress_load);
        setNotes(latest.cognitive_notes ?? "");
      }
    } catch {
      // non-critical — check-in can be entered without pre-population
    }
  }, []);

  useDeferredEffect(useCallback(() => { void load(); }, [load]));

  async function save() {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/daily-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: today(),
          energy,
          focus,
          stress_load: stress,
          cognitive_notes: notes.trim() || null,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      setEntry(body.entry);
      setMessage("Check-in saved for today.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save check-in.");
    } finally {
      setSaving(false);
    }
  }

  const isToday = entry?.date === today();

  return (
    <section className="founder-record" aria-label="Daily energy check-in">
      <header className="founder-section-header">
        <div>
          <p className="eyebrow">Self-awareness layer</p>
          <h2>Daily Energy Check-in</h2>
          <p className="founder-muted">
            {isToday
              ? `Checked in today · ${entry?.energy} energy · ${entry?.focus} focus · ${entry?.stress_load} load`
              : "Record your energy, focus, and load before diving into today's work."}
          </p>
        </div>
      </header>

      {error && <p role="alert" className="founder-error">{error}</p>}
      {message && <p role="status">{message}</p>}

      <form
        className="founder-form"
        onSubmit={(e) => { e.preventDefault(); void save(); }}
      >
        <label>
          Energy level
          <select
            id="daily-energy-level"
            value={energy}
            onChange={(e) => setEnergy(e.target.value as EnergyLevel)}
          >
            <option value="high">High — sharp and motivated</option>
            <option value="normal">Normal — steady and functional</option>
            <option value="low">Low — depleted or fatigued</option>
          </select>
        </label>

        <label>
          Focus quality
          <select
            id="daily-focus-level"
            value={focus}
            onChange={(e) => setFocus(e.target.value as FocusLevel)}
          >
            <option value="strong">Strong — deep work ready</option>
            <option value="normal">Normal — manageable</option>
            <option value="poor">Poor — scattered or distracted</option>
          </select>
        </label>

        <label>
          Cognitive load / stress
          <select
            id="daily-stress-level"
            value={stress}
            onChange={(e) => setStress(e.target.value as StressLevel)}
          >
            <option value="low">Low — capacity available</option>
            <option value="normal">Normal — balanced</option>
            <option value="high">High — overwhelmed or pressured</option>
          </select>
        </label>

        <label>
          Context notes (optional)
          <textarea
            id="daily-cognitive-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            maxLength={2000}
            placeholder="What's on your mind? Any blockers, distractions, or important context for today?"
          />
        </label>

        <Button type="submit" disabled={saving}>
          {isToday ? "Update today's check-in" : "Save check-in"}
        </Button>
      </form>
    </section>
  );
}
