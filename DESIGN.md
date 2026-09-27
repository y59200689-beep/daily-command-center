---
version: alpha
colors:
  primary: "#5B5BD6"
  canvas: "#F7F7F8"
  surface: "#FFFFFF"
  surfaceMuted: "#F1F2F4"
  ink: "#202124"
  muted: "#666A73"
  line: "#E2E3E7"
  attention: "#5B5BD6"
  success: "#287A55"
  warning: "#9A6418"
  danger: "#B33A3A"
typography:
  display:
    fontFamily: '"Geist", Arial, sans-serif'
    fontSize: "2.125rem"
    lineHeight: "1.15"
  body:
    fontFamily: '"Geist", Arial, sans-serif'
    fontSize: "0.8125rem"
    lineHeight: "1.5"
  utility:
    fontFamily: '"Geist Mono", monospace'
    fontSize: "0.5625rem"
    lineHeight: "1.25"
rounded:
  control: "0.4375rem"
  surface: "0.5625rem"
  pill: "999px"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "0.875rem"
  lg: "1.25rem"
  xl: "2rem"
components:
  button:
    height: "2.125rem"
    rounded: "0.4375rem"
  panel:
    rounded: "0.5625rem"
  search:
    height: "2.125rem"
    rounded: "0.4375rem"
---

## Overview

Daily Command Center is a calm personal workbench for an operator moving between daily execution and deeper business systems. The product register leads: compact controls, dependable alignment, and purpose-built work views. Its signature is the attention rail—a narrow indigo edge used only on the selected destination and the single most useful next action. It must never become a decorative stripe system.

The interface takes structural cues from mature productivity software without imitating any one product: Slack-like separation of frequent navigation from workspace depth, Notion-like contextual detail, and the purposeful view controls common to Monday and ClickUp. Avoid dashboard mosaics, motivational hero copy, mint-tinted canvases, decorative metrics, and inflated empty cards.

The desktop navigation keeps the slim icon rail visible at all times. Each area icon opens a floating contextual menu over the current page; choosing a destination closes the menu. The menu follows the supplied Personal sidebar reference with a rounded white surface, purple capture action, grouped icon rows, and a compact account card. Small screens retain the existing mobile drawer and bottom navigation.

Runtime variables in `src/app/product-system.css` are canonical (token mapping model B). This file mirrors accepted semantic values and explains intent. Legacy feature selectors remain in `src/app/globals.css` during migration, but shared shell and workflow styling must consume the canonical variables.

## Colors

Neutral gray canvas and white surfaces carry the interface. Indigo is reserved for primary actions, selected navigation, focus, and the current item. Green communicates completion, amber communicates waiting or reversible caution, and red is reserved for destructive or failed states. Dark mode remaps semantic roles rather than inverting literal colors. Project colors may appear only as narrow identity marks.

The dark workspace palette uses a #11131B canvas, #1B1E29 surfaces, #242838 raised controls, #383D50 borders, #F2F1FA primary text, and #B2BAD0 supporting text. Violet accents brighten to #B4A0FF. The shared semantic variables remain in `product-system.css`; `dark-workspaces.css` adapts feature styles that still contain literal light reference colors. Image-backed panels use a dark overlay so text and the image remain legible together.

## Typography

Geist is the sole display and body family so hierarchy comes from scale, weight, and spacing rather than editorial decoration. Page titles top out at 34px on desktop and 25px on mobile. Geist Mono is limited to dates, counts, shortcuts, and small section labels. Controls and table rows remain readable at compact SaaS density.

## Layout

Related workspaces use one compact tab strip above the existing page content. Tabs are plain text controls on a muted surface, with the selected view on the standard white surface. This keeps established page components and their actions while reducing duplicate destinations in the navigation rail. The icon rail remains at six areas; the contextual menu lists the primary destinations, and deeper destinations remain accessible through section tabs, links, and search.

Desktop uses a 232px persistent sidebar, a 52px command bar, and a fluid content workspace capped at 1480px. The first sidebar tier contains the six everyday destinations; deeper capabilities are grouped into four scan-friendly workspaces. At 767px and below, the sidebar becomes a drawer and a five-item bottom bar preserves Today, Tasks, Capture, Calendar, and More.

List pages use a compact title/action row, one view-control bar, and a purpose-built work surface. Today puts the recommendation, focus capacity, priorities, and next calendar actions in the first viewport. Calendar uses a month surface on desktop and chronological agenda on mobile. Detail context stays in dialogs/sheets or existing detail routes so closing it preserves list context.

## Elevation & Depth

Static content is flat. Borders, tone, and alignment create separation. Only overlays, account menus, and command surfaces use the shared shadow. Hover never lifts routine controls.

