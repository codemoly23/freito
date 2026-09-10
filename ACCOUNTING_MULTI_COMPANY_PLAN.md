# Accounting Reports + Multi-Company + Multi-Currency — Phased Plan

## Context

The client (Team Logistics Limited style freight-forwarding business) runs their real bookkeeping in a separate accounting system (Tally-like) and gave three sample exports — **Trial Balance (Ledger Wise)**, **Profit & Loss Statement**, and **Balance Sheet** — as the target format for a new "Reports" section inside Freito. Freito today only tracks freight-job operational data (invoices, vendor bills, payments, shipment cost items) scoped to a single company per user; it has no chart-of-accounts/journal/ledger concept at all, no per-company base currency, and no way for one user to view more than one company's data.

The business also runs ~10 legal entities across Bangladesh, Dubai, and China under one owner, and wants:
1. These 3 statements shown for each company, correct and consistent with each other (Trial Balance's totals feed P&L, and P&L's net profit rolls into Balance Sheet — exactly as the sample files demonstrate).
2. Company creation to remain in the existing Platform admin console (no new self-service company creation UI).
3. A small set of senior roles (client described as "Super Admin/Admin/Manager") able to **view-only/audit** switch into sibling companies in other countries — never able to write/edit another company's operational data.
4. Multi-currency: each company shows amounts in its own local currency + USD normally; when an HQ user is auditing a company from Bangladesh, the report shows **three** currencies at once — BDT + that company's local currency + USD.

Because the sample reports include ledger categories Freito has no data for today (Capital Account, Bank Accounts, Cash, Fixed Assets, Investments/FDR, Loans, Provisions, Reserves & Surplus, and all "Indirect" income/expense like rent/salary/utilities), producing these reports correctly requires building a real (if minimal) general-ledger engine — a Chart of Accounts + double-entry Journal Entries — not just a new report page over existing tables. Only the "Direct Income/Expense" (freight job profit) portion is derivable from what Freito already tracks; everything else needs new posting logic and, for pre-existing accounts, a manual voucher-entry UI.

This plan was validated against the actual codebase (file paths, line numbers, and existing patterns confirmed via two research passes and one adversarial design review) before being finalized. It is intentionally phased so each phase is independently reviewable and shippable.

## Key design decisions (locked in)

- **Company creation/edit stays in `app/(platform)/platform/companies` + `lib/actions/platform.ts::savePlatformCompany`** — only new fields (`baseCurrency`, `country`) are added there; no new Settings-level company UI.
- **Chart of Accounts is per-company** (`ledgergroup`/`ledgeraccount` both carry `companyId`), matching every other financial model in this schema (nothing today is shared cross-tenant). Group-level fields (`name`, `natureType`, `isDirect`) are locked from user edits (`isSystemManaged`) so the 17 canonical group names stay stable across all companies — this is required for the cross-company audit view to group consistently.
- **View-only switching is enforced structurally, not by hiding UI.** All existing write actions (`lib/actions/billing.ts` etc.) keep using `getScopedCompanyId` (home `companyId`) untouched. A brand-new `getAuditScopedCompanyId` helper — used **only** by the 3 new accounting-report fetchers — is the only code path that ever reads a switched company, and it **re-validates permission + grant + target-company status on every call** (never blindly trusts the JWT claim).
- **Each journal entry posts in a single base currency** with balance checked on exact native amounts (no cross-currency rounding drift); genuine FX differences post as an auto-generated "Foreign Exchange Gain/Loss" line (that ledger group already exists in the required taxonomy) rather than being silently rejected or left unbalanced.
- **Posting is idempotent**: `journalentry` carries a `(sourceType, sourceId, voucherType)` unique constraint so approval-flow retries can't double-post.
- **A lightweight period lock** prevents back-dated/edited journal entries from silently drifting a previously-reported Trial Balance.
- **Backfill and exchange-rate maintenance ownership are open decisions for the client** — flagged, not silently assumed (see "Decisions needed" at the end).

---

## Phase 1 — Chart of Accounts schema + seeding (single company, single currency)

**New Prisma models** (`prisma/schema.prisma`), following this schema's existing convention (per-model enums like `invoice_currency`, `Decimal` amounts, `deletedAt` soft-delete, `companyId`-scoped):

