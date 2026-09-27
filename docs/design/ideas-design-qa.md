# Ideas design QA

final result: passed

Source: docs/design/references/ideas.png (1586 × 992).
Final desktop: docs/design/screenshots/after/ideas-desktop.png (CSS viewport 1586 × 991).
Mobile: docs/design/screenshots/after/ideas-mobile.png (391 × 845).
Browser backing captures cropped to rendered region and normalized to CSS dimensions.

Compared source and final desktop screenshot together. Improved row density and retained category/date columns at reference width after initial comparison. Final surfaces, selected-row treatment, hierarchy, sidebar and responsive drawer reviewed. Intentional differences: actual schema uses potential and stage, no tags or assigned-owner avatars, and linking existing projects rather than unsupported conversion. Preview is visibly labeled and uses six sample ideas; live vault is empty.

Verified selection, list/grid switch, search empty state/clear, preview edit/save and stage update, mobile drawer and Escape focus restoration. No live ideas created or changed. Persistence remains through existing entity APIs; live writes were not exercised.

Validation: 898 tests pass; TypeScript and changed-file lint pass; production build passes.
