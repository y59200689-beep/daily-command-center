# Daily Command Center UX contract

## Canonical UI Map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
| --- | --- | --- | --- | --- |
| Navigation shell | `AppShell` | This contract | Everyday rail / grouped workspaces / mobile drawer and bar | Responsive browser check |
| Authentication session | `AppShell` + Supabase SSR helpers | Supabase Auth | Current-browser sign out | Auth flow test |
| Commands and capture | `CommandPalette`, `QuickCapture` | This contract | Dialog / mobile sheet | Keyboard and mobile checks |
| Search field | `SearchInput` | `DESIGN.md` and this contract | Standard / command palette | Keyboard, clear, and responsive checks |
| Form | Shared field classes + Zod server validation | This contract | Create / sign-in | Validation tests |
| Select/Listbox | Native control | `DESIGN.md` and this contract | Native | Keyboard and popup check |
| Date | Native control | This contract | Native ISO date | Locale and keyboard check |
| Toast | `ToastProvider` | This contract | Success / warning / info / error | Live-region check |
| CRUD | Domain API routes | This contract | Return to list / stay in context | Task flow test |
| Scrollbar | `globals.css` | `DESIGN.md` | Stable-gutter exception | Computed style check |
| Dialog/drawer | `Modal` | This contract | Centered dialog / mobile sheet | Focus and viewport check |
| Finance ledger | Invoice/payment RPCs | Supabase | MAD summary / per-currency detail | Calculation and RLS tests |
| Content workflow | `ContentCommandCenter` | Supabase | Kanban / list / calendar | URL, approval, and upload checks |
| Private attachments | `AttachmentSection` + attachment API | Supabase Storage + `attachments` | Entity section / global Files ledger | Upload, ownership, signed-open, delete tests |
| Attention ranking | Server insight engine | Supabase | Maximum five derived signals | Ranking and expiry tests |

## Navigation and state

Today owns both the daily brief and daily planning mode. Planning owns week, month, quarter, and 90-day horizons. Waiting, Documents, Changes, Pipeline, Decisions, Risks, Business, and Finance each expose their related workflows as URL-addressable tabs on one entry page. Existing deep links redirect to the corresponding tab; the underlying records and mutation APIs remain separate where their business meaning differs. Weekly review exposes executive evidence and personal reflection as tabs, with links to distinct domain reviews. The sidebar lists primary destinations once rather than repeating them across groups.

The authenticated workspace opens at `/today`. Today, Inbox, Tasks, Calendar, Projects, and Clients stay in the first navigation tier. All other implemented capabilities remain reachable through four workspace groups, Settings, or command search. The mobile bar preserves Today, Tasks, Capture, Calendar, and More; More opens the complete navigation drawer.

Filters, committed search, sort, and pagination belong in URL parameters when server-backed. Temporary view presentation (for example Month versus Agenda before it is saved as a view) may remain local. A task/client detail opens in the canonical modal/sheet or its existing detail route. Escape closes the top layer and restores focus.

Successful client-side CRUD mutations update the owning `DomainPage` collection from the mutation response. Pages with separate derived data, sibling collections, or shell-level counts await an authoritative no-store refetch through `onMutationSuccess` and publish a typed workspace-mutation notification. Full-page reloads and unrelated cache invalidation are not part of the CRUD refresh contract.

## Feedback and recovery

Create, update, complete, archive, and connection actions show one shared toast. Validation is inline. Raw exceptions are never shown. Failed optimistic actions restore the prior value and keep the user in context. Loading reserves final geometry. Empty, no-results, no-permission, offline, and failure are distinct states.

Dataset pagination is rendered only when there is a preceding or following page. Calendar always preserves a recognizable planning surface in an empty month and becomes a chronological agenda on narrow screens. Task rows expose completion, status, priority, and due date without opening the editor; Inbox rows expose organize and clear actions.

## Data safety

