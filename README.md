# FreightFast - Freight Forwarding & Logistics ERP Platform

**FreightFast** is an enterprise-grade, multi-company Freight Forwarding ERP platform designed to streamline freight forwarding operations, customer inquiries, quotations, shipping job files, document compliance, PDF generators, finance closeouts, and client communication.

---

## AI-Powered Features

FreightFast layers a full AI assistant suite on top of the core ERP, gated behind a platform kill-switch, a per-company toggle, and a daily request cap — off by default, and every AI-driven feature routes through the same permission and quota gate.

- **AI Shipment Assistant:** Chat-style Q&A over a shipment's status, tasks, and open issues.
- **AI Document Reader:** Extracts shipment and document fields from an uploaded file.
- **AI Document Checker:** Flags missing, incorrect, or inconsistent fields on a freight document.
- **AI Document Cross-Check:** Compares multiple documents on a shipment and flags mismatches.
- **AI Quotation Generator:** Drafts charge lines from customer, shipment, and pricing context.
- **AI Email Generator:** Drafts a customer-ready email from shipment and operational context.
- **AI Shipment Summary:** Turns a full job file into a short operational summary.
- **AI Report Insights:** Explains notable trends and changes on financial reports.
- **AI Smart Search:** Natural-language mode for the global search box.
- **AI Customer Insights:** Summarizes a customer's history, activity, and opportunities.
- **AI Delay Alerts:** Flags shipments at risk of delay from ETA and workflow data.
- **AI Profit Analysis:** Highlights low-margin shipments against historical averages.
- **AI Task Suggestions:** Recommends next actions from open exceptions and pending work.
- **AI Shipment Health Score:** Scores a shipment from status, milestones, documents, and conditions.
- **AI Exception Radar:** Surfaces shipments, documents, or workflows that need attention.

---

## Key Features

- **Control Tower Dashboard:** Real-time business KPIs, shipment visibility, workflow blocker detection, revenue & profit analytics.
- **Customer & CRM Management:** Customer database, company profiles, contacts, billing details, and shipment history.
- **Shipment Request Management:** Inquiry collection, cargo info capture, scope selection (Port-to-Port / Door-to-Door), and auto-filling ETD/ETA dates.
- **Quotation Management:** Freight & local charge estimations, buy/sell rate calculations, gross profit visibility, approval workflow, and automatic costing sync.
- **Centralized Job File Management:** 10-tab job file workspace covering Overview, Workflow, Commercial, Operations, Documents, Freight Docs, Finance, Client Portal, Tasks, Timeline, and Audit.
- **Document Compliance Engine:** Smart document requirements based on transport mode and shipment type, required document gates, and finance close blockers.
- **Freight Document Generator:** Automatic PDF generation for HBL (Original/Express/Telex Release), HAWB, Sea/Air Manifests, Delivery Orders, Debit Notes, and Arrival Notices.
- **Finance & Closeout:** Invoicing, vendor bills, profit margin audit, financial lock, and audit-safe closeouts.
- **Client Portal:** Dedicated portal for customers with OTP login, mandatory first-time password updates, live milestone tracking, document access, and masked credentials.
- **Role-Based Access Control (RBAC):** 7 predefined system roles with fine-grained permission control and strict company isolation.
- **Multi-Branch Management:** Each company can operate multiple branches (e.g. Head Office, regional offices). Shipments, quotations, invoices, vendor bills, payments, tasks, and documents are always owned by exactly one branch; staff only see and act on records in the branches they are a member of, unless granted an explicit all-branches capability.
- **Automated Status Notifications:** Invoice, payment, vendor bill, and delivery/POD milestone events raise in-app notifications automatically, plus an idempotent outbox for optional email/WhatsApp delivery. External sending stays manual-approval by default; a company admin can approve a specific transactional template for automatic delivery via the protected self-hosted dispatch cron.
- **Advanced Global Search:** A debounced search box in the dashboard header looks up customers, shipments (job/BL/AWB/booking numbers), quotations, invoices, vendors, and documents in one query, fully scoped to the caller's company, branch access, module entitlement, and per-entity permission. Results are limited to safe metadata (type, title, reference, link, branch label) — no cost, profit, or file-content fields are ever returned.
- **Saved Filters & Views:** On the Shipments, Quotations, Tasks, Customers, and Vendors list pages, any user can save their current filter combination as a private, named view, recall it from a dropdown, rename or delete it, and mark one view per page as the default that auto-applies on a bare visit. Views are strictly private to the user who created them and are re-validated against an allowlisted, page-specific filter schema on every save and every read — a saved view can never carry more than its page's known filter keys, and applying one always re-runs the destination page's own live tenant/branch/RBAC checks.
- **Customizable Dashboard:** The main dashboard's six sections (Main KPI, Finance KPI, Operational Health, Sales & Request Flow, Quick Actions, Recent Shipments) can be reordered and shown/hidden per user via a "Customize dashboard" panel, with keyboard-accessible up/down controls and a one-click reset to default. The saved order/visibility is validated against a server-owned widget registry on every save and every render, so it can never reference an unknown widget, a data source, or a query — and a widget removed in a future update is safely dropped from an existing saved layout instead of breaking it.
- **Import & Export Data:** Permission-safe CSV export for customers, vendors, shipments, quotations, invoices, vendor bills, payments, and tasks, plus a guided customer/vendor CSV import wizard (upload → column mapping → validate/preview → explicit commit — nothing is written until you confirm). Every import run is tracked as its own job record with row-level results.
- **Recurring Task Management:** Define a task template that repeats daily, weekly, or monthly (with month-end/leap-year-safe date handling and a per-recurrence timezone), and a protected self-hosted cron generates each due occurrence automatically. Generation is idempotent and crash-safe — an overlapping or retried cron call can never create the same occurrence twice or skip a missed one — and a manual "Run now" action is always available for immediate recovery.
- **Custom Document Templates:** Under Settings → Document Templates, a company can create named layouts for quotation/invoice PDFs and for the freight documents that have their own branded print layout — House Bill of Lading (HBL), House Air Waybill (HAWB), debit notes, and manifests — reordering and hiding sections, plus (for quotation/invoice) overriding the notes/terms text with a small allowed set of placeholders (`{{companyName}}`, `{{customerName}}`, `{{documentNo}}`, `{{documentDate}}`). Each has activate/deactivate, duplicate, and a live preview. With no active custom template, every company keeps getting the exact same system-default layout as before this feature existed. Editing a template creates a new version rather than overwriting the old one, and once a document has been generated/printed it keeps rendering with that same version forever, even if the template is edited later.
- **Approval Workflow System:** A company can require sign-off on vendor bills and payments above a BDT threshold — one policy per document type (optionally scoped to one branch), with an ordered chain of up to 5 approver roles. Submitting a bill/payment over the threshold creates a pending, private approval request instead of applying it immediately; each step notifies its eligible approvers, the creator can never approve their own submission, steps cannot be skipped, and a rejection requires a fresh resubmission rather than reversing the same request. Editing a pending vendor bill's amount automatically cancels its in-flight approval request so nobody signs off on stale numbers. With no active policy for a document type, vendor bills and payments post exactly as they did before this feature existed — nothing is gated unless a company opts in.

