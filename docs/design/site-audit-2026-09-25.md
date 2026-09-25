# Daily Command website audit — 25 September 2026

## Audit scope and evidence

This is a combined functional, visual, and accessibility-risk review of the current signed-in local site. The goal is to make everyday planning and follow-through clear, trustworthy, and usable on desktop and mobile. The accessibility target is WCAG 2.2 AA; no compliance claim is made here.

I inspected current-run desktop screenshots and accessibility trees for `/tasks`, `/today`, `/plan`, `/calendar`, `/finance`, `/operations`, `/chief-of-staff`, `/business`, `/life`, and `/settings`. I also inspected the floating sidebar, global search, quick capture, notifications, dark mode, and a 390px Tasks viewport. I did not save the transient browser screenshots as files. The screenshots and states were observed during this audit, not reused from the older September 21 audit.

The repository contains 177 workspace `page.tsx` files, including 22 dynamic patterns. A sequential render sweep of the 155 concrete paths was started but stopped because it did not produce route-level progress within a practical run. A second HTTP response sweep reached at least 40 routes before `/dependencies` timed out at 45 seconds; the partial result file was removed because it contained authenticated request details. These runs are **not** evidence that all paths pass. The existing 48-test Tier 1–3 browser suite produced four passes before a ten-minute timeout in its fifth test; the remaining tests were not run in that attempt. The timeout occurred on `/changes`: “Save reviewed state” remained disabled while the page reported unavailable evaluation and comparison-history sources. That may be a local test-stack prerequisite and needs diagnosis before calling it a production bug.

One focused browser test in an isolated local Supabase account **passed**: create task → reopen detail → confirm permanent delete → GET returns 404. The disposable account and rows were cleaned up. The signed-in account’s records were not deleted. Light/dark toggling, dark theme after navigation, floating navigation auto-close, search results for existing tasks, quick capture open/cancel, and notifications open/close were also observed to work. The dark theme briefly showed the light shell during a full navigation before hydration switched it back.

## Highest-priority functional findings

| Priority | Surface | Evidence | Recommended fix |
| --- | --- | --- | --- |
| P1 | Calendar month view | `/calendar` shows “September 2026” and day cells but exposes no previous/next month control in the visible UI or accessibility tree. Users cannot inspect other months from this view. | Add previous/next month controls and a Today action. Preserve the chosen month when switching Month/Agenda. |
| P1 | Executive trust copy | `/chief-of-staff` says “All systems operating within normal parameters” while the visible evidence supports only “no pending approvals, failed executions, or urgent action proposals.” `/operations` says “All internal systems and tools are healthy” and “All SOPs are up to date and fresh” without a source count or check timestamp on the page. | Tie reassuring claims to verified source status. Distinguish “no records or alerts found” from “checked and healthy,” and show last checked/source coverage. |
| P2 | Chief of Staff primary action | On `/chief-of-staff`, “Take Action” links back to `/chief-of-staff` in the no-action state. It promises an action but reloads the same page. | Hide it in the clear state or link to a concrete action inbox, plan, or explanation. |
| P2 | Global search | Searching `GMB` initially showed “No matching command or workspace item,” then two matching task results arrived. The search field also shrank to a small input inside a wide modal after typing. | Show a searching state until the request settles, then render results or empty state; make the input fill the modal row. |
| P2 | Theme loading | After turning dark mode on, a full navigation to `/tasks` first painted the light shell, then switched to dark when the page loaded. | Apply the saved theme before first paint, including server-rendered shell or an early theme bootstrap. |
| P2 | Personal goal row | In `/life`, the “100K quarter · 0% · 2026-09-30” goal wraps into a very narrow vertical column at desktop width. | Give goal text a flexible content column, sensible min-width, and controlled wrapping. |

## Design audit

### Strengths