Supabase is the production source of truth. Demo mode is explicit and uses in-memory sample data only; it never writes production records or persists user content to local storage. User IDs come only from verified server sessions. Archive is preferred for routine removal. Permanent deletion uses an app-owned danger confirmation and is not exposed in the first release UI.

Financial receipts are append-only in the product UI. Payments are recorded through an authenticated, row-locking database function that updates the invoice balance in the same transaction. Cross-currency values are never silently combined. Content uploads remain private in the existing attachments bucket and are opened through short-lived signed URLs.

Attachments use the shared private `attachments` bucket and metadata table. Uploads are limited to 6 MB, use owner-prefixed immutable object paths, validate metadata and file signatures server-side, and require an owned supported entity. Signed URLs live for 60 seconds and are issued only after authenticated row ownership is verified. Successful upload and delete operations update the visible list immediately; permanent file deletion uses the canonical app-owned confirmation dialog.

Today insights are derived server-side from current workspace data, filtered through category/severity preferences, deduplicated, expired, ranked, and capped at five. External-effect and financial assistant writes require explicit confirmation; assistant arguments never select a user identity.

V3 intelligence remains deterministic on page load and never calls OpenAI merely to render Today, planning, health, risks, analytics, or reviews. Every recommendation has a stable key, bounded score, action route, concise reason, and inspectable evidence. Today adapts to meeting, finance, content-deadline, deep-work, or balanced context. Dismissed items cool down, snoozed items stay hidden until their selected time, and irrelevant/hidden types are excluded. Accepted morning plans are the only suggestions allowed to replace daily wins; ownership and the three-win maximum are enforced atomically in Postgres. Predictions require minimum samples and expose evidence and assumptions. Structured memory is user-owned, confidence-aware, correctable, archivable, and validates source ownership in both the API and database. V3 assistant writes for plans and insight feedback require explicit confirmation and never accept a user ID.

The account disclosure is owned by `AppShell` on desktop and in the mobile navigation drawer. Sign out is pessimistic, disables duplicate activation, clears the current Supabase browser session, replaces the route with `/login`, and refreshes server-rendered state. Protected routes continue to rely on the authenticated proxy and ownership-scoped database access; account-specific records are never persisted in shared browser storage.

## Accessibility

Target WCAG 2.2 AA. Actions use semantic buttons/links, keyboard focus remains visible, every icon-only action has a name, drag operations have menu/button alternatives, motion respects reduced-motion, and touch targets are at least 44px on mobile.

## Focus sessions

Focus accepts a task, its linked project, or a project alone. Selection is URL-addressable and locked after a session starts. Duration is configurable from 1 to 1,440 minutes before starting. Project progress counts real, non-cancelled project tasks, including historical completions; standalone task progress counts its subtasks. Checkbox changes and new tasks use the canonical entity APIs. Session writes derive the task association from the owned session and record the linked project. Finishing a project session does not complete the project. Notes remain in memory until the session is saved.

## Business overview interactions

The overview is a BusinessWorkspace variant following the user’s September 27, 2026 visual reference. Summary cards open the canonical Modal with the underlying records; choosing a record opens the existing BusinessEditor. Pipeline stages disclose matching opportunities, combining qualified and meeting records into the Qualified segment; the Leads segment represents new opportunities. Financial cards and charts never combine currencies. Summary records are read across all collection pages. Commercial reporting filters on record update dates, and win rate means won divided by won plus lost. No month-over-month trend is inferred from current snapshots.

Revenue charts show accepted proposals by acceptance/update date and open opportunities weighted by probability by expected close date, excluding opportunities already represented by accepted proposals. Undated opportunities remain a separate unscheduled total; no forecast allocation is invented. Forecast periods use the existing business overview API and cancel stale requests. The chart legends toggle their series. Completing a sales action clears its next_action and date through the canonical opportunity API; an inline Undo restores them. Saves and reactivation actions refetch derived overview data. Business pulse and settings remain accessible from the overview footer.

## Growth overview interactions

