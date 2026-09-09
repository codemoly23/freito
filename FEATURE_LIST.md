# FreightFast — Complete Feature List

_Verified directly against the source code (Prisma schema, server actions, API routes, and UI) on 2026-09-09. Nearly every item below is a real, working feature backed by live data — not a UI mockup. The few exceptions (a non-functional WhatsApp Web QR channel, a missing notification opt-out control, report export) are called out explicitly rather than listed as shipped. Where a feature has a notable scope limit, it is stated honestly in a "Note" line so the listing stays accurate._

**Tech stack:** Next.js 16 (App Router), React 19, TypeScript, Prisma 7 + MariaDB, NextAuth, Tailwind CSS 4, Azure Blob Storage, PDFKit, Google Gemini (via Vercel AI SDK), Nodemailer (SMTP), WhatsApp Cloud API, SMS (HTTP gateway).

## 1. Multi-Tenant Platform

- **Platform Admin Console** — a separate super-admin area (`/platform`, its own login scope) to manage every tenant company: company list/detail, per-company module enable/disable, subscription/plan tracking, and a platform-wide audit log.
  - _Note:_ the console's "Support" page is a static contact/documentation panel, not a ticket system — do not advertise it as one.
- **Per-Company Module Access Control** — each company can be granted or restricted access to individual modules (Shipments, Documents, Quotations, Costing, Billing, Reports, Tasks, Shipment Operations, Client Portal, WhatsApp Alerts, API Access) independently, enforced server-side at real usage points, not just hidden in the UI.
  - _Note:_ AI features are gated separately by RBAC + the platform/company AI toggle described below, not by this module list.
- **Subscription Tracking** — company plan type, subscription status, and trial/subscription end dates are manageable from the platform console and enforced.
- **Multi-Company & Branch Management** — unlimited companies, each with unlimited branches; every operational record (shipments, invoices, quotations, documents, etc.) is scoped to a company and branch, and users only see data for branches they're a member of.
- **Role-Based Access Control (RBAC)** — granular, per-action permissions (60+ distinct permission keys covering shipments, quotations, invoices, payments, documents, reports, AI, branding, roles, and more), assignable via custom roles per company.
- **Platform Kill-Switch for AI** — AI features can be globally disabled at the platform level, per-company enabled/disabled, and are gated by RBAC on top of that.

## 2. Sales, Quotation & CRM

- **Customer Management** — full CRUD for customer records; the customer profile page shows shipment/invoice/quotation counts.
  - _Note:_ the profile page shows counts, not a scrollable transaction list, on that screen.
- **Vendor Management** — full CRUD for vendor records (create/edit/deactivate) from a list view.
  - _Note:_ there is currently no per-vendor detail/profile page with linked bill history.
- **Quotation Builder** — itemized freight charges (buy/sell), multi-currency line items, PDF export, and conversion into a shipment.
  - _Note:_ conversion is not a direct one-click action on the quotation itself — it runs through an accepted Shipment Request, which is then converted into the shipment job.
- **Quotation Approval** — a permission-gated accept/reject status change (`quotations:approve`).
  - _Note:_ this is a simple status flip, not the same threshold-based, multi-step policy engine used for vendor bills/payments (see Approval Workflow System in section 5) — don't imply they share the same governed workflow.
- **Shipment Requests** — customer-initiated or internal booking/request intake that can be converted into full shipment jobs.
- **Carrier Queries** — structured rate-request tracking to carriers/agents.

## 3. Shipment / Freight Operations

- **Advanced Shipment Tracking** — vessel/voyage, ETD/ETA, actual arrival, and separate commercial/document/financial/operations status fields per shipment.
- **Container Tracking** — per-container gate-in/gate-out dates, free-time, and demurrage-risk tracking.
- **Status Timeline** — an append-only, chronological status-event log per shipment (who changed what, and when).
- **Configurable Shipment Workflows** — staged workflow engine (stages → steps) so operational milestones can be tracked and enforced per shipment type.
- **Shipment Print & PDF Views** — printable/exportable shipment summary documents.
- **Delivery / POD Release Tracking** — delivery-release events tied into the notification system.

## 4. Document Management & Compliance

- **Shipment Document Vault** — centralized, versioned document storage per shipment, backed by real Azure Blob Storage (not local/fake storage), namespaced per company/shipment.
- **Document Verification Workflow** — upload → pending → verified/rejected states, with uploader/verifier tracking.
- **Document Compliance Engine** — dynamically computes the required-document checklist per shipment and tracks completion percentage.
- **Custom Document Templates** — branded, versioned templates for Quotations and Invoices with a visual layout editor (section order, hidden sections, custom notes) rendered into real PDFs via PDFKit.
  - _Note:_ HBL/HAWB/Debit Note/Manifest templates support layout customization but reuse the on-screen print view rather than a dedicated standalone PDF generator.
- **Freight Document Checklist & Cross-Check** — document-specific checklists per shipment, plus AI-assisted single-document and multi-document cross-checking (see AI section).

