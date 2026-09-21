import Link from "next/link";

export function TeamSchemaUnavailable({ title, description }: { title: string; description: string }) {
  return (
    <div className="domain-page team-page">
      <header className="task-context-header">
        <div>
          <nav className="task-context-header__breadcrumb" aria-label="Breadcrumb">
            <span>Operate</span>
            <span>/</span>
            <Link href="/team" style={{ color: "var(--muted)", textDecoration: "none" }}>Team</Link>
            <span>/</span>
            <span className="current">{title}</span>
          </nav>
          <div className="task-context-header__title-row">
            <h1>{title}</h1>
          </div>
          <p className="task-context-header__description">{description}</p>
        </div>
      </header>
      <section className="data-surface empty-state">
        <h2>Team coordination data is unavailable</h2>
        <p>This workspace is missing the optional V12 Team Coordination schema. This view will be available after that dependency is installed.</p>
      </section>
    </div>
  );
}
