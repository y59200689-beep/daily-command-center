# Revenue mission page — design QA

final result: passed

Reference: `/Users/youssefmahir/Downloads/ChatGPT Image Sep 28, 2026, 12_40_26 PM (1).png`
Rendered page: `http://localhost:3000/growth/mission`

The desktop build follows the reference's two-column layout, mountain mission hero, four summary cards, funnel, daily actions, opportunity ledger, and right-hand pace, follow-up, and review panels. The mountain art was generated as a standalone asset with the reference's lavender alpine palette and red summit flag. Icons use the app's Lucide set. The page has mobile stacking rules and reduced-motion handling.

Interaction checks: Today’s Open Mission link navigates to this page; the pace metric select filters rows and retains all options; the activity period changes its reported video count; action cards and section links navigate to relevant workspace pages; opportunity rows open a detail dialog when opportunities exist. Empty opportunities display an actionable route to the pipeline.

Mission control check: the bottom card renders a start-date input, adjustable duration and calculated finish date, editable pace goals, editable daily actions, and dated quantity/status/note logging. The plan saved successfully through the owner-scoped API and persisted after reload. The redesigned Activity period and daily status dropdowns were opened and visually checked in the browser. No sample activity log or invented start date was added.

Fresh-start check: mission activity remains at zero until the configured start date, and existing workspace clients do not count automatically. The mission-client picker lists available workspace clients, shows zero linked clients initially, and requires an explicit link before adding one to the mission count. Existing client records were left intact.

The reference's populated figures and Day 4 badge were design examples and are not copied as user data. Current figures use saved records. A specific mission start is not recorded, so the day badge stays neutral until a lead date exists. Revenue displays in USD at the dated MAD conversion rate, honoring the site's USD reporting preference. These content differences prevent a literal pixel-for-pixel match, but avoid displaying fabricated financial and sales activity.

TypeScript (`npx tsc --noEmit --incremental false`) and scoped ESLint passed. Production build was not repeated because the local disk filled while Next.js wrote its build cache; the page rendered and interactions were verified in the in-app browser.