## 5. Finance & Accounting

- **Multi-Currency Support** — quotations, invoices, vendor bills, payments, and cost items each support 8 currencies (BDT/USD/EUR/GBP/CNY/INR/AED/RUB + Other) with a per-line exchange rate.
  - _Note:_ all figures reconcile back to a fixed base currency (BDT), not a fully free-floating any-to-any ledger.
- **Invoicing** — full invoice lifecycle (draft → sent → paid), PDF generation, print view, and portal visibility for customers.
- **Vendor Bills** — vendor bill entry, approval-gated status changes above configurable thresholds, and payment tracking.
- **Approval Workflow System** — configurable threshold-based approval policies (by company/branch) for Vendor Bills and Payments, with a real state machine (pending → approved/rejected) that blocks the underlying status change until a user holding the required role decides it.
  - _Note:_ scoped to Vendor Bills and Payments only — Quotations use a simpler single-step accept/reject, not this policy engine (see note above).
- **Payments (Received & Paid)** — dedicated received-payment and paid-payment tracking, linked to invoices/vendor bills.
- **Receivables & Payables Ledgers** — real-time outstanding receivable/payable views computed from live invoice/bill/payment data.
- **Profitability Calculations** — real gross-profit and margin calculations per shipment (buy vs. sell), including a locked "final" figure once a job is closed.

## 6. Reports & Analytics

- Financial reports, operations reports, document reports, quotation reports, request reports, workflow reports, customer reports, and vendor reports — each reading live data with company/branch/role-based access scoping and date-range filters.
  - _Note:_ a document-compliance report page also exists and reads live data, but it lacks date-range filtering and branch scoping and isn't linked from the Report Center navigation — treat it as unfinished, not a shipped report.
- ~~Report Export (CSV/PDF)~~ — **not implemented.** No export or download exists on any report page; do not advertise report-level CSV/PDF export (entity-level CSV export is a separate, real feature — see section 7).

## 7. Data Import & Export

- **CSV Export** — Customers, Vendors, Shipments, Quotations, Invoices, Vendor Bills, Payments, and Tasks can each be exported as CSV, permission-gated and audit-logged.
- **CSV Import** — guided upload → column-mapping preview → validation/dedupe → commit pipeline with a persistent import-job record.
  - _Note:_ import currently supports Customers and Vendors only; other entities are export-only.

## 8. Communications & Notifications

- **Multi-Channel Notification Dispatch** — real domain events (invoice sent/paid, payment received, vendor bill received, delivery/POD released, approval requested/decided, document verified, etc.) automatically trigger notifications — not manual "send" buttons.
- **Notification Delivery Channels** — in-app notifications plus external delivery via SMTP email, WhatsApp Cloud API, and SMS gateway, each configurable as a company communication account.
  - _Note:_ a WhatsApp Web (QR-linked) provider exists in the UI but is not functional — its send path always returns "not implemented" and is blocked before dispatch. Do not advertise it as a working channel.
- **Delivery Retry & Backoff** — failed external deliveries automatically retry with backoff (5/20/60/240 min, up to 5 attempts) via a background cron dispatcher.
- **Notification Center** — a live unread-count bell, filterable notification list, and mark-read/delete.
  - _Note:_ per-user opt-out has a database table that is checked during dispatch, but there is no UI or action for a user to actually create an opt-out — this control does not exist yet.
- **Notification Template Controls** — per-event-type toggles for active/inactive and auto-send-on-approval.
  - _Note:_ this does not include editing the message subject/body text itself; templates are not yet content-editable.
- **Share via Client Portal Link** — send a customer a quotation/shipment/invoice link (by email/WhatsApp) that opens a redacted portal view (no buy cost, margin, or internal notes).
  - _Note:_ the recipient must log into their client portal account to view it — this is not an anonymous, tokenless public link.

## 9. Task & Workflow Management

