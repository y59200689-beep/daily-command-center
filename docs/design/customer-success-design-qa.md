# Customer Success design QA

final result: passed

## Visual evidence
- Selected reference: `docs/design/references/customer-success.png` (1586 × 992).
- Final desktop: `docs/design/screenshots/after/success-desktop.png`, captured at 1587 × 992 CSS pixels and normalized to the reference dimensions.
- Mobile overview: `docs/design/screenshots/after/success-mobile.png`.
- Mobile client drawer: `docs/design/screenshots/after/success-mobile-panel.png` (391 × 844).
- Reference and final desktop were opened together for direct comparison, with a selected client, Overview tab, all health, and all owners. Raw in-app captures are retained; normalization compensates for the browser backing surface and zoom.

## Design review
The implementation follows the reference's lavender background, eight KPI cards, portfolio table, three supporting health panels, selected-client sidebar, lower summary row, and view navigation. Existing shared navigation is retained. Client initials use actual record names; existing artwork and Lucide icons are reused.

Production data intentionally differs: two live clients instead of the reference's 32, no renewal/notes/activity records for the selected client, and no invented historical deltas, ARR or numeric health score. Unknown health remains distinct from healthy. Empty areas explain the missing records.

Resolved P2 findings:
- Sidebar height left a gap beneath the supporting cards; the left column now fills and aligns with the sidebar.
- Mobile close attempted focus restoration before the portfolio ceased being inert; restoration now occurs after the drawer unmounts and was verified on the original client button.
- Waiting links referenced an unavailable route; they now open the existing Client Journey view.
- Open Issues now opens its own issues dialog rather than navigating to unrelated risks.

No outstanding P0/P1/P2 issues in the inspected scope. P3: shared app chrome and data-dependent density differ slightly from the reference. Reference trend decoration is omitted where no history exists.

## Verified interactions
- Client row opens the right-side panel; switching clients changes the identity and health context and resets Overview.
- Overview, Recent activity, Notes, and Upcoming actions display client-scoped information/empty states.
- Search narrows to PARA DIVINE; combined search/health can produce no results; Clear filters restores both clients.
- Healthy metric filters to one of two clients; Total Clients restores all.
- Ownership filter exposes the actual Unassigned state and updates selection.
- Open Issues metric opens and closes its dialog.
- Mobile panel uses dialog semantics, background scrim, focus containment, Escape dismissal, and focus return to the selected client control.
- No document horizontal overflow on desktop or mobile. Portfolio table scrolls within its container on narrow screens.
- No live records were mutated during verification.

## Engineering validation
- 890 automated tests pass, including combined filters, next renewal/check-in selection, and latest-signal ordering without source mutation.
- TypeScript and changed-file ESLint pass.
- Production build passes.
- A transient development import error occurred before the new CSS file was written; it is resolved and the final page/build load successfully.
- Populated renewal, signal and issue rendering is not exercised against live records because those records are currently absent. Existing calculation logic and authenticated API remain the source of truth.