Growth overview reads the existing authenticated, owner-scoped overview API. Currency-scoped cards disclose their source records; opportunity rows, next steps, and row actions open the canonical BusinessEditor and persist through existing business APIs. Snapshot totals separate currencies, exclude draft/cancelled invoices, and use actual won dates. Pipeline chart stage buttons filter the table; the reporting period uses record update dates consistently for chart and table. Won stage discloses won records despite the default table showing open deals. Stage shares include won deals and the basis is labeled.

Service performance sums each accepted service line once in its proposal currency and acceptance/update month; it displays accepted value, distinct services, and buying clients rather than unsupported utilization. Service-period controls change the chart buckets. Risks disclose evidence and recommended action; dormant-client outreach creates a follow-up only after the user submits the canonical Modal form. Requests cancel stale reads; save failure preserves the editor, duplicate submissions disable, success uses shared toasts. Transient dashboard filters stay local because this overview is a summary; full workspaces remain the durable navigation destinations. No records are created merely for visual verification.

## Team directory and member panel

Team reads existing owner-scoped people, delegation, responsibility, capacity and handoff APIs. Local search combines with role/status/team filters; name sorting is reversible. A member button opens the adjacent details panel, focuses its heading, highlights the selected row and loads that person's records with abortable requests. Close/Escape restores focus to the selected member. Tabs support arrow/Home/End navigation. On narrow screens the panel appears above the scrollable directory. Delegations, responsibilities and profile links lead to existing workspaces. Missing schema, loading, request failures and empty filters are distinct states.

Add person and Assign work use the canonical Modal, Button and ToastProvider. Forms validate required fields and email before submission, preserve values on API failure, prevent duplicate submission, and normalize absent delegation due dates to null. Closing is disabled during a save; successful saves refresh counts and the selected panel. New delegation is disabled until there are people to assign. No sample production records are created for QA. Team filters and member selection are transient local state.

## Pipeline board and insights

Pipeline is a BusinessWorkspace variant with Opportunities and Deal health addressed by the existing view query. All opportunity and client collection pages are loaded, with abortable reads and explicit retry. Currency isolates financial summaries, stage totals, deal health and board content. Summary cards disclose source records and calculation basis; win rate is all-time won divided by won plus lost. Weighted open value honors an explicit zero probability and uses stage defaults only when absent. Closed deals are excluded from open value; lost deals have an explicit filter outside the default six-lane board.

Search combines with client, recorded owner, stage and sort controls. Owner names come from the existing Team ownership map, which only includes its tracked opportunities; missing ownership is labeled Not recorded and is not inferred. Board/list layout and filters are transient local state. Stage distribution has an independent period based on record update/creation month, includes won and excludes lost; its legend filters the board. No user-facing percentage is invented from a missing historical series.

Stage lanes create opportunities with their stage and selected currency prefilled. Deal cards open the canonical BusinessEditor, extended with client/currency fields and schema-owned validation, invalid-field focus, retained input on failure and duplicate-save prevention. Blank optional fields normalize to null so edits can clear them. Drag-and-drop and the keyboard-accessible actions dialog use the same stage API; a failed optimistic move rolls back and keeps the dialog open for retry. Won actions reuse the existing idempotent project-conversion flow. Next action completion clears only its text/date; an inline Undo restores both. Mutations refresh derived data and use shared feedback. Sample production records are never created for QA.

## Finance overview interactions
- Currency scopes all amounts, tables, attention signals, subscriptions, and charts without conversion.
- Month selects cash activity, expected receivables, and invoices issued in that period; outstanding/overdue remain current balances and are labeled accordingly.
- Chart range switches 3/6/12 months ending at the selected month. Tooltips and an accessible chart description expose the values.
- Metric tiles and cash-position numbers open breakdown dialogs. Record rows open details. Dialogs use the shared keyboard focus/Escape behavior.
- New invoice opens the canonical invoice editor directly via a consumed create query parameter. Existing persistence and validation remain authoritative.
- Loading, failure/retry, empty history, absent records, and refresh are supported. Draft invoices are excluded from receivables; currencies never mix. No sample records are created.