- **Task Management** — create, assign, and track operational/administrative tasks tied to shipments, customers, or standalone.
- **Recurring Tasks** — real recurrence-rule engine (frequency/interval/timezone-aware, DST and month-end safe) with a cron-driven runner that creates new task instances on schedule, idempotently.
- **Activity Timeline** — a real, per-record audit trail (who did what, when) aggregated across a record and its related sub-entities (e.g. a shipment's containers, documents, cost items, and workflow steps all roll into one feed).

## 10. Customer Self-Service Portal

- Branded, per-company portal (`/portal/[companySlug]`) where customers log in and see only their own data — hard-scoped by company + customer + portal account, with no cross-tenant leakage.
- Customers can view their shipments, documents, invoices, and quotations, and submit new shipment requests, with in-portal notifications.

## 11. Search, Filters & Dashboard

- **Advanced Global Search** — a single Ctrl+K search box querying customers, vendors, shipments, quotations, invoices, and documents in parallel, permission- and branch-scoped.
- **Saved Filters & Views** — per-user, per-page filter presets that persist in the database and survive logout/refresh.
- **Customizable Dashboard** — a per-user, persisted dashboard layout (9 widgets) with reorder and show/hide controls.
  - _Note:_ this reorders/toggles a fixed widget catalog rather than free-form drag/resize widgets.

## 12. Branding & White-Labeling

- Company-level logo upload, applied to the customer portal header and to generated PDFs (invoice/quotation/shipment).
  - _Note:_ there is no color/theme branding field — only a logo. The logo is also not applied to the main dashboard chrome (which shows the platform's own logo) or to transactional emails (plain, unbranded HTML). Do not advertise full "dashboard + portal + PDF + email" branding coverage.

## 13. AI-Powered Features (Google Gemini)

All AI calls are routed through a single gateway (`lib/ai/gateway.ts`) that enforces: platform kill-switch → company enable flag → RBAC permission → daily request quota → audit logging. Every feature below is genuinely wired end-to-end (UI → logic → data), verified by direct code trace — none are hardcoded/fake.

**Real LLM-generated (Google Gemini):**

- **AI Shipment Assistant** — a streaming chat assistant grounded in a shipment's live data (status, pending tasks, issues).
- **AI Document Reader** — real vision extraction: uploaded document images/PDFs are sent as file data to Gemini to extract shipment/document fields (not filename guessing).
- **AI Document Checker** — extracts a single document's data and checks it for missing/incorrect/inconsistent fields against the shipment record.
- **AI Document Cross-Check** — extracts 2+ uploaded documents independently and has Gemini compare them against each other, surfacing exactly which field conflicts and which document each value came from.
- **AI Quotation Generator** — generates a draft quotation using the company's real historical quotations as reference, output validated against the same schema as the manual charge-entry form.
- **AI Email Generator** — drafts a professional customer email (subject + body) from real shipment/operational context; the user always reviews before sending.
- **AI Shipment Summary** — converts a full shipment job file into a concise operational summary.
- **AI Report Insights** — narrates what changed period-over-period on the financial report, computed from the same real numbers shown in the report tables.
- **AI Customer Insights** — summarizes a customer's real shipment/invoice/quotation history and flags business-opportunity signals.
- **AI Smart Search** — interprets a natural-language search query into a search keyword.
  - _Note:_ the underlying record retrieval is still keyword/substring matching, not vector/semantic search — the AI layer improves what is searched for, not how matching works.

**Real, data-driven (rule-based, not an LLM call — accurate to label as "AI-assisted" automation rather than generative AI):**

- **AI Delay Alerts** — flags shipments at risk based on real ETA/workflow-overdue data.
- **AI Profit Analysis** — flags loss-making and low-margin shipments from real cost/revenue figures.
- **AI Task Suggestions** — recommends next actions derived from the Exception Radar feed; accepting a suggestion creates a real task.
- **AI Shipment Health Score** — a 0–100 score with an itemized breakdown, computed from real overdue milestones, document status, and profitability.
- **AI Exception Radar** — aggregates delay risk, profit risk, and rejected documents into one prioritized attention feed, powering both the dashboard and Task Suggestions.

---

## Honest Limitations (for accurate CodeCanyon disclosure)

- Only the Google Gemini provider is implemented; OpenAI/Anthropic are schema-ready but not yet wired.
- Multi-currency reconciles to a single base currency (BDT), not a true any-to-any ledger.
- CSV import is limited to Customers and Vendors.
- 4 document template types (HBL/HAWB/Debit Note/Manifest) don't yet have a dedicated PDF generator.
- Dashboard customization is reorder/show-hide of a fixed widget set, not free-form widgets.
- "AI Smart Search" improves query interpretation, not the underlying search algorithm (still keyword-based).
- The platform console's "Support" page is a static contact panel, not a ticket system.
- The customer profile page shows shipment/invoice/quotation counts, not a full transaction list; vendors have no detail page at all yet.
- Quotation "approval" is a simple accept/reject flip — the governed, threshold-based Approval Workflow only covers Vendor Bills and Payments.
- "Share links" require the recipient to log into the client portal — they are not anonymous, tokenless public links.
- Quotation-to-shipment conversion is not directly one-click on the quotation — it routes through an accepted Shipment Request.
- Report-level CSV/PDF export does not exist. (Entity-level CSV export — customers, vendors, shipments, etc. — is real; see section 7.)
- The document-compliance report exists but is unfinished: no date-range filter, no branch scoping, and not linked from the Report Center.
- The WhatsApp Web (QR-linked) notification channel is a non-functional placeholder — sending through it always fails. Only WhatsApp Cloud API actually delivers messages.
- Per-user notification opt-out has no working control — there is no UI or action for a user to opt out, even though the dispatcher checks for one.
- Notification "templates" only support active/inactive and auto-send toggles, not editing of the actual message subject/body text.
- Branding is logo-only (no color/theme), and the logo is applied to the customer portal and PDFs only — not to the main dashboard UI or to transactional emails.