- The six-icon desktop rail remains pinned; its contextual panel floats above the page and closes after choosing a page. The selected area and route have visible active states.
- Primary creation controls are placed consistently in page headers. The task board, day plan, and overview cards share a recognizable visual language.
- The dark theme covers the shell, modal, board, and operations overview. The mobile drawer exposes major areas and the bottom bar keeps Today, Tasks, capture, and Calendar close at hand.
- The task form makes a permanent deletion explicit with a confirmation step; the isolated create/delete round trip passed.

### Structural UX risks

1. **Empty states claim success rather than explain setup.** Finance shows six `MAD 0` cards and “No overdue invoices,” Business shows four zero cards, and Operations shows health claims. A new or disconnected workspace can look fully measured. Add source/connectivity status and a clear first action in each empty module.
2. **Calendar hides its empty-state guidance below a full month grid.** At the audited desktop viewport, “No calendar yet” and its CTA sit below the fold. Put a compact empty-state cue near the calendar header while retaining the grid.
3. **Search starts with a long command catalog.** The first screen prioritizes Chief of Staff and many specialized commands rather than recent items or the user’s current context. Group recent work and common actions first; keep the full catalog searchable.
4. **Settings is a thin directory.** `/settings` visibly lists Integrations and Notifications, while other settings pages exist elsewhere. Add a complete settings index with area headings and current status so configuration is discoverable.
5. **Today repeats the same follow-up as two separate attention rows.** The two reasons are useful, but the repeated item increases scan time. Combine reasons under one item and one set of actions.

### Visual quality and accessibility risks

1. **Text is too small across major flows.** Current styles use 8–11px text for labels, descriptions, navigation metadata, calendar items, and task details (for example `product-system.css` and `teamhub-redesign.css`). At the observed desktop and mobile sizes, those labels are difficult to scan. Set body/supporting text to a readable scale, keep microtype only for nonessential decoration, and test 200% zoom.
2. **Oversized metric cards waste their own visual weight.** Plan, Business, and Finance show values at the bottom of tall mostly empty cards; the Plan “Overcommitted” card had no visible value. Reduce card height or add meaningful trend/context and a defined `0` or “None” state.
3. **Tasks board has a weak horizontal-scroll cue.** Eight status columns extend past the viewport; only about six are visible in the desktop capture. The scrollbar is subtle and the board ends halfway down the screen, leaving a large blank lower half. Add an explicit “more columns” cue or a compact board control, use more of the viewport height, and consider a default collapsed treatment for empty columns.
4. **Dark mode still relies on low-contrast microtext.** Muted labels, timestamps, and secondary controls are hard to distinguish from dark surfaces in the Tasks and Operations captures. Measure actual text/icon contrast and focus indicators before claiming WCAG 2.2 AA.
5. **Mobile Tasks remains dense.** At 390px, the board squeezes two columns with tiny card text and toolbar labels. Prefer a single-column status view or make List the mobile default, with a clearly indicated board swipe option.
6. **Visual hierarchy differs across hubs.** Today uses a large Founder State card; Business, Finance, and Plan use bottom-aligned KPI cards; Life uses a very large “You’re clear” statement; Settings is two unframed rows. Define a shared hierarchy for page title, status summary, next action, metrics, and empty states so the product feels like one system.

## Recommended order of work

1. Add Calendar month navigation and resolve the misleading health/empty-state copy.
2. Fix the Chief of Staff self-link, search loading/field layout, dark-mode first paint, and Life goal wrapping.
3. Establish a readable type scale and check color contrast, focus states, 200% zoom, and the mobile Tasks board.
4. Redesign KPI cards and empty states around “what is measured,” “what needs setup,” and “what to do next.”
5. Complete a route-by-route and control-by-control audit using a progress-logging runner against a production build or stable test server. Include all dynamic detail patterns with disposable owned records and run the remaining Tier 1–3 workflows.

## Verification limits

This is a substantive sample of the main page families, not a verified pass for every page or button. I did not submit live invoices, approvals, account settings, integrations, or user-owned deletions. A full 155-route render sweep and 43 uncompleted tests remain open coverage. The report separates visible product issues from the `/changes` and `/dependencies` test timeouts because those may depend on local test-stack behavior. No product code or design fixes were applied as part of this audit.