## Leads directory
- Clicking a lead row or card opens its detail panel; closing returns focus without scrolling the document. Desktop panel remains alongside the directory; mobile uses a modal drawer.
- Search spans name/company/email/phone. Source/status/stage filters combine; stage comes from a linked opportunity. Due follow-ups include today and overdue open leads. Sorting supports recently updated/name/next follow-up. KPI cards apply relevant filters; list/grid and selection controls operate locally.
- Delete is available in the directory and selected-lead panel. Selecting directory checkboxes exposes Delete selected, with the exact selection count. Bulk deletion uses bounded requests to the same endpoint; successful rows are removed immediately and partial failures retain only failed leads for retry. The canonical Modal confirms the named lead, locks repeat submits, and preserves errors for retry. Existing owner-scoped DELETE archives the lead; linked opportunities and historical records remain intact. Success removes the row and selection immediately, updates counts, and returns focus to search. Background refresh cannot reinsert stale deleted rows.
- Notes, status, and scheduled follow-up persist via the existing authenticated PATCH endpoint. Save locks prevent duplicates; errors preserve input. Date/time entry uses local time and is stored as ISO UTC. Clearing dates/notes sends null explicitly.
- Profile uses the canonical editor, now exposing lead status and currency. Create opportunity carries the lead ID, name, value, source, and currency into the existing opportunity editor. This replaces unsupported direct conversion rather than implying a client was created.
- Activity shows recorded timestamps; files use existing lead attachments. No synthetic event history or file counts.
- Development-only `?preview=design` provides labeled in-memory fixtures for visual QA. Server production rendering never supplies fixture records. Preview mutations return before any API call; files are disabled for fixture IDs. Real workspace remains unchanged.

### Customer Success selection
Selecting a portfolio client opens their overview in place. Changing clients resets the panel to Overview. Search, health and owner filters operate together; clear filters restores the portfolio. The right-side panel becomes a modal drawer on narrow screens, supports Escape and keyboard focus containment, and returns focus to the invoking control. Notes, activity and actions are scoped to that client. Existing profile and workflow routes remain the edit destinations.

## Risks selection and evidence
Selecting a risk opens its evidence, priority score, impacted area and source-linked next action. Desktop uses an adjacent panel; mobile uses a modal drawer with Escape, focus containment and restored trigger focus. Search, severity and area filters combine, sorting is local, and CSV exports the filtered records. Add risk signal opens the existing validated register editor. Trends use saved snapshots only, and scores are rule-based priority rather than probability.

## Personal settings
- Profile uses the authenticated account and profiles row. Edit opens the shared accessible modal; display-name changes persist through an owner-scoped, strictly validated API and refresh shared identity. Email remains provider-managed.
- Workspace and notification controls retain their existing persistence; saving is disabled until loading succeeds. Errors preserve input, and successful saves receive visible feedback.
- Integrations reuse their existing provider controls and show their actual connection/error states. No sample connected apps or unsupported syncing badges.
- Preferences persist the existing profile time zone and week-start defaults. Invalid IANA zones, invalid week boundaries, empty names, and identity/authentication writes are rejected by the profile schema.
- Appearance uses the canonical theme store, applying immediately in the current browser. Security shows actual sign-in methods and date. Password changes require current-password verification and matching new passwords; OAuth accounts route password management to their provider.

## Idea vault interactions
Search, category, stage and potential filters combine; sort supports update date, creation date and name. Capture/edit use the existing owner-scoped entity API and preserve fields on failure. Stage updates persist through the same API. Related work links an existing project. Description doubles as notes; activity shows real timestamps. Mobile drawer contains focus, closes on Escape and restores trigger focus. Development-only design preview uses local fixtures and short-circuits every mutation before API access.

