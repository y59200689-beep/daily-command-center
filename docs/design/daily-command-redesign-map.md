# Daily Command redesign map

> Status correction (2026-09-21): this document describes intended placement and shared-shell inheritance, not completed route-by-route redesign or visual verification. See `visual-quality-audit.md` for evidence and pending routes. Mobile area navigation and several content layouts remain incomplete.

## Audit summary

Daily Command is a Next.js 16 App Router application using a shared authenticated `(workspace)` layout, a client-side `AppShell`, Supabase server/client helpers, API routes, server-side domain modules, and Tailwind/global CSS. The workspace currently contains 150 concrete workspace page files, two dynamic domain routes (`/[domain]`, `/[domain]/[id]`), authenticated login/callback routes, and a broad test suite. Auth, ownership, Supabase queries, API routes, server actions, migrations, calculations, and integrations are presentation-independent and are unchanged by this redesign.

## System-wide placement

Every workspace route renders inside the shared `AppShell`; therefore all of the following inherit the new global rail, contextual sidebar, header, tokens, keyboard search/capture overlays, responsive mobile drawer, and table/card/modal state styling.

| Area | Routes covered | Primary working structure | Existing behavior retained |
| --- | --- | --- | --- |
| Home | `/today`, `/inbox`, `/tasks`, `/calendar`, `/projects`, `/projects/[id]`, `/clients`, `/clients/[id]`, `/files` | Personal command center, triage, dense task table, calendar, record details. | Capture, triage, task/project/client data, calendar behavior, file access. |
| Plan | `/plan/**`, `/focus`, `/followups`, `/waiting`, `/goals`, `/approvals`, `/review/**` | Planning, focus, follow-through, review views. | Planning data, approvals, existing review actions. |
| Business | `/business`, `/finance/**`, `/financial-control/**`, `/growth/**`, `/pipeline`, `/leads`, `/proposals`, `/services`, `/success/**`, `/commerce/**`, `/founder/**`, `/campaigns`, `/content` | Data tables, scoped dashboards, existing content/task boards. | Financial safeguards, CRM and commerce workflows, calculations and actions. |
| Operate | `/operations/**`, `/team/**`, `/control-tower`, `/analytics`, `/communication`, `/risks`, `/automations`, `/meeting/**`, `/documents` | Operations and people hubs with dense records and contextual dashboards. | Run/SOP/process data, team permissions, meeting capture, attachments, automations. |
| Intelligence | `/chief-of-staff/**`, `/executive/**`, `/knowledge/**`, `/learning/**`, `/memory`, `/strategy/**`, `/portfolio` | Native workspace AI/intelligence screens and research/detail surfaces. | AI behavior, executive APIs, approval gates, research/learning records. |
| Personal | `/life`, `/fitness`, `/travel/**`, `/notes`, `/ideas`, `/decisions`, `/prompts`, `/settings/**` | Personal records and configuration. | Personal data, settings, integration and notification preferences. |

`/**` means every nested route in that area, including the following concrete families discovered in the source tree:

- Chief of Staff: approvals, automation opportunities, brief, escalations, executions, history, inbox, plans/detail, review, templates.
- Commerce: audits, brands, categories, inventory, movements, products, purchase review, purchasing, replenishment, review, risks, slow stock, suppliers.
- Executive: assumptions, attention, daily brief, changes, decisions/detail brief, opportunities, plan-vs-reality, reports, risks.
- Finance: clients, expenses, invoices, projects, subscriptions.
- Growth: experiments, forecast, pipeline, playbooks, reviews.
- Knowledge: briefs/detail, collections/detail, findings/detail, sources/detail, topics/detail, review, watch.
- Learning: actions, decisions, forecasts, lessons/detail, memory, patterns/detail, retrospectives/detail, reviews/monthly/quarterly, rules/detail.
- Operations: calendar, processes, quality, review, runbooks, runs/detail, SOPs/detail, systems.
- Plan and reviews: 90-days, month, quarter, week; evening, monthly, quarterly, weekly.
- Success: check-ins, client detail, journey, portfolio, renewals, review, risks.
- Team: 1:1, capacity, delegations, ownership, people/detail, responsibilities, review, risks.

## Component map

| Replaced/shared component | Applies to | Interaction states |
| --- | --- | --- |
| `AppShell` | All authenticated workspace routes | Selected rail/sidebar route, collapsible groups, mobile drawer, account menu, theme switch, keyboard shortcuts. |
| Global tokens and `product-system.css` primitives | All pages including specialized feature modules | Light/dark semantic colors, hover/focus/disabled states, density, responsive spacing. |
| Header / global search / quick capture | All authenticated workspace routes | Focused command palette, capture modal, notifications, Escape-close support. |
| Existing table/list/card/modal primitives | Domain pages and feature modules | Loading, empty, error, row hover, selected row, intentional horizontal table scrolling. |

## Explicit non-goals

- No ClickUp logo, imagery, copy, trademark, proprietary screen asset, fake comments, or fake activity data is added.
- No Kanban, dashboard editing, resizable cards, or new backend workflow is fabricated where the underlying Daily Command feature does not already exist.
- No authorization, migrations, database schema, integration credential, API behavior, or business calculation is changed for visual reasons.

The prior `docs/ROUTE-COVERAGE.md` remains the detailed behavior and test-state matrix. This document maps those routes to their destination in the new visual system.
