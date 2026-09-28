# USD reporting and MAD entry

USD is the reporting currency and default for new money records. Entry forms accept USD or MAD. MAD requests are converted on the server before existing validation, financial calculations, and transactional RPCs. All amounts are rounded to two decimal places. USD amounts are never converted again.

Rates: Frankfurter v2 MAD/USD. Use payment/expense/transaction/issue/valuation/snapshot date, otherwise today. Future planned dates use today's available rate. The returned publication date is retained explicitly, including when the provider returns an earlier date. No fixed-rate or stale fallback is used after provider failure; saving fails safely with entries retained in the form.

Audit receipts preserve submitted amounts, requested date, publication date, rate, converted monetary fields, route, and save result. Owner-scoped RLS applies. Original amounts/rates cannot be updated or deleted by the client role; only state/result are updatable. Conversion receipts are written before persistence, so rejected submissions are distinguished from saved records.

Nonmonetary fields (quantity, hours, percentages, activity goals, lead counts, experiment metrics) do not convert. Nested proposal/purchase/order line prices inherit their parent currency. A nested explicit USD currency overrides MAD inheritance.

Existing workspace MAD records were reviewed: one zero-value invoice and four records with unset monetary values. Their ISO currency was updated with a full original-record audit; no positive balances were relabeled. The temporary 1,000 MAD expense verified 104.16 USD on 2026-09-27 and was subsequently soft archived.

Verification: 913 unit tests passed, TypeScript and targeted ESLint passed, browser save plus database receipt checked, historical rate preview checked, production build passed after clearing reproducible Next.js cache. Provider reference: https://frankfurter.dev/
