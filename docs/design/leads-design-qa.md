# Leads design QA

Source: `docs/design/references/leads.png` (copied from `/Users/youssefmahir/Downloads/leas.png`), 1672 × 941 pixels.
Implementation: `http://localhost:3000/leads`; populated testing at `http://localhost:3000/leads?preview=design`.
Desktop screenshot: `docs/design/screenshots/after/leads-desktop.png`.
Mobile screenshot: `docs/design/screenshots/after/leads-mobile.png`.

## Viewport and state
Desktop CSS 1672 × 941, mobile CSS 391 × 844, light theme. Browser zoom 0.75; raw desktop capture 2209 × 1255 includes unused backing space. Crop rendered upper-left half and normalize to source dimensions; mobile raw 501 × 1125 normalized to 391 × 844. Screenshot interpolation softens native text. Source and implementation viewed together repeatedly at matched dimensions, first lead selected and Overview visible. Focused right-panel crops compared together at `/tmp/leads-source-panel.png` and `/tmp/leads-built-panel.png`.

Production workspace has zero leads, so populated validation uses clearly labeled, development-only in-memory fixtures. Preview save handlers return before network requests; production route never passes fixture records. Actual page empty state also verified. Sample counts/dates reflect those fixtures, not source illustration totals.

## Findings and iteration
- Fixed P2: selecting a lead focused the panel with automatic scrolling, hiding the page heading. Focus now uses preventScroll; final capture retains header, KPI cards, filters, directory, and panel together.
- Fixed P2: right-panel property line heights made its lower sections drift down. Set explicit small/strong/em line heights and recaptured.
- Fixed P2: compact drawer keyboard containment. Added dialog semantics, background scroll lock, Tab wrapping, Escape dismissal and focus return. Mobile panel measured x=0, y=56, width=390.67, bottom=844 in a 391 × 844 viewport; no document overflow.
- Final combined full-view comparison shows no remaining actionable P0/P1/P2 issue.

## Fidelity surfaces
Typography: existing Geist/native text, bold heading and metric numbers, compact directory labels, muted secondary text, readable panel hierarchy. Minor source font/optical differences are P3.
Layout: four horizontal KPI cards, search/filter toolbar, selected lavender row, wide table and 450px desktop side panel. Reference section ordering, rounded outlines, spacing, and purple primary actions retained. Responsive cards wrap and drawer replaces desktop side panel.
Colors/tokens: lavender canvas asset reused from Business, white cards, purple accent, green/blue status colors, orange due labels; semantic labels accompany color.
Assets: existing generated background and Lucide icons. Real leads without logo data use initials; no invented brand logos. Metric watermark icons replace unsupported illustrative trend bars/percentages.
Copy/data differences: real supported lead statuses/sources; stages are linked opportunity stages. Owner is You because existing leads are private user-owned records; no fabricated assignment control. Activity is recorded milestones, not invented event history. Counts and conversion metrics are derived from records. Selection checkbox and open-detail state are separate intentionally.

## Functional checks
- Live empty state renders without error and offers New lead.
- Click lead opens right panel; selected row highlighted. Close/Escape restores focus.
- Search Orion yields one matching lead; list/grid toggle verified.
- Preview note save updates About text immediately.
- Preview status change updates table status immediately.
- Preview follow-up save updates table date, panel date, and due KPI from 0 to 1. Initial automatic approval rejection was resolved by inspecting the early-return preview guard; retry completed entirely in memory.
- Create opportunity opens canonical editor with lead name, USD currency, 5000 value and preserved lead link; cancelled without writing.
- Overview/Activity/Notes/Files are functional panels; file attachments use the existing saved-lead attachment component. File uploads were not exercised and are disabled for fixtures.
- Browser console error check returned no errors.
- 882 automated tests pass, including lead filtering, linked stage matching, due-day boundaries, creation window, empty metrics, and missing-date sorting. TypeScript, changed-file ESLint, production build and diff whitespace checks pass.

## Intentional limitation
Direct lead-to-client conversion has no existing supported endpoint. The panel offers the existing create-opportunity workflow, not a button implying client creation. No backend conversion schema or synthetic history was added.

## Follow-up polish
P3: shared app shell dimensions and unavailable company logos differ from the illustration. No blocking issues remain.

final result: passed