- `ledgergroup`: `id, companyId, name, natureType enum(ASSET|LIABILITY|EQUITY|INCOME|EXPENSE), normalBalance enum(DEBIT|CREDIT), isDirect Boolean, isSystemManaged Boolean, sortOrder Int`.
- `ledgeraccount`: `id, companyId, ledgerGroupId, name, linkedCustomerId?, linkedVendorId?, openingBalance Decimal, openingBalanceSide enum(DEBIT|CREDIT), isSystemManaged Boolean, deletedAt`.
- `journalentry`: `id, companyId, entryDate, voucherType enum(SALES|PURCHASE|RECEIPT|PAYMENT|CONTRA|JOURNAL), narration, sourceType?, sourceId?, createdById, reversedByEntryId? (self-relation), locked Boolean @default(false)`. Add `@@unique([sourceType, sourceId, voucherType])` (nullable-safe, only enforced when `sourceType`/`sourceId` are set) for posting idempotency.
- `journalentryline`: `id, journalEntryId, ledgerAccountId, side enum(DEBIT|CREDIT), nativeAmount Decimal, nativeCurrency enum (own `journalentryline_nativeCurrency`, same BDT/USD/EUR/GBP/CNY/INR/AED/RUB/OTHER value set), rateToUSD Decimal, rateToBDT Decimal, amountUSD Decimal, amountBDT Decimal`.
- Company-level period lock: add `booksLockedThrough DateTime?` to `company`.

