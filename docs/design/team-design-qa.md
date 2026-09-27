# Team design QA

- Source visual truth: `/Users/youssefmahir/Downloads/team.png` (1672 × 941).
- Preview: http://localhost:3000/team
- Browser evidence: `docs/design/screenshots/after/team-desktop.png` and `team-mobile.png`; density-normalized counterparts are saved beside them.
- Desktop CSS viewport: 1672 × 941. Browser zoom reports devicePixelRatio 0.75; raw screenshot is 2209 × 1255 and includes unused backing surface. Crop that backing margin from the upper-left rendered half and resize to 1672 × 941 for comparison. The source remains untouched.
- Mobile CSS viewport: 391 × 844, raw capture 501 × 1125, normalized to 390 × 844 using the same capture treatment.
- State: authenticated light theme, loaded empty Team directory, reset filters, no dialog, page scrolled to top. The reference shows sample people and an open member panel; this account has no people, so its intentional empty state is the verifiable runtime state.

## Comparison evidence

Source and normalized desktop implementation were displayed in the same tool input, with mobile evidence beside them. Full-view review covered shared shell, breadcrumb, title, primary navigation, four summary cards, directory heading, filters, table hierarchy, and responsive empty state. A focused screenshot confirmed the search field's icon/input alignment after its fix. Existing shared shell is retained; its dimensions differ slightly from the raster. The reference's white rounded panels, violet actions, lavender canvas, compact typography and colored icon tiles are preserved. Desktop metric and directory positions closely follow the reference. Geist is the existing shared sans-serif; no new font is introduced.

The existing generated lavender canvas is reused. Lucide supplies icons; genuine avatar URLs render through Next Image, with initials for missing photos. Decorative metric icons replace reference mini charts because there is no recorded time series. Current counts replace invented growth percentages. Workload uses recorded capacity state rather than unsupported utilization percentages.

## Findings and comparison history

1. [P2, resolved] Initial canonical search control lacked route-loaded layout styles. Added scoped layout styling for the shared SearchInput; final screenshot shows aligned icon, full-width input and filters.
2. [P2, resolved] An absolute hidden table header escaped its scroll container on mobile, producing document width 818 in a 391px viewport. Positioned the table wrapper and scoped the visually hidden text. Post-fix document width is 376, within the viewport. Empty mobile tables omit unused headings; populated tables retain internal horizontal scrolling.
3. [P2, resolved] Initial forms relied on native popup validation and textarea resizing. Forms now own validation, announce errors, focus the invalid field, preserve input on save failure and constrain textarea resizing. Strict audit reports no findings in TeamHome.
4. No remaining actionable visual P0/P1/P2 findings in the verified empty state. Populated-member visual verification remains a test gap: no sample production records were created.

## Interaction evidence

- Add person opens the canonical Modal with labeled fields; Cancel closes it.
- Search changes the empty state to No people match these filters; Reset/Clear filters restores the directory.
- Mobile preserves all navigation and filters without page horizontal overflow.
- Name sorting, combined role/status/team filtering and earliest open delegation follow-up have automated helper coverage.
- Member selection implementation opens the right-hand panel, highlights the row, focuses its heading, reads owner-scoped detail data, cancels stale reads and restores focus on Close/Escape. Tabs include keyboard arrow/Home/End support. These populated interactions could not be exercised against real records because the directory is empty.
- Assign work opens a person-scoped delegation form. Saves disable duplicate submission and preserve input on failure; successful saves refresh counts and member data. Saves were not submitted to production during QA.
- Browser logs were checked. A transient missing Team stylesheet error occurred while the file was being created; the file now exists and renders. No unresolved Team runtime error was observed. Earlier Growth construction logs remain in the shared tab history.

## Verification

Lint and TypeScript pass. All 864 tests pass. Strict static audit retains 16 existing findings elsewhere, with none in the changed Team feature. Production build passes; final validation rerun includes the last accessibility/avatar changes.

Final result: passed
