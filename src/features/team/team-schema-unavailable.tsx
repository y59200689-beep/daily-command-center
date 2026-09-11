import Link from "next/link";

export function TeamSchemaUnavailable({ title, description }: { title: string; description: string }) {
  return <div className="page-shell team-page"><header className="page-header"><div><p className="eyebrow"><Link href="/team">← Team Command Center</Link></p><h1>{title}</h1><p className="page-description">{description}</p></div></header><section className="data-surface empty-state"><h2>Team coordination data is unavailable</h2><p>This workspace is missing the optional V12 Team Coordination schema. This view will be available after that dependency is installed.</p></section></div>;
}