**Seeding**: `lib/accounting/seed-chart-of-accounts.ts::seedDefaultChartOfAccounts(companyId)` creates the 17 canonical `ledgergroup` rows (Capital Account, Current Assets, Current Liabilities, Direct Income, Direct Expenses, Indirect Income, Indirect Expenses, Fixed Assets, Loans (Liabilities), Bank Accounts, Cash-in-Hand, Investments, Provisions, Reserves & Surplus, Accounts Receivable-Sundry Debtors, Accounts Payable-Sundry Creditors, Foreign Exchange Gain/Loss), all `isSystemManaged: true`. Called once per company (hook into `savePlatformCompany`'s create path, or a manual "Initialize Accounting" platform action for the ~10 existing companies).

**Auto-linked ledgers**: when a `customer`/`vendor` is created, auto-create a matching `ledgeraccount` under Sundry-Debtors/Sundry-Creditors (hook in existing `lib/actions/*` customer/vendor create actions — locate via `Explore` at implementation time, not yet inspected in research).

---

## Phase 2 — Journal posting engine (auto + manual), reversal, and correctness guards

**Shared posting helper**: `lib/accounting/posting.ts::postJournalEntry(tx, {companyId, entryDate, voucherType, narration, sourceType, sourceId, lines})`:
- Validates the request is not a duplicate via the `(sourceType, sourceId, voucherType)` unique constraint (upsert/no-op on conflict for idempotency).
- Rejects if `company.booksLockedThrough` is set and `entryDate <= booksLockedThrough`.
- Requires all `lines` share one `nativeCurrency` (the entry's base currency); balances debit-vs-credit sums on exact native amounts. If a caller needs a cross-currency settlement (e.g., foreign-currency vendor bill paid from a local-currency bank), that's modeled as **two single-currency entries linked by `sourceId`** plus an auto-computed FX-gain/loss line into the existing "Foreign Exchange Gain/Loss" ledger — not a mixed-currency single entry.
- Writes `journalentry` + `journalentryline` rows inside the **caller's existing `tx`** (atomic with the triggering business event).

**Reversal helper**: `lib/accounting/posting.ts::reverseJournalEntry(tx, journalEntryId)` — writes a mirrored entry, sets `reversedByEntryId`.

**Hook points, all in `lib/actions/billing.ts`** (confirmed exact locations):
- `updateInvoiceStatus`, `SENT` branch (~427-435): post Debit [Customer's Sundry-Debtor ledger] / Credit [Direct-Income ledger matching the invoice's job/category] for the invoice's stored `currency`/`exchangeRateToBDT` (read as-is, no fresh rate lookup). Post discount/tax as their own lines if the invoice carries non-zero `discountAmount`/`taxAmount` (separate "Sales Discount" / "Tax Payable" ledgers) rather than folding into the Income line.
- `updateVendorBillStatus`, `RECEIVED` branch — **both** the direct path (~695-702) **and** `applyApprovedVendorBillReceipt` (~1200-1229): post Debit [Direct-Expense ledger] / Credit [Vendor's Sundry-Creditor ledger].
- `applyPaymentFinancialEffectTx` (~746-828, the single function both `createPayment`'s immediate-clear path and `applyApprovedPayment`'s post-approval path funnel through): post Bank/Cash ledger (by `paymentMethod`) against the Customer/Vendor ledger, direction-dependent.
- `deleteInvoice` (~485-501) and `deleteVendorBill` (~722-736): **new hook, not just deletePayment** — both can soft-delete a `SENT`/`RECEIVED` document with zero payments (neither checks `status`, only `paidAmount === 0`), so both need a `reverseJournalEntry` call keyed by `sourceType/sourceId`.
- `deletePayment` (~1103-1191): replace the existing inline reversal arithmetic's financial-effect duplication with a call to `reverseJournalEntry`, alongside the existing due/paid-amount reversal.
- `saveInvoice`/`saveVendorBill` edits on an already-`SENT`/`RECEIVED` document (allowed today — only `PAID`/`CANCELLED` block edits): on save, if the document was already journaled, **reverse the prior entry and re-post fresh** from the updated totals, inside the same save transaction. This is the single biggest correctness gap flagged in review — without it, a post-SENT edit desyncs the ledger from the invoice silently.

**Manual Journal Voucher UI** (for everything with no existing Freito source: bank deposits/withdrawals, capital, fixed assets, salary, loans, provisions, reserves, indirect/overhead expenses):
- `app/(dashboard)/dashboard/accounting/journal-vouchers/page.tsx` + `new/page.tsx` — date, voucher type, narration, N debit/credit lines (ledger picker + amount), client-side balance validation before submit.
- `lib/actions/accounting.ts::saveJournalVoucher` — new local `requireAccounting(permission)` wrapper composing `getScopedCompanyId` (reuse existing `accountsManage` permission key) the same way `billing.ts` composes `requireBilling`; opens its own `Serializable`-isolation `prisma.$transaction` (no caller transaction to inherit here, unlike the auto-post hooks) and calls `postJournalEntry`.
- `app/(dashboard)/dashboard/accounting/ledgers/page.tsx` — CRUD for `ledgeraccount` rows (not `ledgergroup`, which stays system-managed), same list/form pattern as `dashboard/branches`.

---

## Phase 3 — Reports UI: Trial Balance, P&L, Balance Sheet (single company, single currency)

- New permission key `reportsAccounting` (raw `"reports:accounting"`) added to `lib/permissions/rbac.ts`'s `permissions` object; new `ReportSection` value `"accounting"` added to `lib/reports/access.ts`'s `canAccessReportSection` matrix, gated by this key. Decide explicitly (see "Decisions needed") whether this key goes into `companySafePermissions` (company-admin self-grantable) or is seed-only like `companies:switch`.
- `lib/reports/trial-balance.ts::getTrialBalanceSummary(companyId, dateRange)`, `lib/reports/profit-loss.ts::getProfitLossSummary(...)`, `lib/reports/balance-sheet.ts::getBalanceSheetSummary(...)` — each self-guards via `requireReportsPage("accounting")` (mirroring `lib/reports/finance-summary.ts::getFinanceProfitSummary`'s exact pattern), sums `journalentryline` joined through `ledgeraccount`→`ledgergroup`, grouped by group with per-account rows.
  - Trial Balance: every ledger's net debit/credit balance for the period, grouped under its `ledgergroup`, grand-total consistency check (total debit === total credit) surfaced in the UI.
  - P&L: `ledgergroup.natureType IN (INCOME, EXPENSE)`, split by `isDirect` into Direct/Indirect sub-totals, Gross Profit and Net Profit computed exactly as the sample (Direct Income − Direct Expense = Gross; Gross − Indirect Expense + Indirect Income = Net).
  - Balance Sheet: `natureType IN (ASSET, LIABILITY, EQUITY)`, two-column layout (Assets | Liabilities, matching the sample), injects the computed Net Profit as a synthetic "Profit & Loss A/c" line so both sides balance.
- New pages `app/(dashboard)/dashboard/reports/accounting/{trial-balance,profit-loss,balance-sheet}/page.tsx` reusing `ReportHeader`/`ReportFilters`/`ReportTable` from `components/reports/report-ui.tsx`, laid out to visually match the sample PDFs (grouped headers, indented rows, sub-totals, grand total, "Duration: … Print Date: …" header block).
- CSV export: register new entries (`journal-entries`, `trial-balance`, etc.) in `lib/exports/export-entities.ts` — no route changes needed (`app/api/exports/[entity]/route.ts` is a generic dispatcher).

---

## Phase 4 — Multi-currency

- Add to `company`: `baseCurrency` (new `company_baseCurrency` enum, same 9-value set) and `country String?`.
- New `exchangerate` model: `id, currency enum(exchangerate_currency, same value set), rateToUSD Decimal, effectiveDate DateTime`. BDT itself needs its own row (rate-to-USD) so audit-mode BDT triangulation works for non-BDT-base companies. Document at insert time which rate is authoritative to avoid ambiguity. Small admin page under Platform to maintain rates (ownership is a client decision, see below).
- At journal-posting time, `rateToUSD`/`rateToBDT`/`amountUSD`/`amountBDT` are looked up from the nearest `exchangerate.effectiveDate` and **snapshotted** onto `journalentryline` (never recomputed retroactively — matches the existing `exchangeRateToBDT` convention already used on `invoice`/`payment`).
- Report display, normal view: 2 computed columns per ledger row — `company.baseCurrency` (native) and USD (from snapshotted `amountUSD`).

---

## Phase 5 — Multi-company switching (view-only, RBAC-gated) + 3-currency audit view

- New join table `usercompanyaccess` (`userId, companyId, isDefault`, `@@unique([userId, companyId])`) — mirrors the existing `userbranchmembership` pattern exactly. Rows record which sibling companies (beyond the user's home `companyId`) a user may switch into.
- New permission key `companiesSwitch` (raw `"companies:switch"`), added to `rbac.ts`'s `permissions`. **Deliberately excluded from `companySafePermissions`** in `lib/actions/roles.ts` so it can only be seeded/granted by a platform-level action, never self-granted by a company admin. Seed it onto the company's `COMPANY_ADMIN` and `OPERATIONS_MANAGER` roles (mapping the client's "Super Admin/Admin/Manager" language onto this schema's actual `role_code`s — there is no generic "Manager" role today, confirm with client whether `ACCOUNTS_OFFICER` should also get it for finance-only audit access).
- **Required fix to `lib/actions/roles.ts::updateRolePermissions`** (not just hiding the checkbox): it currently does `rolepermission: { deleteMany: {}, create: [...] }` — a full wipe-and-rewrite from the submitted form. Since `companies:switch` (and any future seed-only key) is never in the form's assignable list, the next time a company admin saves *any* role permission change through the normal UI, this would silently strip the seed-only grant. Fix: the `create` list must be `parsed.data.permissionIds` **union** any existing `rolepermission` rows whose `permission.key` is not in `companySafePermissions` (preserve seed-only grants across ordinary saves).
- **Required fix to `app/(dashboard)/dashboard/roles/page.tsx`**: its permission-list query (`key: { not: { startsWith: "platform:" } }`) must also exclude an explicit seed-only key list (including `companies:switch`) so it never renders as a checkbox a company admin could toggle (which would otherwise error/no-op confusingly on save).
- Session: add `activeCompanyId` (nullable) to `types/auth.ts`'s `JWT`/`User`/`Session.user`. Initialize at login (`= companyId`). New action `lib/actions/company-switch.ts::switchActiveCompany(targetCompanyId)` validates permission + (`targetCompanyId === companyId` OR a `usercompanyaccess` row exists) server-side, then the client calls `useSession().update({ activeCompanyId: targetCompanyId })`. Extend (don't replace) `lib/auth/config.ts`'s existing `jwt` callback `trigger === "update"` branch to also persist the incoming `activeCompanyId`.
- **Critical, must-implement-this-way**: `lib/access/audit-scope.ts::getAuditScopedCompanyId(permission)` — used **only** by the Phase 3 accounting-report fetchers — reads `session.user.activeCompanyId` but treats it as a hint, not a trust boundary: on every call it re-checks (a) the caller still holds `companiesSwitch`, (b) a live `usercompanyaccess` row still exists (or it's the home company), (c) the target company's `status`/module access (`requireModuleAccess(targetCompanyId, "REPORTS")`) evaluated **against the target company**, not the caller's home company. Falls back to home `companyId` on any failure. This closes the "JWT claim went stale after a revoked grant" gap identified in review, and is what makes "view-only" a structural guarantee rather than a UI convention — every other action in the app (`billing.ts`, shipments, quotations, …) keeps calling the untouched `getScopedCompanyId`, which never reads `activeCompanyId`.
- UI: a persistent "Viewing: `<Company>` (audit mode)" banner whenever `activeCompanyId !== companyId`, shown only on the pages that actually honor the switch (the 3 new accounting reports) — explicitly **not** on the rest of the Reports section or anywhere else, to avoid the scope-leak confusion flagged in review (a user could otherwise think switching changed what Operations/Shipments reports show, when it doesn't).
- Report currency display, audit mode: 3 columns — BDT, target company's `baseCurrency`, USD (using the same snapshotted `amountBDT`/`amountUSD`/native fields from Phase 4).

---

## Phase 6 — Backfill & historical data migration

- One-time script (`scripts/` or a `prisma/` seed-style script) to import each company's opening balances (from their existing accounting software's export, e.g. the sample Trial Balance) as `ledgeraccount.openingBalance`/`openingBalanceSide`.
- **Decision needed with client** (see below): whether historical `invoice`/`vendorbill`/`payment` rows already in Freito (pre-dating this feature) get retroactively journaled, or whether the new reports only reflect activity from go-live forward with prior history captured only as opening balances. Retroactive backfill is a materially larger, riskier effort (must reconstruct every historical status transition's journal entry) than opening-balance-only.

---

## Phase 7 — QA / Verification

1. **Control totals**: for a seeded test company, post a representative set of invoices/bills/payments/manual vouchers and confirm Trial Balance's grand total debit === credit, P&L's net profit matches the value injected into Balance Sheet's "Profit & Loss A/c" line, and Balance Sheet's two sides balance — mirroring the exact cross-report consistency visible in the client's 3 sample files.
2. **RBAC**: a user without `companiesSwitch` never sees the switcher UI and `switchActiveCompany`/`getAuditScopedCompanyId` reject them server-side even if called directly. A user with `companiesSwitch` can read but never write another company's data (attempt a billing action while `activeCompanyId` is switched — must still operate on the home company, proving the structural separation).
3. **Roles-page regression test**: confirm saving an unrelated permission change via `/dashboard/roles` does not strip a seed-only `companies:switch` grant from a role that has it.
4. **Currency**: verify a Dubai company's report shows AED+USD normally and BDT+AED+USD in audit mode, with amounts matching hand-computed conversions from the seeded `exchangerate` rows.
5. **Idempotency**: trigger an approval-flow retry path and confirm no duplicate journal entry is created (unique constraint holds).
6. Run existing test suite (`tests/e2e/`) to confirm no regression to existing cross-company isolation tests (e.g. `18-task-management.spec.ts`'s "Cross-company task access is denied").

---

## Decisions needed from the client before/at kickoff

1. **Backfill scope** (Phase 6): retroactively journal all historical invoices/bills/payments, or opening-balance-only from go-live?
2. **Exchange-rate maintenance ownership**: who updates the `exchangerate` table over time, and how often (daily/monthly/manual)?
3. **`reportsAccounting` permission**: should company admins be able to self-grant this to their own staff (add to `companySafePermissions`), or should it also be seed-only like `companiesSwitch`?
4. **Role mapping**: confirm `companiesSwitch` should be seeded onto `COMPANY_ADMIN` + `OPERATIONS_MANAGER` (and optionally `ACCOUNTS_OFFICER`) — there is no generic "Super Admin"/"Manager" role in the current schema, so the client's language needs to map onto these existing `role_code`s.
5. **Discount/Tax ledger treatment**: should P&L's Direct Income be gross or net of discounts (separate "Sales Discount" ledger vs. folded into Income)?

## Critical files (for implementation reference)

- `prisma/schema.prisma` — new models/enums/fields
- `lib/actions/billing.ts` — all posting hook points
- `lib/actions/helpers.ts` — `getScopedCompanyId` pattern to mirror
- `lib/actions/roles.ts` — `companySafePermissions`, `updateRolePermissions` fix
- `app/(dashboard)/dashboard/roles/page.tsx` — permission-list query fix
- `lib/auth/config.ts`, `types/auth.ts` — `activeCompanyId` session claim
- `lib/access/company-access.ts`, `lib/access/branch-access.ts` — patterns for new `lib/access/audit-scope.ts`
- `lib/reports/access.ts`, `lib/reports/finance-summary.ts`, `components/reports/report-ui.tsx` — reports pattern to mirror
- `lib/actions/platform.ts`, `components/forms/platform-forms.tsx` — company field additions
- `lib/exports/export-entities.ts` — new export entries
