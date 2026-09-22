import type { Metadata } from "next";
import { Icons } from "@/components/icons";
import { GoogleCalendarCard } from "@/features/integrations/google-calendar-card";
import { IntegrationCard } from "@/features/integrations/integration-card";
import { HevyCard } from "@/features/integrations/hevy-card";
import { PacerCard } from "@/features/integrations/pacer-card";
import { MyFitnessPalCard } from "@/features/integrations/myfitnesspal-card";

export const metadata: Metadata = { title: "Integrations" };

export default function IntegrationsPage() {
  return (
    <div className="domain-page settings-page">
      <header className="task-context-header settings-context-header">
        <div>
          <div className="task-context-header__path">
            <Icons.Settings size={15} />
            <span>Settings</span>
            <Icons.ChevronRight size={13} />
            <strong>Integrations</strong>
          </div>
          <h1>Integrations</h1>
          <p>Bring in context without turning the command center into a copy of every service.</p>
        </div>
      </header>

      <div style={{ marginBottom: "1.5rem" }}>
        <h3 style={{ fontSize: "1.05rem", fontWeight: "600", marginBottom: "0.5rem", color: "var(--fg-base)" }}>
          Health & Fitness Integrations
        </h3>
        <p style={{ fontSize: "0.85rem", color: "var(--fg-muted)", marginBottom: "1rem" }}>
          Connect and sync Strava, Hevy, Pacer, and MyFitnessPal to unite workouts, steps, gym volume, and nutrition in your Fitness Hub.
        </p>
        <div className="project-grid integration-grid">
          <IntegrationCard provider="strava" name="Strava" detail="Import runs, bike rides, swims, and outdoor hikes with distance, pace, and calories." iconName="dumbbell" />
          <HevyCard />
          <PacerCard />
          <MyFitnessPalCard />
        </div>
      </div>

      <div style={{ marginTop: "2rem" }}>
        <h3 style={{ fontSize: "1.05rem", fontWeight: "600", marginBottom: "0.5rem", color: "var(--fg-base)" }}>
          Productivity & Workspace Integrations
        </h3>
        <div className="project-grid integration-grid">
          <GoogleCalendarCard />
          <IntegrationCard provider="gmail" name="Gmail" detail="Reference relevant threads and reply state without copying your inbox." iconName="message-square-text" />
          <IntegrationCard provider="google_drive" name="Google Drive" detail="Link provider-owned files beside private workspace attachments." iconName="paperclip" />
          <IntegrationCard provider="github" name="GitHub" detail="Use repository activity, pull requests, and issues as project context." iconName="briefcase-business" />
        </div>
      </div>
    </div>
  );
}
