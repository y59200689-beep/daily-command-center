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

Runtime variables in `src/app/product-system.css` are canonical (token mapping model B). This file mirrors accepted semantic values and explains intent. Legacy feature selectors remain in `src/app/globals.css` during migration, but shared shell and workflow styling must consume the canonical variables.

## Colors

Neutral gray canvas and white surfaces carry the interface. Indigo is reserved for primary actions, selected navigation, focus, and the current item. Green communicates completion, amber communicates waiting or reversible caution, and red is reserved for destructive or failed states. Dark mode remaps semantic roles rather than inverting literal colors. Project colors may appear only as narrow identity marks.

## Typography

Geist is the sole display and body family so hierarchy comes from scale, weight, and spacing rather than editorial decoration. Page titles top out at 34px on desktop and 25px on mobile. Geist Mono is limited to dates, counts, shortcuts, and small section labels. Controls and table rows remain readable at compact SaaS density.

## Layout

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