## Prompt library interactions
Source: `src/lib/domains.ts`, `/api/entities/prompts`, `/api/prompts/[id]`, `src/lib/v2.ts`.
- All collection pages load through the existing owner-scoped API with cancellation, loading, failure/retry and empty states. Search combines title, description and instructions with category/favorites filters and usage/name/update sorting. Transient filters remain local, consistent with Ideas.
- Record buttons open the right detail panel; Escape/close restores focus. Mobile uses an inert directory and keyboard-contained dialog drawer. Tabs support arrow/Home/End navigation. There is no fake bulk selection.
- Create, edit and duplicate use canonical Modal/Button/StyledSelect/ToastProvider, existing schema validation and API writes. Blank optional description normalizes to null. Duplicate creates a new template with no copied usage history. Saves lock duplicate submissions and preserve values on failure.
- Preparation uses the existing variable renderer and usage action. It expands instructions for copying into an AI tool; no AI generation or success-rate calculation is implied. Missing variables focus the first required field. Clipboard failures give corrective feedback.
- Versions disclose stored snapshots and restore through the existing endpoint. Activity shows only actual creation/update/last-use timestamps. Summary ratings are recorded ratings out of five; template count means instructions containing detected variables.
- Development-only `?preview=design` uses labeled fixtures and short-circuits every write before API access. No sample records are created in the workspace.

## Fitness dashboard and sample mode
Source: existing `/api/fitness`, `/api/entities/fitness`, `/api/entities/fitness-targets`, fitness schemas in `src/lib/domains.ts`, and FitnessSyncBar integration workflows.
- Fitness loads all activity/target collection pages. Metrics and charts derive from the selected period. Four-week view ends in the current week; weekly targets use the final week of that view and monthly targets use the anchor calendar month. Imported Pacer daily steps and MyFitnessPal nutrition are excluded from workout session counts; nutrition calories are excluded from burned calories.
- Target progress is observed progress, with In progress/Target met statuses. No unsupported on-track projection is inferred. Streaks are unique consecutive recorded dates through today or yesterday.
- Canonical Modal/Button/StyledSelect/DatePicker forms validate inputs, preserve entries on failure, prevent duplicate submission and publish workspace mutation events after actual saves. Manual activities and targets use existing owner-scoped persistence. Imported real records remain read-only here. Recovery links to existing observations; no live readiness score is fabricated.
- Development-only `?preview=design` provides 54 sample records over three weeks, four targets, illustrative recovery values and clearly labeled sample source states. Sample log/edit/target/steps/nutrition actions short-circuit before API writes. Sync simulates source refresh feedback, not provider access. Reset restores original in-memory fixtures. Closing/reloading discards sample changes. Preview links are hidden in production; production does not render fixture records.
- Weekly focus is explicitly saved only for the page visit. Filters, period and expanded activity list are transient dashboard state. No fake records are inserted into the user's fitness history.

### Life personal planning
LifeDashboard remains the canonical overview. Collection counters and chevrons open shared Modal views; records are created with the existing private Life forms/API. Date fields use DatePicker. Required names and important dates have inline validation; busy saves disable cancellation and repeat submit. Routine completion shows an acknowledged, disabled Done state. Sample preview is enabled only outside production and intercepts record, context, and completion writes. Reset sample restores the fixture and shortcuts. Preview edits and shortcut choices last for this visit. Fitness and goals use maintained workspace routes.

### Trips list and preview
The existing /travel route reads owner-scoped /api/life/trips; selection loads abortable trip details and retains the full existing /travel/[id] workspace for documents, visas, tasks, files and expense management. Search, filters, sorting, and selection are local transient state. Packing updates use the existing endpoint with save locks and feedback. New trip, itinerary, booking, packing and note forms use canonical controls and preserve input on failure. Currency totals never combine currencies. Countries visited counts completed trips only.
Development-only preview=design supplies six in-memory destination fixtures. Trip creation, packing, itinerary, bookings, notes, sample document labels and sample expenses return before all API writes. Sample changes last for the visit; reset restores fixtures. Sample artwork is illustrative. The live workspace does not contain fictional records or inferred live flight status.