## Shapes

Controls use 7px radii and contained surfaces use 9px. Status markers use compact rounded rectangles; fully pill-shaped geometry is limited to binary status or exceptional compact metadata. Large rounded cards are not a page-layout device.

## Components

`AppShell` owns responsive navigation, search entry, account actions, theme, and capture. `DomainPage` owns canonical CRUD state and delegates to purpose-built Tasks, Inbox, Calendar, Projects, and generic record surfaces. `Button`, `Modal`, `SearchInput`, and `ToastProvider` remain canonical interaction owners. Every enabled action has hover, active, visible focus, disabled, and busy behavior; global scrollbars and reduced motion are defined once.

## Do's and Don'ts

- Do expose the next useful action before summaries or explanation.
- Do use the same dataset controls and verbs across equivalent routes.
- Do preserve compact desktop density and 44px mobile touch targets.
- Do keep empty states short and actionable while preserving the shape of the real view.
- Don't show infrastructure or authentication implementation language in product copy.
- Don't render pagination unless the dataset can actually paginate.
- Don't make every domain look like the same table or card grid.
- Don't introduce decorative integrations, metrics, or actions that are not wired to real behavior.

## Business overview reference variant

The Business overview follows the user-supplied September 27, 2026 image: a pale lavender image-backed canvas, four compact summary cards, a five-part interactive pipeline, sales actions on the left, commercial state on the right, and a forecast/reactivation row. This route is an explicit exception to the flat 9px panel treatment: its surfaces use 16px corners and understated shadows. The rest of the business workspaces retain their existing visual contracts.

`src/features/business/business-dashboard.css` owns the scoped `--business-*` tokens: violet #713CFF, violet soft #EEE8FF, potential series #D9CAFF, ink #151536, muted #69759B, line #E6E9FC, and surface #FFFFFF, with semantic green/orange/blue accents. The CSS, Recharts series, and dashboard components consume these same tokens. Geist remains the shared font; the reference variant uses a 38px heading, 16px section titles, and 12–14px body copy. The canvas asset is `public/images/business/overview-background.png`, generated from the supplied reference. Dark mode replaces the canvas artwork with the dark workspace surface and remaps the component tokens. Small screens preserve every section and control in one column.

## Growth overview reference variant

Growth follows the supplied September 27, 2026 reference: four summary cards, a wide opportunities table beside a stage chart, risk/dormant-client/service panels, and five navigation cards. It reuses Business's scoped `--business-*` palette, generated lavender ribbon background, Geist hierarchy, 15px panel corners, and Lucide icon library. `src/features/growth/growth-home.css` owns Growth's grid, compact table, responsive stacking, and violet Pipeline navigation card. Shared Button, Modal, ToastProvider, BusinessEditor and global theme remain canonical owners. No sample clients, owner avatars, unsupported utilization, or invented trends are displayed.

## Team reference variant

Team uses the supplied team.png reference with the shared Business lavender canvas, scoped palette, Geist type, Lucide icons, and rounded white surfaces. Its directory expands across the page until a person is selected; selection creates the reference's two-column directory/member layout. Mobile stacks the member panel above the directory and confines wide tables to their own scroll region. Real avatar URLs are used when available; otherwise initials identify the person. Capacity is the existing recorded state, never an invented utilization percentage. Current counts replace unsupported comparison trends.

## Pipeline reference variant

Pipeline follows pipeline.png: a compact Business breadcrumb/title, two workspace tabs, four metrics, six tinted stage lanes and a right-hand column of health, stage distribution, next actions and upcoming follow-ups. The shared Business canvas, scoped violet/ink/muted palette, Geist type, Lucide icons, and 12–16px white surfaces remain canonical. Recharts renders actual distribution and win-rate rings. Existing SearchInput, StyledSelect, Modal, Button, BusinessEditor and ToastProvider own shared interactions. The wide board scrolls inside its panel on narrower desktops/mobile; insights stack below it. No fictional clients, owners, percentages or historical trends are introduced.

## Finance overview — reference implementation
The Finance records overview follows `finance.png`: lavender background asset reused from Business; white outlined cards; six metric tiles; a 2:1 cash chart and cash-position row; invoices, expenses, and stacked attention/renewal panels. Existing Geist type and Lucide outline icons preserve the application language. Purple identifies inflow, blue expenses; statuses also have readable text. At tablet sizes metrics wrap into three columns; phones use two columns with stacked panels and horizontally scrollable navigation/tables. Real records replace sample values. Historical charts only render recorded payment/expense activity; current receivable balances are explicitly labeled, with no invented historic comparisons.

