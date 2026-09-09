# FreightFast — Production Readiness Audit

Full end-to-end code audit performed 2026-09-09 ahead of CodeCanyon submission, covering functionality, authentication, authorization, validation, security, database, performance, UI/UX, and build/deployment. Every finding below is backed by direct code citation (file:line), verified by independent code review — not generic checklist advice.

**Legend:** 🔴 Critical (fix before launch) · 🟠 High · 🟡 Medium · ⚪ Low

---

## 🔴 Critical

1. ~~Zero error boundaries anywhere in the app.~~ **FIXED.** Added `app/error.tsx`, `app/not-found.tsx`, `app/global-error.tsx` (root layout catastrophic-failure fallback), plus scoped `error.tsx`/`not-found.tsx` for `(dashboard)`, `(platform)`, and `(portal)` — each preserves that section's chrome/home link and uses shared `components/error-state.tsx` / `components/not-found-state.tsx` for a consistent branded fallback instead of Next's default unstyled page. Verified with a clean `npm run build`.

2. **Default super-admin credentials ship via seed with no production guard.** [prisma/seed.ts:872-877](prisma/seed.ts#L872-L877) falls back to password `"Admin123"` for the platform super-admin if `SEED_ADMIN_PASSWORD` isn't set. No `NODE_ENV==="production"` check exists anywhere in the seed script, and README instructs buyers to re-run seed on upgrades.
   - _Fix:_ require `SEED_ADMIN_PASSWORD` to be set (fail loudly if missing in production), and never let a re-seed silently overwrite an existing password (see #9).

3. **Password reset doesn't revoke the session — stolen cookie survives up to 30 days.** Sessions use JWT strategy ([lib/auth/config.ts:60-62](lib/auth/config.ts#L60-L62)) with no `maxAge`/rotation. The reset-confirm route deletes DB `session` rows ([app/api/auth/password-reset/confirm/route.ts:53-55](app/api/auth/password-reset/confirm/route.ts#L53-L55)) which is irrelevant under JWT — the previously issued signed cookie stays fully valid. There is no server-side revocation mechanism (no jti blocklist, no token-vs-`updatedAt` check).
   - _Fix:_ add a `jwt` callback check comparing token-issued-at against `user.passwordChangedAt`; reject stale tokens.

4. **Document-Compliance report: unbounded N+1 query.** [app/(dashboard)/dashboard/reports/document-compliance/page.tsx:12-25](<app/(dashboard)/dashboard/reports/document-compliance/page.tsx#L12-L25>) loads ALL shipments with no `take` limit, then fires 2+ extra queries per shipment via `Promise.all`. A company with a few thousand shipments turns one page load into thousands of sequential DB round-trips.
   - _Fix:_ paginate, or drop this report until rebuilt — it's already flagged in FEATURE_LIST.md as unfinished/unlinked from nav.

5. **README documents the wrong database (Postgres syntax) for a MariaDB-only app.** [README.md:61](README.md#L61) shows `DATABASE_URL="postgresql://..."` but the app only supports MySQL/MariaDB ([prisma/seed.ts](prisma/seed.ts) uses `PrismaMariaDb` adapter, `.env.example` uses `mysql://`). A buyer following the README literally cannot connect to the database on first setup.
   - _Fix:_ correct the README's connection string example immediately — this is a day-one blocker for every buyer.

6. **README's documented login credentials don't match what seed.ts creates.** README lists `admin@freito.com` / `Admin@123456` etc.; actual seed creates `admin@freightcontrol.com` with password `Admin123` (or env overrides). A buyer following the docs cannot log in at all.
   - _Fix:_ sync README credentials section with actual seed output, or better, source both from the same env-var table.

---

## 🟠 High

7. **No rate limiting anywhere** — login, password-reset request, client-portal login, and the AI assistant endpoint all have zero throttle/lockout. [app/api/auth/login-scope-check/route.ts:14-61](app/api/auth/login-scope-check/route.ts#L14-L61) is an unauthenticated password-verification oracle with no delay — a clean brute-force target.
   - _Fix:_ add IP/account-based rate limiting (e.g. a small in-memory or Redis-backed limiter) on login, password-reset, and AI endpoints.

8. **Platform Admin sidebar has no mobile navigation at all.** [components/platform-sidebar.tsx](components/platform-sidebar.tsx) is `hidden ... lg:block` with no mobile-open state; the hamburger button dispatches an event only `app-sidebar.tsx` listens for. On any screen <1024px, the Platform Console has no way to open navigation — a functional break, not cosmetic.
   - _Fix:_ port the same mobile-toggle logic from `app-sidebar.tsx` into `platform-sidebar.tsx`.

9. **Re-running the documented seed command silently resets admin passwords.** [prisma/seed.ts:878-926](prisma/seed.ts#L878-L926) unconditionally overwrites `passwordHash` on every `upsert`. README explicitly tells buyers to re-run seed on certain upgrades — any rotated admin password reverts to the (often still-default) seed value with zero warning.
   - _Fix:_ only set `passwordHash` on `create`, never on `update`, in the seed upsert.

10. **Several env vars used in code are missing from `.env.example`:** `ADMIN_APP_HOST`, `COMPANY_APP_HOST`, `PORTAL_APP_HOST`, `PORTAL_APP_URL`, `CLIENT_PORTAL_EMAIL_WEBHOOK_URL`, `CLIENT_PORTAL_WHATSAPP_WEBHOOK_URL`, `SEED_PLATFORM_EMAIL`, `SEED_COMPANY_ADMIN_EMAIL`, `SEED_CLIENT_PASSWORD`. Buyers hit silent misbehavior (wrong subdomain routing, silently no-op notification channel) with no documentation these exist.
    - _Fix:_ add all of these to `.env.example` with comments.

11. **Migration deploy strategy relies on `prisma db push`, not `migrate deploy`.** README instructs `npx prisma db push` for install/upgrade. This bypasses migration history and can silently drop/alter columns on schema drift — already caused a broken migration history in this project's own dev DB (documented in `IMPLEMENTATION_PLAN.md:103`).
    - _Fix:_ switch documented/deploy flow to `npx prisma migrate deploy`.

12. **Shipments list table clips content instead of scrolling on narrow viewports.** [app/(dashboard)/dashboard/shipments/page.tsx:239](<app/(dashboard)/dashboard/shipments/page.tsx#L239>) uses `overflow-hidden` where every other list page correctly uses `overflow-x-auto` — data becomes invisible on mobile with no way to reach it.
    - _Fix:_ change to `overflow-x-auto` to match customers/invoices pages.

13. **Only one `loading.tsx` exists in the entire app** (shipments list). Every other data-fetching page (customers, invoices, reports, tasks, quotations, dashboard...) has no Suspense fallback — users see a blank flash while server components resolve.
    - _Fix:_ add `loading.tsx` skeletons to the highest-traffic pages at minimum (dashboard, shipments, invoices, customers).

14. **53 of 75 form submit buttons have no pending/disabled state**, risking accidental double-submits (e.g. duplicate invoices/payments). The quotation form's own copy literally tells users to "save once" instead of the UI preventing it.
    - _Fix:_ wire `disabled={isPending}` from `useActionState` across all mutating forms.

15. **Document upload path has unguarded Azure Blob writes.** `blobPut(...)` calls in [lib/actions/documents.ts:121](lib/actions/documents.ts#L121), [portal-documents.ts:61](lib/actions/portal-documents.ts#L61), [imports.ts:183](lib/actions/imports.ts#L183) have no try/catch, and `blobPut` itself doesn't either — combined with #1 (no error boundaries), a transient Azure outage on the primary upload flow (used by staff and customers) produces a blank error page instead of "please retry."
    - _Fix:_ wrap `blobPut` calls with a try/catch that surfaces a friendly form error.

---

## 🟡 Medium

16. **File uploads trust the client-supplied MIME type with no magic-byte verification.** Extension/MIME allowlisting and filename sanitization are solid, but nothing checks actual file content server-side. Mitigated for documents (served with `Content-Disposition: attachment`) but logos are served inline.
    - _Fix:_ add a lightweight magic-byte check (e.g. `file-type` package) before storing.

17. **A hardcoded demo password button is live on the real client-portal login page**, not gated behind any demo-mode flag. [components/forms/client-portal-login-form.tsx:97-98](components/forms/client-portal-login-form.tsx#L97-L98) advertises a guessable credential to any visitor if the seeded demo account exists in a live deployment.
    - _Fix:_ gate the autofill button behind a `DEMO_MODE` env flag, off by default.

18. **No upper bound on financial input amounts** — quantity, rates, discounts, tax accept arbitrarily large numbers (e.g. `1e300`). Negative/NaN/invalid-currency are correctly rejected.
    - _Fix:_ add a sane `.max()` to `lib/validators/finance.ts` / `billing.ts` decimal schemas.

19. **Approval decision and its financial effect run in two separate transactions.** If the process dies between them, an approval can show "approved" while the linked payment/vendor-bill stays stuck at `PENDING` with no automatic retry.
    - _Fix:_ merge into a single transaction, or add a reconciliation job that detects and repairs this state.

20. **Company-level cascade deletes span 40+ tables.** A direct `prisma.company.delete()` (never called by the app itself, which only soft-deletes) would irreversibly wipe a tenant's entire dataset in one shot if ever invoked by a future admin tool or script.
    - _Fix:_ change `company` relations to `onDelete: Restrict` to match the safer pattern already used for branch-level FKs.

21. **No pagination past a hard cap on Invoices (`take: 100`), Notifications (`take: 100`), and Platform Audit Log (`take: 50`)** — once a tenant exceeds the cap, older records become permanently inaccessible through the UI. Shipments list already does this correctly with real pagination.
    - _Fix:_ reuse the shipments list's `take`/`skip` + page-count pattern.

22. **No caching anywhere** for expensive per-request aggregates (health score, exception radar, financial report insights) — every dashboard/report load fully recomputes from scratch. Fine at small scale, will show up as latency at real tenant volume.
    - _Fix:_ add `unstable_cache`/`revalidate` on the heaviest aggregate computations.

23. **`npm run lint` fails** — 35 errors / 28 warnings, including real `any` usages and React effect-dependency issues, undermining the "production-ready" claim.
    - _Fix:_ run a lint-fix pass before shipping; at minimum resolve the errors (warnings are lower priority).

24. **Internal CI/deploy workflows with seller-only secrets are shipped in the repo.** `.github/workflows/deploy.yml` references `FREITO_VPS_SSH_KEY` and a hardcoded seller server path; `azure-deploy.yml` targets a non-existent `master` branch.
    - _Fix:_ strip both from the CodeCanyon distribution zip (keep them only in your private dev repo).

25. **Minor accessibility gaps** — 15 of 16 icon-only buttons have no `aria-label`; empty states are functional but minimal (no icon/CTA).
    - _Fix:_ low priority, but cheap to fix — add `aria-label` to icon buttons.

---

## ⚪ Low

26. A redirect-path typo (`"\platform-login"` — backslash, not slash) in [lib/permissions/rbac.ts:187,191](lib/permissions/rbac.ts#L187) still denies access correctly but produces a malformed relative redirect.
27. Cookie `secure` flag isn't explicitly set — depends on NextAuth's auto-detection off `NEXTAUTH_URL`; a production deploy accidentally left on `http://` would silently ship non-secure cookies.
28. Two offline dev-only maintenance scripts (`prisma/clean-db.ts`, `scripts/clean-except-one-shipment.ts`) build raw SQL via string interpolation — not attacker-reachable (CLI-only, dev tooling), but worth converting to parameterized queries.
29. Branding/naming is inconsistent across the repo ("FreightFast" vs "Freito" vs `freito.com`/`freightcontrol.com`) — cosmetic, but worth a pass before resale.
30. One non-theme-remapped badge color (`bg-gray-100` on an EXPIRED document status chip) will render as light-gray regardless of dark mode.
31. Diagnostic "test connection" actions (SMTP/WhatsApp/AI) echo raw error messages to admin-only UI — intentional and low-risk, but confirm provider SDK errors never leak more than the admin already configured.

---

## ✅ Confirmed Solid (no action needed)

- **Authorization / IDOR** — 30+ server actions and API routes spot-checked across every domain (shipments, documents, invoices, vendor bills, payments, quotations, tasks, customers, vendors, approvals, notifications, client portal). Every mutation/read is company-and-branch-scoped; no cross-tenant data leak found, including the highest-risk client-portal surface.
- **XSS** — all `dangerouslySetInnerHTML` uses are static, developer-authored strings; nothing dynamic/user-controlled is ever injected as HTML.
- **CSRF** — all API routes require a session check; server actions get Next's built-in same-origin protection; cron routes require a timing-safe secret comparison.
- **Secrets at rest** — WhatsApp/SMTP/AI provider credentials are AES-256-GCM encrypted, fail-closed if the encryption key is unset. No hardcoded keys/secrets found in source; `.env` is properly gitignored and was never committed.
- **Password hashing** — bcrypt, cost factor 12.
- **Password reset & portal activation tokens** — `crypto.randomBytes(32)`, SHA-256 hashed at rest, short TTL, single-use, no email-enumeration leak in responses.
- **Database indexing** — thorough `@@index` coverage on all high-traffic tables (companyId/branchId/status/createdAt).
- **Prisma connection pooling** — correct singleton pattern for serverless/dev.
- **Input validation discipline** — consistent zod `safeParse` before nearly every DB write across finance, billing, tasks, customers, documents, imports.
- **CSV import/export pipeline** — proper size/row caps, MIME checks, per-row validation, re-validated at commit (not trusting the preview snapshot).
- **Print CSS** — a real `@media print` block correctly hides dashboard chrome for all print views.
- **Dark mode architecture** — a single CSS-variable remap strategy handles theming app-wide, rather than requiring per-component `dark:` classes (explains why it's mostly consistent with minimal explicit dark-mode code).

---

## Suggested fix order before CodeCanyon submission

1. Fix the 6 Critical items — especially #5/#6 (README) and #2/#9 (seed password) since these block or compromise every single buyer's first setup.
2. Fix #7 (rate limiting), #8 (platform mobile nav), #11 (migration strategy), #12 (shipments table overflow) — these are High severity and cheap to fix.
3. Sweep #13/#14 (loading states, submit-button guards) — moderate effort, meaningfully improves perceived polish for reviewers.
4. Address Medium items opportunistically; Low items are cosmetic and can wait.
