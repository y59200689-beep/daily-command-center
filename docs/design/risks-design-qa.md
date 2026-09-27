# Risks design QA

final result: passed

Reference: docs/design/references/risks.png
Desktop evidence: docs/design/screenshots/after/risks-desktop.png
Mobile evidence: docs/design/screenshots/after/risks-mobile-panel.png

Compared the source and implemented desktop capture together. Checked the lavender canvas, heading/actions, metric hierarchy, selected-row treatment, two-column content, severity chart and detail-panel hierarchy. Desktop CSS viewport 1672 × 941; mobile CSS viewport 391 × 845. Browser backing-surface captures were cropped to the rendered region and normalized to CSS dimensions. No horizontal document overflow at either size.

Verified risk selection, correct evidence and source links, search, severity empty state and clearing filters, register create-form navigation and cancellation. Mobile drawer supports Escape, background inertness and focus restoration. No workspace records were created or modified during QA.

Intentional data differences: actual scores and source dates; affected areas instead of unsupported monitoring totals; source-record ownership instead of invented people; explicit empty snapshot history instead of sample trends.

Validation: 893 tests passed, TypeScript passed, changed-file ESLint passed, production build passed.