---

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Styling:** TailwindCSS
- **Database & ORM:** PostgreSQL / MySQL with Prisma ORM
- **Authentication:** NextAuth.js
- **PDF Generation:** PDFKit

---

## Quick Start & Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Configuration

Copy `.env.example` to `.env` and set your credentials:

```bash
cp .env.example .env
```

Configured key environment variables:

```env
DATABASE_URL="mysql://username:password@localhost:3306/freight_control"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-super-secret-key-32-chars-long"
```

### 3. Database Push & Seed

```bash
# Push database schema
npx prisma db push

# Generate Prisma client
npx prisma generate

# Seed initial admin & demo data
npx prisma db seed
```

> **Upgrading an existing installation to a version that includes Multi-Branch Management:** run `npx prisma db push` (or apply the migrations under `prisma/migrations/` in order) before starting the app. This backfills a `Head Office` branch for every existing company and assigns all existing users to it, so no shipment, quotation, invoice, vendor bill, payment, task, or document is left without a branch.

> **Upgrading an existing installation to a version that includes Automated Status Notifications:** no manual step is required beyond applying migrations — the new `branchId`/`dedupeKey` columns on notifications and the outbox are nullable, and existing notifications/templates keep working unchanged. To enable automatic external delivery, see the self-hosted dispatch cron section below.

> **Upgrading an existing installation to a version that includes Saved Filters & Views:** no manual step is required beyond applying migrations — the new `SavedView` table is brand new and empty on first deploy, so nothing existing changes behavior.

> **Upgrading an existing installation to a version that includes the Customizable Dashboard:** no manual step is required beyond applying migrations and restarting the app server — the new `UserDashboardLayout` table is empty on first deploy, so every user sees the same default section order they saw before this feature existed.

> **Upgrading an existing installation to a version that includes Import & Export Data:** no manual step is required beyond applying migrations — the new `ImportJob` table is empty on first deploy, and CSV export/import are both net-new UI entry points that don't touch any existing data path.

> **Upgrading an existing installation to a version that includes Recurring Task Management:** apply migrations, then restart the app server. The new `Task.recurrenceId`/`Task.occurrenceDate` columns are nullable and every existing task keeps them `NULL`, so no existing task or task list behavior changes. To actually generate occurrences on a schedule, see the self-hosted recurring-task cron section below — until it's configured, recurrences can still be created and run on demand via the **Run now** button.

