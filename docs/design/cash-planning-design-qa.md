# Cash & planning design QA

final result: passed

## Scope and evidence
- Reference: `docs/design/references/cash-planning.png` (1672 × 941).
- Desktop: `docs/design/screenshots/after/cash-planning-desktop.png` (same CSS viewport, overview, 6-month period, 90-day horizon).
- Mobile: `docs/design/screenshots/after/cash-planning-mobile.png` (391 × 844).
- Source and desktop capture were opened together for visual comparison. Raw captures are retained alongside normalized captures; normalization compensates for the in-app browser backing surface/zoom.
- Existing workspace navigation, typography and real financial records are preserved. The reference's sample amounts and percentage changes are not inserted into production data.

## Review
The overview reproduces the reference's lavender canvas, banner with finance illustration, five summary cards, cash-flow/accounts split, and three lower planning panels. Currency selection is an additional functional control. Unknown balances have explicit empty states and relevant actions, so their visual density differs from the populated reference.

Resolved issues:
- P2: illustration failed through authenticated image optimization. Direct authenticated asset delivery now loads successfully.
- P2: a Recharts tooltip retained its desktop position after resizing and caused mobile horizontal overflow. Chart containers now contain this overflow; confirmed document width equals viewport width.
- P2: empty chart auto-scale displayed arbitrary currency ticks. Empty history now shows only the zero tick.

No outstanding P0/P1/P2 issues in the inspected overview.
P3: generated finance artwork is a close stylistic interpretation, not the identical reference asset. Existing application shell remains consistent with other pages.

## Interaction and validation
- Chart selector changes 6 months to 3 months and back, including chart labels/data description.
- Cash card opens account details; dialog closes normally.
- Add account opens the existing validated account editor; cancelled without changes.
- Scenario horizon selection works; create scenario opens the existing assumptions editor; cancelled without changes.
- Guidance banner dismisses and restores.
- Desktop and mobile have no document horizontal overflow; mobile navigation wraps and cards stack.
- Latest browser session has no error logs; generated artwork has a nonzero natural width.
- 886 tests pass, including new settlement-date, currency isolation, year-boundary and unknown-versus-zero reserve tests.
- TypeScript, changed-file ESLint and production build pass.

## Data limits
The live workspace has no cash accounts or financial commitments for this overview. Populated charts use existing forecast calculations; populated scenario comparison and multi-currency UI could not be exercised against live records without creating financial data. No live financial records were changed during QA. Forecasts stay unavailable until a balance is recorded. Received payments and paid obligations form history; expense records are not treated as settlement evidence.
