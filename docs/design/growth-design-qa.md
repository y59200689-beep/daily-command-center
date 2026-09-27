# Growth overview design QA

- Source: `/Users/youssefmahir/Downloads/ChatGPT Image Sep 27, 2026, 10_51_29 AM.png`
- Preview: http://localhost:3000/growth
- Browser screenshot: `docs/design/screenshots/after/growth-desktop.png`
- Density-normalized screenshot: `docs/design/screenshots/after/growth-desktop-normalized.png`
- Mobile: `docs/design/screenshots/after/growth-mobile-normalized.png` (raw capture retained alongside it).
- Desktop CSS viewport: 1587 × 992, within one CSS pixel of the 1586 × 992 source. The browser's current zoom reports devicePixelRatio 0.75; its capture contains an unused backing surface. Raw capture is 2096 × 1323; the rendered viewport occupies its upper-left half. Cropping only that backing-surface margin and normalizing screenshot density produces a 1586 × 992 comparison image. Source image remains unmodified.
- Mobile CSS viewport: 391 × 844, normalized to 390 × 844 image pixels using the same capture normalization. Original capture: 501 × 1125.
- State: authenticated light-theme workspace, loaded empty commercial data, MAD, all-time pipeline snapshot, last-six-month service value, no selected stage or open dialog.

## Comparison evidence

The source and browser capture were shown together, followed by a same-input comparison of the source and density-normalized implementation. Full view checks include the breadcrumb/title/navigation, four metrics, opportunities/stage chart grid, three insight cards, and five navigation cards. Focused DOM measurements confirmed panel positions and dimensions: opportunities begin near y=312, the insight row near y=633, and navigation near y=889. The reference uses y=313, y=630 and y=887. Mobile was separately inspected at its narrow viewport.

Typography: Geist retains the shared application font and closely matches the source's compact sans-serif character. The 38px title, bold financial figures, semibold section headings, and muted supporting text preserve the hierarchy. Source typeface is inferred from the raster. Table copy remains readable and horizontally scrolls within its panel when records exist; long financial values can wrap instead of overflowing.

Spacing/layout: four equal summary cards, asymmetric upper grid, three insight panels, and five destination cards follow the source. Panel borders, 15px radii and restrained elevation stay consistent with the Business reference variant. The global shell remains the application's canonical shell, with a slightly narrower sidebar/header than the source.

Colors/tokens: shared violet #713CFF, lavender #EEE8FF, ink #151536, muted #69759B, line #E6E9FC and white surfaces align with the visual target. Stage colors and green/orange/blue metric icons retain the reference's semantic distinctions. Dark mode inherits Business token remapping and removes the light background raster.

Assets: reuses the existing generated lavender ribbon canvas `public/images/business/overview-background.png`, appropriate to this same visual family. It scales cleanly behind the content. Lucide supplies the matching outline icons; Recharts supplies actual stage and service charts. No fictional client logos/owner avatars are inserted.

Copy/content: the reference's headings and introduction are retained. Actual workspace values replace sample financial figures, growth percentages and fictional rows. Unsupported utilization is replaced by accepted service value, services sold, and buying clients. Service value sums accepted line items once rather than repeating whole proposal totals per service. Risks and financial values remain currency-scoped. Current snapshot and all-time invoice/payment bases are explicitly labeled.

## Comparison history

1. [P2, resolved] Initial stage chart height and insight padding pushed destination cards below the reference's first viewport. Tightened chart height, stage-label line heights, empty-state spacing and header gap. Final navigation begins near y=889 versus the reference y=887.
2. [P2, resolved] A hidden absolute table-header label escaped the mobile scroll container, causing page width 668px in a 391px viewport. Made the table wrapper a positioning context. Post-fix document width is 376px within the 391px viewport. Empty mobile tables omit the unused header/scrollbar; populated tables retain contained scrolling.
3. [P2, resolved] A Won chart filter initially only used open opportunities. Won filtering now uses won records; period/currency filtering consistently applies to both chart and table.

## Interaction evidence

- Summary card opens the canonical Modal with underlying records and the currency/data basis.
- New opportunity opens the existing BusinessEditor; Cancel closes it. Production records were not created for testing.
- Proposal stage selection changes pressed state, filters the table and exposes Clear stage filter; clearing restores the overview.
- Pipeline period switches to This month and labels the date basis; restored All time.
- Service period changes from six to three months and updates chart semantics; restored six months.
- Refresh exposes updating labels and disables duplicate activation, then returns to loaded content.
- Mobile viewport preserves workspace links, metrics, all panels and fixed app navigation without document horizontal overflow.
- Opportunity updates reuse the existing authenticated business API; dormant-client outreach uses the existing follow-up API with duplicate prevention, field validation/focus, retained failure state and shared toast feedback.
- Browser logs contained a transient missing-CSS error while the stylesheet was being created. The stylesheet is present, rendering works and production compilation succeeds; no unresolved runtime error was observed.

## Verification

- 861 tests passed, including new currency isolation, issued-invoice/won-date semantics, stage grouping/period denominator, and service-line attribution tests.
- TypeScript passed; lint passed without warnings.
- Production build passed.
- Strict static UI audit retains 16 pre-existing findings outside Growth/Business, with no findings in the changed features.
- Save/outreach writes, populated client rows, dark-theme appearance and offline behavior were not browser-tested against the current empty production workspace. Existing APIs/schema validation remain the mutation owners.

## Findings

No remaining actionable P0/P1/P2 visual or layout findings.

## Follow-up polish

- [P3] The exact source typeface and global shell dimensions differ slightly; existing shared application ownership is retained.

## Final result

passed