> **Upgrading an existing installation to a version that includes Custom Document Templates:** apply migrations, then restart the app server so it picks up the new Prisma models, and grant the new `documentTemplates:manage` permission to whichever role(s) should manage templates (Company Admin already has it going forward; existing companies need `npx prisma db seed` re-run, or the permission granted manually via **Roles**, to see it). The new `Quotation.templateVersionId`/`Invoice.templateVersionId` columns are nullable and start `NULL` for every existing document, and the new `DocumentTemplate`/`DocumentTemplateVersion` tables start empty — so every quotation/invoice PDF keeps rendering with the exact same system-default layout as before until a company explicitly activates a custom template.

> **Upgrading an existing installation to a version that includes the Approval Workflow System:** apply migrations, then restart the app server so it picks up the new Prisma models and the new `payment_status.PENDING` usage, and grant `vendorBills:approve`/`payments:approve`/`approvalPolicies:manage` to whichever role(s) should manage policies and approve (Company Admin already has all three going forward; existing companies need `npx prisma db seed` re-run, or the permissions granted manually via **Roles**, to see them). The new `ApprovalPolicy`/`ApprovalRequest`/`ApprovalStep`/`ApprovalDecision` tables start empty and the new `Quotation`/`Invoice`-style `templateVersionId` pattern's approval equivalent — `VendorBill`/`Payment` gain no new columns at all, only new child tables — so every vendor bill and payment posts exactly as it did before this feature existed until a company activates its own policy. **Important:** a policy step's required approver role must also hold the matching `vendorBills:approve`/`payments:approve` permission (via **Roles**), or nobody will be able to act on that step — this fails closed (the request just stays pending) rather than letting the wrong person decide it, but it is worth checking after creating a policy with a non-Company-Admin approver role.

#### Self-hosted notification dispatch cron

In-app notifications are always automatic. External email/WhatsApp/SMS delivery stays manual-approval by default (an admin sends each queued outbox item from **Company Settings → Delivery Outbox**). To enable *automatic* external sending for a specific template:

1. A company admin opens the template in **Company Settings → Notification Templates**, creates a company-specific override if one doesn't already exist, and turns on **Auto-send approved** for that template. System (non-override) templates can never be auto-sent — this is enforced server-side, not just hidden in the UI.
2. Set `COMMUNICATION_SECRET_KEY` (required for any real, non-dry-run delivery) and configure a connected communication account for the channel.
3. Set `NOTIFICATION_DISPATCH_SECRET` to a long random value. Leaving it unset keeps the dispatch endpoint permanently closed (it always returns 401).
4. Point a system cron (or any external scheduler) at the protected endpoint on an interval such as every 5 minutes:

   ```bash
   */5 * * * * curl -fsS -X POST -H "x-dispatch-secret: $NOTIFICATION_DISPATCH_SECRET" https://your-domain.example/api/cron/notification-dispatch
   ```

   Each call claims a batch of eligible `PENDING`/`FAILED` outbox rows (only ones whose template is an active, `autoSendApproved` company override), sends them, and applies exponential backoff (5min → 20min → 1hr → 4hr) on failure up to 5 attempts before a row is left `FAILED` for manual recovery from the Delivery Outbox page. Concurrent/overlapping cron runs cannot double-send the same row — each row is atomically claimed before sending.

#### Self-hosted recurring-task cron

Recurring tasks (**Workflow / Delivery → Recurring Tasks**) only generate their scheduled task occurrences when something calls the protected dispatch endpoint on a schedule:

1. Set `RECURRING_TASK_DISPATCH_SECRET` to a long random value. Leaving it unset keeps the endpoint permanently closed (it always returns 401) — recurrences can still be created, but no occurrence is generated automatically until this is set.
2. Point a system cron (or any external scheduler) at the protected endpoint. An hourly interval is a reasonable default for daily/weekly/monthly rules:

   ```bash
   0 * * * * curl -fsS -X POST -H "x-dispatch-secret: $RECURRING_TASK_DISPATCH_SECRET" https://your-domain.example/api/cron/recurring-tasks
   ```

   Each call processes every recurrence whose `nextRunAt` is due, generating one Task per missed occurrence (bounded per recurrence per call, so a long outage catches up over a few calls rather than flooding the task list at once) before advancing the schedule. Generation is idempotent — a retried or overlapping call can never create the same occurrence twice, and a crash between creating the task and advancing the schedule is safely retried on the next call rather than silently skipping that occurrence.
3. If the cron isn't configured yet, or a recurrence needs to catch up immediately, open the recurrence and use **Run now** — it runs the exact same generation logic on demand, with no separate code path to keep in sync.

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Default Login Credentials

Running `npx prisma db seed` creates a Platform Owner plus five company-scoped staff accounts. Every seeded account shares the password set in `SEED_ADMIN_PASSWORD` (falls back to `Admin123` if unset). See [`Documentation/installation-guide.html`](./Documentation/installation-guide.html) for the full list of accounts and their emails.

---

## Production Deployment

```bash
npm run build
npm run start
```
# freightfast
