# Daily Command Center — V2 QA Ledger & Verification Matrix

## V2 Testing Progress: 50 / 50 (100% Verified)

### 1. Finance (Invoices, Payments, Expenses & Subscriptions) — PASS (5/5)
- [x] **Create, edit and find an invoice**: Schema validates title, positive amounts, currency, due date, draft/sent/partial/paid/overdue/cancelled status. Indexed in `search_workspace`.
- [x] **Record a partial payment and verify the remaining balance**: `invoiceTotals()` derives `{ total: 1150, remaining: 850, status: 'partial' }` and rejects negative/overpayments.
- [x] **Complete payment and verify the invoice becomes paid**: Atomic balance reduction via `record_invoice_payment` updates status to `paid` with `amount_remaining = 0` guarded by `invoices_paid_status_check`.
- [x] **Verify payment history is preserved; no silent payment edits**: `payments` table has direct `insert, update, delete` revoked from authenticated users. Trigger `invoices_protect_payment_fields` prevents manual modification of invoice paid amounts.
- [x] **Verify invoices and payments remain owner-private**: RLS enabled with `user_id = (select auth.uid())`; `record_invoice_payment` RPC strictly validates `auth.uid()`.

### 2. Expenses (Track Costs Correctly) — PASS (5/5)
- [x] **Track costs with canonical categories**: Validated against `Software`, `Hosting`, `Advertising`, `Design`, `Travel`, `Equipment`, `Contractors`, `Other`.
- [x] **Link expense to project, client, or subscription**: Optional UUID references supported with foreign key integrity.
- [x] **Multi-currency separation**: Default MAD, segregated by currency in `metricsByCurrency` without silent blended totals.
- [x] **Non-negative amount and required description constraints**: Enforces `amount >= 0`, trimmed description up to 1000 chars, valid ISO date.
- [x] **Owner isolation and cross-owner reference enforcement**: `expenses_owned_links` trigger guarantees that referenced projects, clients, and subscriptions belong to `auth.uid()`.

### 3. Subscriptions (Recurring Financial Commitments) — PASS (5/5)
- [x] **Lifecycle status management**: Validates `active`, `paused`, `cancelled`.
- [x] **Billing cycle validation**: Supports `monthly`, `quarterly`, `yearly`, `custom` with validated `next_billing_date`.
- [x] **Project link with foreign key protection**: `project_id` reference guarded by `subscriptions_owned_links`.
- [x] **Renewal sorting and indexing**: Sorted ascending by `next_billing_date`, indexed by `subscriptions_renewal_idx`.
- [x] **Cross-account isolation**: Owner-isolated via Row Level Security `subscriptions_owner_all`.

### 4. Content & Campaigns (Content Planning Workflow) — PASS (5/5)
- [x] **Campaign lifecycle and client attribution**: Mandatory `client_id`, lifecycle statuses `planning`, `active`, `paused`, `completed`, `archived`, and `end_date >= start_date` constraint.
- [x] **Pipeline stage transitions**: All canonical stages (`idea`, `brief`, `copy`, `designing`, `review`, `approved`, `scheduled`, `published`, `archived`) validated.
- [x] **Approval workflow and audit**: Enforces `not_required`, `pending`, `changes_requested`, `approved` with approval notes and timestamps.
- [x] **Campaign and prompt association**: References guarded by `content_owned_links` trigger.
- [x] **Content assets and private storage**: `content_assets` table for references + private `attachments` bucket for file uploads with 60s signed URLs.

### 5. Prompt Library V2 (Variables, Versions and Restoration) — PASS (5/5)
- [x] **Prompt creation with categories and ratings**: Categories (`Coding`, `Marketing`, `Design`, `Image Generation`, `Business`, `Research`, `Writing`, `Other`), 1-5 integer ratings.
- [x] **Variable extraction syntax**: Regex `\{([a-z][a-z0-9_]*)\}` via `promptVariables()` with deduplication.
- [x] **Template rendering and explicit missing variable handling**: `renderPrompt()` substitutes defined variables and explicitly reports missing variable names without breaking text.
- [x] **Version tracking and restoration**: `prompt_versions` table maintains immutable snapshots with change notes; restore endpoint creates atomic successor version.
- [x] **Linked entity ownership verification**: `prompts_owned_links` trigger guards project, client, campaign, and content item relations.

