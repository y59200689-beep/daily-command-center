# Exercises dataset integration report

Reviewed 7 October 2026. Upstream: https://github.com/hasaneyldrm/exercises-dataset.
Pinned snapshot: `7455efae41b330c265e7cd4b78dfa848e7ce5ebd`.

## Fit and placement

The repository is a reference dataset, not an installable gym tracking app or npm package. Best placement is Fitness → Exercise Library (`/fitness/exercises`), linked from the existing Fitness dashboard and Training Plans. Existing plans already store methodology, targets and notes; no duplicate database or exercise log system was created. Select up to 20 exercises, copy them and paste into existing plan notes. Selections stay in the current page session; this does not automatically save a workout or prescribe sets/repetitions.

## Snapshot inspection

- 1,324 records; all IDs unique.
- 10 body-part groups, 28 equipment types, target and supporting muscles.
- English, French, Spanish, Italian, Turkish, Russian, Chinese, Hindi, Polish and Korean instructions, all present for all 1,324 records. Exercise names remain English. Arabic is not included.
- Six repeated exercise names with distinct IDs; preserved rather than merged because IDs identify separate records.
- No missing English instructions in the reviewed snapshot. Completeness does not establish coaching accuracy or clinical suitability. Translation accuracy has not been independently reviewed.
- README lists ten instruction languages while the repository's short description mentions six. The actual JSON contains ten.
- Original JSON: 17,391,530 bytes, including duplicated instructions/step representations and media metadata. Normalized local catalog: 8,119,887 bytes before compression. Browser requests only 24 summaries per page or one exercise's instructions in the chosen language; the full catalog is server-only.

## Implemented

Search names, muscles and equipment; filter body part/equipment/target; paginated cards; multilingual step-by-step modal; selection/copy-to-plan; loading, empty, retry and clipboard-failure feedback. Uses existing SearchInput, StyledSelect, Modal and Button owners. Query/filter/page state persists in URL. Server requests are debounced, IME-aware and cancelled when superseded. Narrow layout and reduced-motion preferences are handled. No API key, paid service, schema migration or runtime dependency on GitHub is needed.

## License and media decision

Dataset names, structure and instructions are MIT licensed. The upstream LICENSE and NOTICE are retained under `src/data/exercises/`, with creator credit and repository link in the page footer. Gym visual thumbnails and GIFs are explicitly excluded from MIT and require rights under their separate terms. They were not copied, hotlinked or displayed. Repository permission to redistribute does not automatically license our project. See https://github.com/hasaneyldrm/exercises-dataset/blob/main/LICENSE and https://github.com/hasaneyldrm/exercises-dataset/blob/main/NOTICE.md.

No upstream HTML, SQL setup workflow, executable scripts or database architecture were adopted. We reviewed and normalized data only.

## Maintenance

Snapshot is vendored, not automatically refreshed. Review new upstream data/license changes before updating. To regenerate from a reviewed checkout:

```sh
node scripts/import-exercises-dataset.mjs /path/to/reviewed/exercises-dataset
```

The importer rejects duplicate IDs and missing English instructions, strips media fields and records the exact source commit. Keep copyright/license files and rerun typecheck, lint, dataset tests, build and browser checks. New releases may change IDs or text; never silently merge or rewrite users' plan notes.

## Verification

Typecheck, lint and all 938 tests passed during initial implementation. Browser checks verified search+equipment filtering, pagination, no-results/reset, English/French instructions, modal Escape/focus restoration, selection/copy and clearing, plus a narrow viewport with no horizontal overflow. Final typecheck, lint and production build passed. The strict UI audit reports zero findings. Changes are local until explicitly published.
