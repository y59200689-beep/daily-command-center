# Daily Command Center UX contract

## Canonical UI Map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
| --- | --- | --- | --- | --- |
| Navigation shell | `AppShell` | This contract | Desktop rail / mobile bar | Responsive browser check |
| Authentication session | `AppShell` + Supabase SSR helpers | Supabase Auth | Current-browser sign out | Auth flow test |
| Commands and capture | `CommandPalette`, `QuickCapture` | This contract | Dialog / mobile sheet | Keyboard and mobile checks |
| Form | Shared field classes + Zod server validation | This contract | Create / sign-in | Validation tests |
| Select/Listbox | Native control | `DESIGN.md` and this contract | Native | Keyboard and popup check |
| Date | Native control | This contract | Native ISO date | Locale and keyboard check |
| Toast | `ToastProvider` | This contract | Success / warning / info / error | Live-region check |
| CRUD | Domain API routes | This contract | Return to list / stay in context | Task flow test |
| Scrollbar | `globals.css` | `DESIGN.md` | Stable-gutter exception | Computed style check |
| Dialog/drawer | `Modal` | This contract | Centered dialog / mobile sheet | Focus and viewport check |
| Finance ledger | Invoice/payment RPCs | Supabase | MAD summary / per-currency detail | Calculation and RLS tests |
| Content workflow | `ContentCommandCenter` | Supabase | Kanban / list / calendar | URL, approval, and upload checks |
| Attention ranking | Server insight engine | Supabase | Maximum five derived signals | Ranking and expiry tests |

## Navigation and state

The authenticated workspace opens at `/today`. Filters, committed search, sort, and pagination belong in URL parameters when server-backed. A task/client detail opens in a non-routing drawer on desktop and a full-screen sheet on mobile. Escape closes the top layer and restores focus.

Successful client-side CRUD mutations update the owning `DomainPage` collection from the mutation response. Pages with separate derived data, sibling collections, or shell-level counts await an authoritative no-store refetch through `onMutationSuccess` and publish a typed workspace-mutation notification. Full-page reloads and unrelated cache invalidation are not part of the CRUD refresh contract.

## Feedback and recovery

Create, update, complete, archive, and connection actions show one shared toast. Validation is inline. Raw exceptions are never shown. Failed optimistic actions restore the prior value and keep the user in context. Loading reserves final geometry. Empty, no-results, no-permission, offline, and failure are distinct states.

## Data safety

Supabase is the production source of truth. Demo mode is explicit and uses in-memory sample data only; it never writes production records or persists user content to local storage. User IDs come only from verified server sessions. Archive is preferred for routine removal. Permanent deletion uses an app-owned danger confirmation and is not exposed in the first release UI.

Financial receipts are append-only in the product UI. Payments are recorded through an authenticated, row-locking database function that updates the invoice balance in the same transaction. Cross-currency values are never silently combined. Content uploads remain private in the existing attachments bucket and are opened through short-lived signed URLs.

Today insights are derived server-side from current workspace data, filtered through category/severity preferences, deduplicated, expired, ranked, and capped at five. External-effect and financial assistant writes require explicit confirmation; assistant arguments never select a user identity.

The account disclosure is owned by `AppShell` on desktop and in the mobile navigation drawer. Sign out is pessimistic, disables duplicate activation, clears the current Supabase browser session, replaces the route with `/login`, and refreshes server-rendered state. Protected routes continue to rely on the authenticated proxy and ownership-scoped database access; account-specific records are never persisted in shared browser storage.

## Accessibility

Target WCAG 2.2 AA. Actions use semantic buttons/links, keyboard focus remains visible, every icon-only action has a name, drag operations have menu/button alternatives, motion respects reduced-motion, and touch targets are at least 44px on mobile.
