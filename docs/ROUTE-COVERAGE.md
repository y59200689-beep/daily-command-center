# Route and workflow coverage

Legend: **system** uses the replacement shell/tokens/shared states; **specialized** also has a purpose-built workflow in this redesign; **existing flow** preserves its current domain behavior under the new system.

## Everyday work

- [x] `/today` — specialized compact brief, priorities, agenda, waiting, recommendations, empty/loading/error.
- [x] `/inbox` — specialized capture triage, organize, clear, empty/loading/error.
- [x] `/tasks` — specialized working table, complete/reopen, status and priority filters, edit/create, empty/loading/error.
- [x] `/calendar` — specialized month/agenda, create/edit, mobile agenda, timezone and sync-conflict preservation.
- [x] `/projects`, `/projects/[id]` — specialized compact portfolio cards; existing project workspace details.
- [x] `/clients`, `/clients/[id]` — system collection and existing relationship detail.
- [x] `/focus`, `/followups`, `/waiting`, `/goals`, `/notes`, `/ideas`, `/decisions`, `/prompts` — system; existing flows.

## Planning and reviews

- [x] `/plan`, `/plan/week`, `/plan/month`, `/plan/quarter`, `/plan/90-days` — system; existing planning flows.
- [x] `/review/evening`, `/review/weekly`, `/review/monthly`, `/review/quarterly` — system; existing review flows.
- [x] `/control-tower`, `/portfolio`, `/risks`, `/approvals`, `/automations`, `/analytics` — system; existing operational flows.

## Business and revenue

- [x] `/business` — system; existing overview and scoped resources.
- [x] `/finance`, `/finance/clients`, `/finance/projects`, `/finance/invoices`, `/finance/expenses`, `/finance/subscriptions` — system; existing finance rules preserved.
- [x] `/financial-control/[[...view]]` — system; existing ledger, planning, and approval behavior preserved.
- [x] `/growth`, `/growth/pipeline`, `/growth/forecast`, `/growth/experiments`, `/growth/playbooks`, `/growth/reviews` — system; existing purpose-specific views.
- [x] `/pipeline`, `/leads`, `/proposals`, `/services`, `/campaigns`, `/content` — system; Content retains kanban/list/calendar views.
- [x] `/success` and portfolio, client detail, check-ins, journey, risks, renewals, review — system; existing client-success workflows.
- [x] `/commerce` and products, inventory, movements, purchasing, suppliers, brands, categories, replenishment, slow-stock, risks, audits, purchase-review, review — system; existing commerce behavior.
- [x] `/founder` and products, supplier-orders, development, marketing — system; existing founder workflows.

## Operations and team

- [x] `/operations` and calendar, quality, processes, runbooks, review, SOP list/detail, systems, run list/detail — system; existing workflows.
- [x] `/team` and people list/detail, responsibilities, delegations, capacity, ownership, 1:1, review, risks — system; existing permission/data behavior.
- [x] `/communication`, `/documents`, `/files`, meeting detail/capture — system; existing actions and attachments.

## Intelligence and knowledge

- [x] `/executive` and attention, opportunities, changes, decisions, assumptions, plan-vs-reality, risks, daily brief, reports — system; existing decision behavior.
- [x] `/chief-of-staff` and inbox, escalations, plans, automation opportunities, review, executions, history, brief, templates, approvals — system; existing safety gates.
- [x] `/knowledge` and topics, findings, sources, collections, briefs, watch, review and their detail routes — system; existing research flows.
- [x] `/learning` and memory, patterns, decisions, retrospectives, actions, rules, lessons, forecasts, monthly/quarterly review and detail routes — system; existing learning flows.
- [x] `/memory` — system; existing intelligence memory.

## Personal and system

- [x] `/life`, `/fitness`, `/travel` and travel detail — system; existing personal data behavior.
- [x] `/settings`, business, integrations, notifications, chief-of-staff settings — system; existing settings/integration behavior.
- [x] `/login`, `/auth/callback` — authentication behavior preserved; styling inherits canonical tokens where applicable.
- [x] Responsive shell — desktop rail, compact laptop layout, mobile drawer and bottom actions.
- [x] Shared overlays — command search, quick capture, CRUD modal/sheet, toasts, account menu, notifications.

## State and verification matrix

- [x] Empty, no-results, loading, failure, and populated states are represented by shared components.
- [x] Pagination is hidden when the collection cannot paginate.
- [x] Light/dark semantics use one token map.
- [x] Existing Supabase auth, row ownership, financial safeguards, approval gates, attachments, and Google Calendar sync/conflicts are unchanged.
- [x] Browser-inspected Today, Inbox, Tasks, Calendar month/agenda, Calendar event editor, Projects, and Finance at the available 953px app viewport; light and dark themes checked.
- [x] Keyboard-visible semantics and accessible names inspected through the browser accessibility tree; the repository's mobile-responsive regression tests pass.
- [x] Production build, TypeScript, ESLint, 670 automated tests, diff check, and strict premium UI audit pass.
- [ ] Exact 1440px, 1280px, and 390px screenshot capture is blocked because the current in-app browser surface does not expose viewport resizing; 953px was visually inspected and breakpoint behavior was verified statically and by tests.
- [ ] Credential-dependent external sync execution requires valid provider credentials in the environment.
- [ ] A Mobbin comparative pass requires starting a task session in which the authenticated `mobbin` MCP tools are exposed.