### 6. Decision Intelligence V2 (Alternatives and Decision History) — PASS (5/5)
- [x] **Decision impact, confidence, and status**: Validates impacts (`low`, `medium`, `high`, `critical`), confidences (`low`, `medium`, `high`), and statuses.
- [x] **Decision alternatives with rejection reasoning**: `decision_alternatives` table tracks rejected choices with reasons.
- [x] **Atomic superseding with row locks**: `supersede_decision` RPC locks the prior decision `FOR UPDATE`, records replacement, and marks prior decision `superseded`.
- [x] **Review states derived without mutating stored records**: `decisionReviewState()` accurately computes `overdue`, `due_soon`, `later`, and `none`.
- [x] **Owner-private RLS protection**: All decisions and alternatives are strictly owner-scoped.

### 7. Fitness (Activities and Targets) — PASS (5/5)
- [x] **Activity logging and effort validation**: Supports `Running`, `Gym`, `Walking`, `Swimming`, `Hiking`, `Cycling`, `Other` with duration, distance, calories, and effort (`easy`, `moderate`, `hard`).
- [x] **Target management**: Supports `sessions`, `distance_km`, `duration_minutes` over weekly/monthly periods.
- [x] **Target progress computation**: `targetProgress()` computes session counts vs numeric metric sums without type confusion.
- [x] **Deterministic week bounds calculation**: `weekBounds()` computes UTC start and end dates respecting configured week start day.
- [x] **External identity deduplication index**: `fitness_external_identity_idx` prevents duplicate imports per user/source/external ID.

### 8. Analytics & Insights (Trustworthy Summaries) — PASS (5/5)
- [x] **Ranking by priority and severity**: `rankInsights()` prioritizes severity and importance deterministically.
- [x] **Filters out expired insights**: Expiration timestamps respected; stale signals pruned automatically.
- [x] **Deduplication by entity**: Deduplicates by entity type/id keeping highest priority signal.
- [x] **Financial metrics separate currencies**: Revenues and expenses tracked per currency without silent blended FX conversions.
- [x] **Notification preferences filtering**: Domain category and severity thresholds filter surfaced alerts.

### 9. Project & Client Workspaces (Connected Business Context) — PASS (5/5)
- [x] **Project value and currency bounds**: Supports `value_amount >= 0`, currency, and progress bounds (0-100).
- [x] **Client structure with follow-up timestamps**: Follow-up scheduling, notes, and connected accounts.
- [x] **Focus session project attribution**: `focus_sessions` link to projects with duration tracking.
- [x] **Global workspace search indexing across 12 domains**: `search_workspace` RPC indexes tasks, projects, notes, invoices, payments, expenses, subscriptions, campaigns, content, prompts, decisions, and fitness.
- [x] **Cross-tenant reference enforcement**: `enforce_owned_references()` prevents linking foreign user entities.

### 10. V2 Security & Regression (Cross-Cutting Release Checks) — PASS (5/5)
- [x] **RLS enabled on all 11 V2 tables**: `subscriptions`, `expenses`, `campaigns`, `content_assets`, `prompt_versions`, `prompt_variables`, `decision_alternatives`, `fitness_targets`, `integration_connections`, `external_references`, `notification_preferences`, plus `payments`.
- [x] **Direct payments modification revoked**: Authenticated role has only `SELECT` on `payments`; writes strictly through RPC.
- [x] **Sensitive financial RPC security definer and user verification**: `record_invoice_payment` executes with `SECURITY DEFINER` and verifies `auth.uid()`.
- [x] **AI assistant tools confirmation requirement and user_id exclusion**: All tools omit `user_id` parameter and enforce `confirmation_required: true` for mutations.
- [x] **Effective invoice status derives overdue safely**: Computes `overdue` dynamically without modifying stored database records.
