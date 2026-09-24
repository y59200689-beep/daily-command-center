# Founder OS implementation map

## Audit (22 September 2026)

The repository is a Next 16.3.4 App Router application with Supabase, Zod, shared repository helpers, an in-process mutation bus, reusable modal/buttons, and CSS theme tokens. Tests use Node test through tsx; `verify` runs lint, typecheck, all tests, and production build. Next's installed page and route guides were read before implementation.

| Requirement | Canonical source / integration |
|---|---|
| Today / attention | `api/today`, `intelligence/server`, `today-dashboard` |
| Executive / changes | `executive-server`, `executive_snapshots`, signal dismissals |
| Decisions / waiting | `decisions`, `waiting_items`; extend existing schemas and forms |
| Critical issues | Extend `quality_incidents`; preserve Operations quality UI and corrective tasks |
| Dependencies | Extend `operational_dependencies`; retain strategic dependencies for planning |
| Business | `companies`, `projects.company_id`, commerce orders and company metrics |
| Risks | Existing risk_snapshots are generated observations; new register is human-managed mitigation lifecycle, not a replacement for detected risks |
| Infrastructure | Extend `operational_systems`; reference `subscriptions` for billing; access metadata has no credential fields |
| Technical | Existing `incidents`, `deployment_records`, integrations and Founder development |
| Finance | Existing invoices/payments, financial-control liquidity, forecast, budgets, collections; currencies remain separate |
| Wealth | New explicitly personal balance-sheet entries; not transactions or business cash |
| Travel / documents | Extend `trips`; reuse `personal_documents` and existing `/documents` workflow |
| Relationships | New contextual link to clients/suppliers/team; does not duplicate these identities |
| Commitments | Personal/cross-domain promises; client and strategic commitments retain existing ownership/lifecycle |
| Experiments | Extend `growth_experiments`, retain growth UI |
| Content / files | Existing content_items, content_assets, attachments; no new file store |
| Learning | operating_lessons + lesson_evidence_links, existing forecast_evaluations and retrospective review APIs |
| Chief of Staff | Existing candidate action / approval architecture; new signals remain recommendations |
| Design | Existing domain page, modal, buttons, data surfaces, responsive shell and theme tokens |

## Delivery approach

Ship additive schema changes and shared deterministic domain logic, then one bounded server aggregation and reusable UI. Preserve existing routes, and expose new work through Founder State and command search. Missing source schemas must be reported as unavailable, never as healthy. Date interpretation is explicit; missing numbers are unknown, never zero. No production demo records.

The pre-existing uncommitted files in integrations/provider-registry.ts, integrations/sync.ts, and v4.ts are user work and must be preserved.

## Validation / deployment

Migration must be applied before the new records can be saved. RLS, ownership guards and audit triggers are part of the migration. Static security tests are not a substitute for live two-user PostgreSQL tests. Record exactly which checks were actually run in the delivery report.
