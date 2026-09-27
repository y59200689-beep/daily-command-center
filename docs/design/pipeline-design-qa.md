# Pipeline visual QA

Source: `/Users/youssefmahir/Downloads/pipeline.png` (user-supplied 1672 × 941 reference).
Implementation: `/pipeline?view=opportunities`; screenshots `screenshots/after/pipeline-desktop.png` and `pipeline-mobile-raw.png`.
Desktop CSS viewport: 1672 × 941. Mobile CSS viewport: 391 × 844. Browser captures include unused backing surface; desktop cropped to rendered upper-left half and normalized to reference size.

Implemented and browser-verified: board/list switching, stage filters, legend filtering, distribution period, search/reset, Deal health navigation, health explanations, stage-specific creation defaults, empty-title validation, and mobile width containment. Actual workspace currently has no opportunities; populated mutation flows were not exercised against production records. Helper tests cover scoring, filtering, currency, pagination, and ordering.

Earlier layout issue: the separate scope row pushed the board below the reference position; moved scope/currency into the navigation row and tightened sidebar distribution spacing. Final desktop board begins at the intended reference region and mobile board scrolls internally.

Remaining gate: the source file is no longer present at its supplied Downloads path. A targeted search did not find another copy. The final screenshot was captured and inspected, but the mandatory final combined source/implementation comparison could not be repeated. No production records were created to populate QA.

final result: blocked