## Leads directory and selected-lead panel
Reference: `docs/design/references/leads.png` (1672 × 941). Leads uses the existing lavender Business background, four white KPI cards, rounded filter controls, a dense directory, and a 450px detail panel on wide desktops. The reference's primary visual hierarchy, pastel status pills, outlined cards, spacing, and purple selected row are preserved. User-owned records use initials when no logo exists; no company logos or trend percentages are invented. Actual app statuses/sources and linked opportunity stages replace unsupported reference categories. Owner is the authenticated private workspace user; no unsupported assignment filter is shown. Mobile opens a full-width accessible drawer with Escape, focus return, and constrained Tab navigation.

### Customer Success overview
The `/success` overview follows the selected Customer Success reference: eight current-state metrics, a searchable portfolio table, a three-card health/renewal row, a right-side client overview on selection, and supporting waiting/issues/signals panels. Reuse the lavender canvas and Lucide icon vocabulary. Keep health categories disjoint and render unknown assessments explicitly; do not invent historical deltas, ARR, or numeric health scores.

## Risks reference variant
The Risks Signals view follows risks.png with the shared lavender canvas, five live summary cards, evidence-rich signal rows, severity distribution, snapshot trend and a right-side detail panel. Scoped risks-dashboard.css owns the responsive layout and semantic severity palette. Real rule-based priority scores replace sample values; missing history and ownership have explicit honest states.

## Personal settings reference variant
Settings follows profile setting.png with the shared lavender canvas, a seven-section navigation rail, real-profile identity banner and two-column settings center. The shell extends consistently to Workspace, Notifications, Integrations, Security, Appearance and Preferences. Settings-scoped tokens own ink, muted text, borders, surfaces and violet highlights; Lucide icons match the reference line weight. Existing generated canvas artwork is reused; identity initials are real UI. Mobile uses a horizontally scrollable section navigation with the active item brought into view, stacked forms and generous bottom clearance. Light and dark themes share the same hierarchy.

## Idea vault reference variant
Ideas follows ideas.png with the shared lavender canvas, four live summaries, searchable list/grid, tinted category icons and an adjacent idea panel. Scoped ideas-dashboard.css owns the responsive layout. Mobile selection becomes a modal drawer. Existing fields replace unsupported owners, tags, trends and conversion counts.

## Prompt library
The September 27 Prompts reference defines the lavender canvas, four compact summary cards, outlined filter strip, selected template row and adjacent white detail panel. `src/features/prompts/prompts-dashboard.css` owns the scoped pv tokens, mapped to the same purple/ink/surface visual language as Ideas. The global shell, Modal, Button, StyledSelect and ToastProvider remain canonical. On mobile the selected template becomes a focus-contained drawer. Data columns use the stored category, detected variables, recorded usage and update date; unsupported owners, status, success percentages and arbitrary version labels are omitted.

## Fitness dashboard
The September 27 Fitness reference sets six color-coded metrics, connected-app cards, a four-card progress section, compact target/activity tables and a right sidebar for focus, streaks, milestones and recovery. `src/features/fitness/fitness-dashboard.css` owns the scoped fh tokens and reuses the global shell, purple surfaces, existing mountain image, canonical Modal/Button/StyledSelect/DatePicker and ToastProvider. Recharts owns the data visualizations. Narrow layouts use two-column metrics/progress, stacked panels, and locally scrollable tables.

### Life dashboard
Life uses the shared shell and a quiet lavender canvas, six compact counters, coastal illustration, four personal planning cards, a side overview, and a second row for fitness, goals, dates and routines. Keep controls on Button, DatePicker, Modal, and ToastProvider. Original coastal raster assets live in public/images/life. Real values come from the existing Life API; development-only preview=design supplies sample records with local state and no write requests. Quick access customization lasts for the page visit.

### Desktop header actions
The shared desktop header follows the September 27 controls reference: softly rounded surface buttons, a purple capture icon, a filled crescent in light mode, and a purple circular avatar joined to a dropdown pill. Keep the notification dot tied to unread records and retain its accessible count. Header action styles live in product-system.css; existing capture, notification, theme and account handlers remain canonical.

### Trips workspace
Trips follows the supplied trips.png reference: four compact metrics, a searchable destination list beside an image-backed trip panel, and itinerary, bookings, packing and expense summaries below. Scoped tr tokens consume shared surface/ink/muted variables; the violet accent, soft lavender canvas and 13px panels align with Life. Original destination imagery is in public/images/trips. Canonical Modal, Button, DatePicker, StyledSelect and ToastProvider own interactions. Recharts owns quantitative visuals. Mobile stacks panels and retains all tabs and controls.
