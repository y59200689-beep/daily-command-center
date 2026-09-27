# Prompts design QA
Status: passed
Reference: docs/design/references/prompts.png
Implementation: /prompts; development-only /prompts?preview=design

Source and selected desktop/mobile captures were inspected together. The implementation preserves the reference's lavender canvas, purple action hierarchy, four-card strip, selected list and adjacent detail panel, mono instruction preview and variable chips. Existing shell remains in place. Screenshot data unsupported by the actual schema (owners, status, success rate, decimal version labels) is replaced with detected variables, favorites, recorded usage and ratings. Responsive table columns collapse before clipping. No horizontal overflow at 1296x970 or 391x845.

Browser evidence: loading/live empty library; preview selection, category popup/filter, list/grid, no-results/clear, missing-variable validation, expanded instruction output, clipboard, duplicate, edit snapshots, version restoration, mobile drawer/Escape/focus return. Preview operations only; persistent writes were not exercised against user records. Existing authenticated persistence endpoints were reused.

Engineering: full lint, TypeScript, 900 tests and production build passed. Build reported a non-fatal webpack cache ENOSPC warning but completed successfully. Premium static audit has no findings in changed Prompts files; 23 findings remain in unrelated existing workflows. Report: /tmp/prompts-premium-audit.json.

Captures: docs/design/screenshots/after/prompts-desktop-selected.png; docs/design/screenshots/after/prompts-mobile.png.
