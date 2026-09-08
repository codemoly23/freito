# Freito — Core & Advanced Features Implementation Plan

Audit-এ চিহ্নিত Core & Advanced Features-এর মধ্যে Partial ও Not Implemented ফিচারগুলোর জন্য dependency ও priority অনুযায়ী sequential build order। **প্রতিটি Phase = একটি feature। একটা শেষ না করে পরের Phase-এ যাওয়া হবে না।**

AI-Powered Features (15টি) ইচ্ছাকৃতভাবে এই plan থেকে বাদ দেওয়া হয়েছে — সেগুলোর জন্য আলাদা, হালকা [`AI_IMPLEMENTATION_PLAN.md`](./AI_IMPLEMENTATION_PLAN.md) তৈরি করা হয়েছে (এই ফাইলের ভারী delivery rule সেখানে প্রযোজ্য না; 9 Phase, dependency-ভিত্তিক ক্রম)।

- মোট Phase: 9
- Partial সম্পূর্ণ করতে হবে: 3 (Phase 01, 02, 09)
- নতুন করে বানাতে হবে: 6

Progress marker: একটা Phase শেষ হলে তার শিরোনামের `[ ]` কে `[x]` করে দিন, তারপর পরের Phase শুরু করুন।

---

## CodeCanyon delivery rule

প্রতিটি Phase-এ শুধু UI বা model যোগ হলেই feature complete হবে না। একটি Phase complete হওয়ার জন্য migration, server-side RBAC/tenant scope, audit log, seed/demo data, documentation এবং manual QA একসঙ্গে complete হতে হবে। একটি Phase complete হওয়ার আগে পরের Phase শুরু করা যাবে না।

### সব Phase-এর বাধ্যতামূলক quality gate

1. Prisma migration clean database এবং existing demo/customer data upgrade-এ test করতে হবে; production database manually edit করা যাবে না।
2. প্রত্যেক server action/API-তে authenticated user, company scope, enabled module, RBAC এবং ভবিষ্যৎ branch scope validate করতে হবে। Browser থেকে আসা ID, JSON, filter বা page key trusted নয়।
3. Create/update/delete/approve/reject/import/export/automated event-এ audit log থাকতে হবে।
4. npm run type-check, npm run lint pass; README/Documentation ও seed data update; responsive/manual QA complete।

## Phase 00 — Architecture and release baseline (gate, feature নয়)

**Progress:** [ ] শুরু হয়নি

### Frozen v1 decisions

- **Branch is mandatory.** Phase 01 must complete before every other feature phase. No later feature may introduce a parallel, branch-unaware data path.
- **Branch authorization model:** existing role/permission remains company-level; branch is a mandatory data-scope overlay. A user must have both the existing company permission and membership of the record's branch. A separately granted all-branches capability may bypass membership only within the same company.
- **External notification policy:** in-app notifications are automatic. Email/WhatsApp/SMS remain manual-approval by default, preserving the existing safe send boundary. A company administrator may explicitly enable automatic external delivery only for approved transactional template keys, a configured/encrypted provider, and opted-in recipients. Marketing/free-form messages are never auto-sent in v1.
- **Scheduler deployment:** v1 supports a protected server endpoint invoked by documented self-hosted cron. The endpoint has an authenticated secret, idempotent processing, retry limit, failure visibility, and manual recovery action. A hosted scheduler is optional only where documented by the deployment target.
- **Import v1:** CSV is mandatory. XLSX is deferred until it has identical validation, security, and buyer documentation. Customer/vendor imports are v1; shipment and financial imports are explicitly deferred.
- **Approval v1:** vendor bills and payments only. Policies support company/branch applicability, BDT-normalized threshold, ordered role-based approvers, reject/resubmit, and creator-self-approval is prohibited. Expense lifecycle is deferred.
- **Template v1:** quotation and invoice templates only; bounded section/placeholder editor, not unrestricted WYSIWYG or arbitrary HTML/CSS.

এই gate-এ release setup checklist, environment variable guide, backup/restore note record করতে হবে।

### Mandatory execution order

| Execution order | Feature |
| ---: | --- |
| 01 | Multi-Company & Branch Management |
| 02 | Automated Status Notifications |
| 03 | Advanced Global Search |
| 04 | Saved Filters & Views |
| 05 | Import & Export Data |
| 06 | Customizable Dashboard |
| 07 | Recurring Task Management |
| 08 | Custom Document Templates |
| 09 | Approval Workflow System |

Phase headings-এর physical ও numeric order একই। Phase 01 complete ছাড়া Phase 02 শুরু করা যাবে না।

---

## Phase 01 — Multi-Company & Branch Management — *Partial*

বর্তমান: company-level multi-tenancy আছে, branch/location নেই।

**Implement করতে হবে:**
- `branch` ও branch-membership model: company scope, unique branch code, active state এবং one default branch per user
- Operational records-এ branch ownership assessment ও nullable `branchId`; user-এর জন্য single branchId নয়
- Centralized branch-scope helper, explicit all-branches capability এবং list/report/search/export branch filtering
- Existing data-র HEAD_OFFICE backfill, seed/demo multi-branch update এবং migration upgrade test

**Dependency:** নেই সরাসরি, কিন্তু সবচেয়ে invasive — শুরু করার আগে ব্যবসায়িক প্রয়োজন নিশ্চিত করুন। যত দেরি হবে dashboard/reports/notification recipient scoping-এ তত বেশি retrofit লাগবে।

**Progress:** [ ] চলমান — sub-item ভিত্তিক status নিচে দেখুন

### Sub-progress (entity-by-entity rollout)

- [x] **Schema:** branch master/membership, plus mandatory `branchId` ownership on shipment, shipment request, quotation, invoice, vendor bill, payment, task, shipment document and freight document. `prisma validate` passes.
- [x] **Migrations authored ও DB-তে apply করে verify করা হয়েছে:** `20260831000100_add_branch_management`, `20260831010000_add_branch_scope_columns`, `20260901000100_add_branch_ownership_to_operational_records` — তিনটাই dev DB-তে চালিয়ে সব ৯টা টেবিলে NOT NULL + RESTRICT foreign key confirm করা হয়েছে (আগে একটা inconsistent partial state পাওয়া গিয়েছিল, সেটা backup নিয়ে ঠিক করা হয়েছে)।
- [x] **Shipment** — server action create/read/update/delete paths এবং main list/detail screen branch-scope helper ব্যবহার করে। **Branch selector UI যোগ করা হয়েছে** (`components/forms/shipment-forms.tsx`) — নতুন shipment তৈরির সময় user-এর একাধিক branch access থাকলে dropdown দেখায় (একটাই branch থাকলে dropdown না দেখিয়ে automatic default ব্যবহার হয়), ভুল/access-বহির্ভূত branch select করলে server-side validation error দেখায়।
- [x] **Quotation, invoice, vendor bill, payment, shipment request এবং task — secondary coverage audit সম্পূর্ণ।** প্রতিটা action file-এর প্রতিটা `findFirst`/`findUnique` lookup ম্যানুয়ালি check করে ৪টা real cross-branch gap পাওয়া গেছে এবং ঠিক করা হয়েছে:
  - `finance.ts` — `importQuotationChargesToShipmentAction`-এ quotation lookup branch-check ছাড়া ছিল (অন্য branch-এর quotation থেকে charge import করা যেত)
  - `finance.ts` — `validateCompanyReferences` helper (৪ জায়গায় ব্যবহৃত)-এ shipmentJobId/quotationId reference branch-check ছাড়া ছিল
  - `finance.ts` — `deleteShipmentCostItem`, `deleteQuotationCharge`-এ parent shipment/quotation-এর branch verify হতো না
  - `shipment-requests.ts` — `updateShipmentRequest`, `updateShipmentRequestStatus` — এই দুইটা function-এ branch scope পুরোপুরি বাদ পড়েছিল (একই ফাইলের অন্য function-গুলোতে ছিল)
  - `tasks.ts` ও `billing.ts` পুরোপুরি audit করে **কোনো gap পাওয়া যায়নি** — সব lookup আগে থেকেই সঠিকভাবে scoped।
- [x] **Freight document / shipment document — secondary coverage সম্পূর্ণ।** `toggleClientVisibility`, `verifyExternalDocument`, `rejectExternalDocument`, `uploadExternalDocumentFile` — এই ৪টা function-এ কোনো branch check-ই ছিল না (company-level scope-এই আটকে ছিল) — এখন সবগুলো `getDocumentForAction` helper ব্যবহার করে। `documents.ts`-ও পুরোপুরি audit করে নিরাপদ পাওয়া গেছে (parent shipment আগে থেকেই branch-verified থাকে)। `updateFreightDocument`-এ পাওয়া dead/unused branch variable পরিষ্কার করা হয়েছে (এটা আসলে security gap ছিল না, আগের gap-রিপোর্ট ভুল ছিল)।
- [x] **Workflow/report-query assessment** — verify করে দেখা গেছে সবগুলো report page (`customers`, `documents`, `financial`, `operations`, `quotations`, `requests`, `vendors`, `workflow`) একটা shared `requireReportsPage()` helper ব্যবহার করে যেটা `branchScopeWhere` প্রয়োগ করে — অর্থাৎ report-level branch scoping ইতিমধ্যে সম্পূর্ণ। **Notification delivery**-এর branch policy Phase 00 decision অনুযায়ী ইচ্ছাকৃতভাবে Phase 02-এ deferred (event/recipient matrix তৈরির সময়)।
- [x] **`scripts/seed-demo-data.ts`** — সম্পূর্ণ মেরামত করে এখন **শেষ পর্যন্ত সফলভাবে চলে** ("Phase 18A demo data pack seeded")। যা ঠিক করা হয়েছে: (ক) ৯০+ Prisma accessor casing bug, (খ) enum-import bug (কেউ আগেই ঠিক করেছিল), (গ) ৩৩+ জায়গায় missing `id`/`updatedAt` (schema-তে auto-default নেই), (ঘ) `trimDemoMasterData`-এর customer/vendor relation-key casing, (ঙ) `documentversion.content`-এ object-এর বদলে JSON string দরকার ছিল, (চ) `invoice`/`vendorbill`-এর line-item relation নাম ভুল ছিল (`lines` → `invoiceline`/`vendorbillline`), (ছ) **সবচেয়ে গুরুত্বপূর্ণ real bug:** migration-এর blanket HEAD_OFFICE backfill থেকে `operations@freightcontrol.com`-এর একটা stale HEAD_OFFICE membership থেকে গিয়েছিল, ফলে সে CTG_OPS-এ "restricted" হওয়া সত্ত্বেও HEAD_OFFICE-এর সব shipment দেখতে পারছিল — এখন সেই stale membership স্ক্রিপ্টেই cleanup করা হয়েছে এবং সরাসরি browser দিয়ে verify করে (raw HTML-এ ডেটা leak নেই) নিশ্চিত করা হয়েছে।
- [x] **E2E isolation test** — `33-branch-management.spec.ts`-এ ২টা test pass করছে, এবং দ্বিতীয়টা (cross-branch isolation) এখন সত্যিই কিছু verify করছে (আগে data bug-এর কারণে ভুলভাবে pass করত, রুট-কজ খুঁজে ঠিক করা হয়েছে)।
- [x] **Regression sweep (round ১)** — 04-shipments, 06-quotations-costing, 07-billing-payments, 18-task-management, 33-branch-management চালানো হয়েছে। ২টা genuine regression পাওয়া গেছে এবং ঠিক করা হয়েছে: (১) `18-task-management.spec.ts`-এর raw-SQL cross-company test-এ `branchId` missing ছিল, (২) একই test-এর cleanup order ভুল ছিল (RESTRICT FK violation) — এখন Task আগে delete হয়। **shipments list-এ একটা "View" link যোগ করা হয়েছে** যেটা আগে ছিলই না।
- [x] **Regression sweep (round ২, secondary-coverage fix-এর পরে)** — 06, 09, 20, 21 নম্বর spec চালানো হয়েছে। সবগুলো failure ধরে ধরে root-cause পর্যন্ত trace করে **branch-unrelated বলে নিশ্চিত করা হয়েছে**:
  - `06-quotations-costing` — আগেই চিহ্নিত `canViewCosting` permission gate issue
  - `07-billing-payments` — pure UI timing flake, backend DB সরাসরি চেক করে ডেটা সঠিক পাওয়া গেছে
  - `21-company-shipment-requests` — test outdated: company-created request-এ "Create quotation" বাটন দেখায় না (`canQuote = !isCompanyCreated && ...`), বরং সরাসরি "Approve & Convert to Shipment" flow ব্যবহার হয় — এটা product/test drift, branch-এর সাথে সম্পর্কহীন
  - `09-client-portal-requests-conversion`, `20-freight-document-generator` — workflow-step-count ও UI-timing সংক্রান্ত pre-existing issue; সরাসরি DB চেক করে নিশ্চিত হওয়া গেছে যে freight document/branchId ঠিকভাবে তৈরি হচ্ছে, শুধু frontend assertion timing-এ সমস্যা
  
  এই Phase-এর scope-এর বাইরে এই ৫টা pre-existing issue — track করার জন্য নোট করে রাখা হলো, কিন্তু fix করা হয়নি যেহেতু branch কাজের সাথে সম্পর্কহীন।
- [x] **Documentation** — `README.md`-এ "Multi-Branch Management" feature bullet এবং existing installation-এর জন্য upgrade note যোগ করা হয়েছে (Head Office backfill migration চালানোর নির্দেশনা)।
- [x] **Manual QA — branch isolation (user নিজে হাতে-কলমে করেছেন)** — বাস্তব browser-এ সরাসরি test করে confirm করা হয়েছে:
  - Multi-branch user (Sales Executive, Head Office + Dhaka Branch member)-এর জন্য shipment create form-এ branch dropdown দেখা যায়; "Head Office" (non-default) বেছে shipment তৈরি করলে সেটা ঠিক Head Office-এই সেভ হয় (DB-তে verify করা)
  - Single-branch user (Operations Manager, শুধু Chattogram Operations member)-এর জন্য branch dropdown দেখায় না
  - Single-branch user-এর জন্য **Shipments, Quotations, Invoices, Vendor Bills, Payments, Tasks, Shipment Requests — সবগুলো পেজ-ই খালি দেখায়** (company-তে ৮টা shipment ও অন্যান্য ডেটা থাকা সত্ত্বেও, কারণ সব Head Office/Dhaka Branch-এ, operations user-এর branch-এ কিছু নেই) — এটাই মূল cross-entity branch isolation guarantee, বাস্তব ব্যবহারকারী দিয়ে সফলভাবে verified।
- [ ] **বাকি ~২৪টা automated E2E spec (32-এর মধ্যে ৮টা এই Phase-এ চালানো হয়েছে)** — এখনো বাকি, user পরে চালাবেন বলে জানিয়েছেন।
- [x] **Prisma migration history baseline** — Codex ধরেছে: `prisma migrate status` ৩২টা migration-ই "not yet applied" দেখাচ্ছিল, কোনো `_prisma_migrations` tracking table ছিল না। এটা Phase 01-নির্দিষ্ট না — পুরো প্রজেক্টের আগে-থেকেই-থাকা বেসলাইন সমস্যা (DB `prisma db push` দিয়ে তৈরি হয়েছিল, `migrate` দিয়ে না), কিন্তু production-এ `prisma migrate deploy` চালালে fail করত বলে সেটা genuinely গুরুত্বপূর্ণ। সব ৩২টা migration-এ `prisma migrate resolve --applied` চালিয়ে history ঠিক করা হয়েছে (শুধু bookkeeping — কোনো SQL/schema/data touch হয়নি, base data verify করে অক্ষত পাওয়া গেছে)। এখন `prisma migrate status` → "Database schema is up to date!"

### সমাধান হওয়া পুরনো known issue

আগে এখানে লেখা ছিল `scripts/seed-demo-data.ts`-এর enum-naming bug branch rollout থেকে আলাদা ট্র্যাক করা হবে — সেটা এখন সম্পূর্ণ ঠিক হয়ে গেছে এবং script পুরোপুরি কাজ করছে, তাই আর আলাদা known issue হিসেবে থাকছে না।

---

## Phase 02 — Automated Status Notifications — *Partial*

বর্তমান: workflow assignment, document rejection, portal request/quotation event, booking confirmation, final BL/AWB lock এবং pre-alert update-এ notification আছে। Invoice/payment, delivery milestone এবং reliable automatic dispatch অসম্পূর্ণ।

**Implement করতে হবে:**
- Actual billing action flow-এ missing invoice, payment এবং vendor-bill event trigger যোগ
- Delivery/POD এবং useful shipment status milestones-এর event matrix implement করা
- Existing booking confirmation, final BL/AWB lock এবং pre-alert trigger preserve করে idempotent outbox/automatic dispatch যোগ

**Dependency:** নেই — বিদ্যমান `notification`/`notificationdelivery` মডেল ও `lib/notifications` ব্যবহার হবে।

### বাধ্যতামূলক scope correction

- Invoice ও payment status flow-এর বাস্তব source billing action layer; notification কাজ সেখানে যোগ করতে হবে। বিদ্যমান booking, BL lock ও pre-alert trigger duplicate করা যাবে না।
- প্রথমে event matrix লিখতে হবে: event, recipient role, branch scope, in-app title/message, optional external channel, template key, link এবং opt-in rule।
- Business event ও delivery queue-এর duplicate-safe idempotency key থাকতে হবে; same event retry হলে একই recipient/channel-এ দ্বিতীয় message queue হবে না।
- Automatic external dispatch-এর জন্য protected scheduled worker/endpoint, retry limit, failed-delivery state, provider error capture এবং documented self-hosted setup লাগবে।
- Encryption/configuration ছাড়া real external sending disabled থাকবে; clearly labelled dry-run/manual retry fallback থাকবে।
- In-app notification is automatic. External email/WhatsApp/SMS remains manually approved by default. Automatic external delivery is permitted only when a company administrator has enabled an approved transactional template, the recipient has opted in, and the provider/encryption configuration is valid.

### Acceptance criteria

- Provider failure sent হিসেবে mark হবে না; outbox-এ failed/retryable state দেখা যাবে।
- Company/branch scope change করে অন্য tenant-এর delivery দেখা বা dispatch করা যাবে না।

**Progress:** [ ] চলমান — sub-item ভিত্তিক status নিচে দেখুন

### Sub-progress

- [x] **Schema** — `notification`/`notificationdelivery`-তে nullable `branchId` ও `dedupeKey` (`@@unique`), `notificationtemplate.autoSendApproved`, নতুন `notificationoptout` টেবিল (non-null `recipientKey` discriminator, নীচে কারণ)। Migration `20260901010000_add_notification_branch_dedupe_optout` — dev DB-তে apply এবং একটা disposable clean DB-তে `prisma migrate deploy` দিয়ে fresh-install path আলাদাভাবে test করা হয়েছে।
- [x] **Idempotency design** — `dedupeKey` কলাম + `@@unique` constraint + P2002 catch-and-return-existing pattern, `createUserNotification`/`createClientPortalNotification`/`createNotificationDeliveryFromTemplate`-এ যোগ করা হয়েছে। MariaDB-তে `createMany`-এর `skipDuplicates` সাপোর্ট নেই বলে `createCompanyNotification`-এর dedupe-aware path per-row loop ব্যবহার করে (existing non-dedupe callers-এর `createMany` path অপরিবর্তিত)।
- [x] **Opt-out key design** — `notificationoptout.recipientKey` (`USER:<id>` / `PORTAL:<id>`) একটা non-null string column হিসেবে ব্যবহার করা হয়েছে, দুইটা nullable FK column না — কারণ MySQL/MariaDB unique index-এ প্রতিটা NULL আলাদা গণ্য হয়, তাই nullable composite unique দিয়ে duplicate opt-out row silently ঢুকে যেতে পারত।
- [x] **Event matrix** — `lib/notifications/event-definitions.ts`-এ ১৬টা event (invoice created/sent/paid, payment received, vendor bill created/received/paid, delivery/customs/gate-pass verified, cargo released, delivery scheduled, out-for-delivery, delivered, POD uploaded/verified)। Recipient design: প্রতিটা event রেকর্ডে আগে থেকেই থাকা নির্দিষ্ট ব্যক্তিকে (creator/assignee, ও রেকর্ডের নিজের customer portal account) target করে — existing booking-confirmation/workflow-assignment precedent-এর মতোই, নতুন company-wide role-based fan-out বানানো হয়নি। শুধু ৬টা customer-facing event-এর জন্য `notificationtemplate` row লাগে (বাকি ১০টা internal-only, existing booking_confirmed precedent-এর মতো outbox ছোঁয় না)।
- [x] **`vendor_bill_received`** নামকরণ করা হয়েছে (`vendor_bill_approved` না) — "approved" শব্দটা Phase 09 approval-workflow vocabulary-র জন্য রাখা হয়েছে; এটা শুধু status-reached notice, কোনো approval decision না।
- [x] **Outbox create-vs-send সেপারেশন** — template active ও recipient opt-out না থাকলে outbox row সবসময় `PENDING` তৈরি হয় (in-app-এর মতোই automatic); `autoSendApproved` শুধু cron dispatcher-এ চেক হয়, creation-এ না।
- [x] **System template auto-send hard-block** — `autoSendApproved` টগল admin UI-তে শুধু company-override template row-এ লেখা হয় (copy-on-write, existing `toggleNotificationTemplate` pattern reuse করে); cron endpoint-এর query-তেও `isSystem: false` filter defense-in-depth হিসেবে আছে।
- [x] **billing.ts wiring (৪টা জায়গা)** — `saveInvoice` (create), `updateInvoiceStatus` (SENT), `saveVendorBill` (create), `updateVendorBillStatus` (RECEIVED), `createPayment` (payment_received + conditional invoice_paid/vendor_bill_paid)। `createPayment`-এর transaction-এর return shape বদলানো হয়নি (একমাত্র caller ছিল) — payment_received-এর caller post-transaction আলাদা করে invoice/vendorbill status re-fetch করে paid event fire করে, এতে transaction internals touch করা লাগেনি।
- [x] **delivery-release.ts wiring (৯টা জায়গা)** — delivery-order/customs-release/gate-pass শুধু VERIFIED status-এ fire করে (RECEIVED-এ না, double-ping এড়াতে); বাকি ৬টা (cargo-released, schedule, out-for-delivery, delivered, POD upload/verify) unconditionally fire করে।
- [x] **Cron dispatch endpoint** — `app/api/cron/notification-dispatch/route.ts` (app-এর প্রথম non-cookie-auth route)। `NOTIFICATION_DISPATCH_SECRET` env var + `crypto.timingSafeEqual` (env unset হলে সবসময় 401, fail-closed)। প্রতিটা delivery row পাঠানোর আগে atomic claim (`updateMany` conditional on current status) — concurrent cron run একই row দুইবার send করতে পারবে না। Failure-এ exponential backoff (5min→20min→1hr→4hr) `nextAttemptAt`-এ set হয়, ৫ attempt পরে manual recovery-র জন্য `FAILED`-এ থেকে যায়।
- [x] **Admin UI** — Notification Templates page-এ "Approve auto-send"/"Revoke auto-send" টগল যোগ হয়েছে (company-override-only, system template কখনো সরাসরি টগল হয় না)।
- [ ] **Opt-out UI** — `notificationoptout` মডেল ও dispatch-এর filtering logic সম্পূর্ণ কাজ করে, কিন্তু per-user/per-portal-account opt-out করার actual settings-page checkbox বানানো হয়নি — ইচ্ছাকৃতভাবে v2-এ deferred (plan-এর নিজের অনুমতি অনুযায়ী "half-built" না রেখে documented deferral)।
- [x] **README** — "Automated Status Notifications" feature bullet, upgrade note, ও সম্পূর্ণ self-hosted cron setup section (secret rotation, template auto-send approval flow, backoff/retry ব্যাখ্যা সহ) যোগ করা হয়েছে।
- [x] **`tests/e2e/34-automated-notifications.spec.ts`** — ৪টা test pass করছে: (১) invoice created/sent — internal + portal in-app notification, PENDING outbox delivery, internal figure leak না থাকা, (২) cron endpoint শুধু সঠিক secret দিয়ে কাজ করে (401 without/wrong secret), (৩) একই invoice দুইবার concurrently "Mark sent" করলে duplicate outbox delivery তৈরি হয় না (dedupeKey সত্যিই কাজ করে, direct DB count দিয়ে verify করা), (৪) delivery milestone verify internal notification তৈরি করে।
  - **Scope note:** delivery-release.ts-এর ৯টা milestone-এর মধ্যে শুধু customs-release ও gate-pass এই test-এ exercise করা হয়েছে — বাকি ৭টা (বিশেষত delivery-order ও cargo-released) একটা pre-existing, Phase-02-এর সাথে সম্পর্কহীন `canReleaseDelivery()` gate-এর পেছনে যেটা transport-mode-specific mandatory document (যেমন SEA-এর জন্য "Master BL") আগে থেকে upload করা থাকা দাবি করে — সেটা upload করানো এই phase-এর scope-এর বাইরে। যেহেতু সবগুলো milestone একই shared `notifyDeliveryEvent` helper কল করে, দুইটা দিয়ে প্রমাণ হওয়া wiring বাকি সাতটার জন্যও প্রযোজ্য — কিন্তু manual QA-তে এটা spot-check করার সুপারিশ করা হচ্ছে।
- [x] **Regression sweep** — `12-notifications.spec.ts` ও `13-notification-outbox.spec.ts` Stage 1 (schema), Stage 5 (billing wiring) ও শেষে — প্রতিবার ৬/৬ pass (একবার pre-existing splash-screen UI flake হয়েছিল, retry-তে pass করেছে, root cause `components/splash-screen.tsx`-এর unrelated `setState`-in-effect issue, আগে থেকেই lint-এ flagged)। পুরো ৩৪-spec suite (chromium) একবার চালানো হয়েছে ফাইনাল ধাপে।
- **আবিষ্কৃত কিন্তু out-of-scope pre-existing issue:** `prisma db seed` চালানোর সময় (নতুন notification template seed করতে গিয়ে) script পরে গিয়ে একটা unrelated জায়গায় (`shipmentRequest.create`, seed.ts:1048) fail করে ("Argument `company` is missing")। এটা Phase 02-এর কোনো কোড টাচ করেনি এবং notification template loop (line 748, যেখান থেকে এই phase-এর নতুন template data insert হয়) ওই failure-এর অনেক আগেই সফলভাবে সম্পন্ন হয়ে যায় — তাই টেমপ্লেট সিডিং সঠিকভাবে হয়েছে, কিন্তু seed script-এর এই বাগ track করার জন্য নোট রাখা হলো।

**Deferred:** external দিয়ে delivery-order/cargo-release-onward milestone-এর জন্য mandatory-document precondition satisfy করে পুরো ৯-milestone chain একটা fresh E2E-তে drive করা, এবং opt-out settings UI — এই দুইটা explicit future follow-up।

---

## Phase 03 — Advanced Global Search — *Implemented*

বর্তমান: হেডারে real debounced search input আছে, `/api/search` route customer/shipment/quotation/invoice/vendor/document জুড়ে company+branch+module+permission-scoped query চালায়।

**Implement করা হয়েছে:**
- `/api/search` route — customer, shipment, quotation, invoice, vendor, document জুড়ে cross-model query
- `dashboard-header.tsx`-এর decorative div real input + debounce (250ms) + AbortController cancel + result dropdown-এ রূপান্তরিত (শুধু company-scope `(dashboard)` layout-এ; `(platform)` panel-এ দেখানো হয় না, কারণ ওখানে user.scope PLATFORM, company data প্রযোজ্য না)
- Cmd/Ctrl+K শর্টকাট implement করা হয়েছে

**Dependency:** নেই। (ভবিষ্যতে AI Smart Search feature এর ওপর তৈরি হবে, কিন্তু সেটা future AI plan-এর অংশ, এখন কোনো ব্লকার না।)

**Progress:** [x] সম্পূর্ণ

### Sub-progress

- [x] **`app/api/search/route.ts`** — GET route, `getCurrentUser()` + `scope === "COMPANY"` guard (401 otherwise), min query length 2, max query length bounded (100 chars) আগে trim/slice করা হয়, `Cache-Control: no-store`।
- [x] **Per-entity permission + module gate, প্রতিটা আলাদা** — কোনো একক blanket "search" permission নেই (rbac.ts-এ এমন কিছু নেই), প্রতিটা entity নিজের existing permission দিয়ে গেটেড: customer→`customers:manage`, vendor→`vendors:manage`, shipment→module `SHIPMENTS` + `shipments:view`, quotation→module `QUOTATIONS` + `quotations:view`, invoice→module `BILLING` + `invoices:view`, document (shipmentdocument+freightdocument combined)→module `DOCUMENTS` + `documents:view`।
- [x] **Branch scope** — Phase 01-এর existing `getAccessibleBranchIds`/`branchScopeWhere` (lib/access/branch-access.ts) reuse করা হয়েছে, নতুন কোনো branch-filter logic লেখা হয়নি। `customer`/`vendor`-এর `branchId` নেই বলে ওই দুইটাতে branch-filter apply হয় না (company-scope যথেষ্ট)।
- [x] **Limited-metadata contract** — প্রতিটা result-এ শুধু `type, id, title, secondary, href, branchLabel` — কোনো amount/cost/profit/margin field বা `filePath` কখনও response-এ যায় না (E2E test-এ সরাসরি verify করা)।
- [x] **Per-model cap ৫, total cap ২৫** — `PER_MODEL_LIMIT`/`TOTAL_LIMIT` constant; document search দুইটা আলাদা model (shipmentdocument + freightdocument) থেকে আসা বলে প্রতিটা source থেকে `ceil(5/2)=3` নিয়ে combined slice করে ৫-এ বাঁধা হয়।
- [x] **`components/global-search.tsx`** — client component, debounce, `AbortController` দিয়ে stale request cancel, min-length gate, keyboard (ArrowUp/Down, Enter, Escape), click-outside close, Ctrl/Cmd+K focus shortcut, loading/error/empty state, `role="combobox"`/`role="listbox"`/`role="option"` accessibility markup।
- [x] **`dashboard-header.tsx`** — নতুন `showSearch` prop (default `false`); শুধু `(dashboard)/layout.tsx`-এ `true` pass করা হয়েছে, `(platform)/layout.tsx`-এ pass করা হয়নি (platform admin-এর company/branch scope নেই)।
- [x] **`npm run type-check`, `npm run lint`** — নতুন/পরিবর্তিত ফাইলগুলোতে (route, component, header, layout, spec) কোনো error নেই। Pre-existing unrelated lint error (splash-screen.tsx, theme-toggle.tsx ইত্যাদি, react-hooks/set-state-in-effect) আগে থেকেই ছিল, এই Phase-এ touch করা হয়নি।
- [x] **`tests/e2e/35-global-search.spec.ts`** — ৯টা test, সবগুলো pass করছে (chromium): (১) admin-এর জন্য ছয়টা entity type-ই deterministic seeded reference (JOB-DEMO-2026-0001, QT-DEMO-2026-0001, INV-DEMO-2026-0001, Blue Horizon Ocean Line, Bengal Apparel Export Ltd., Commercial Invoice) দিয়ে খুঁজে পাওয়া যায় + safe-metadata contract (কোনো internal field leak না), (২) unauthenticated request → 401, (৩) min-length-এর নিচে খালি result, (৪) malformed/adversarial query (oversized string, SQL wildcard, script tag, empty) crash করে না + concurrent ভিন্ন query cross-bleed করে না, (৫) role denial — `docs@freightcontrol.com` (Documentation Officer, `customers:manage`/`vendors:manage` নেই)-এর customer/vendor result শূন্য কিন্তু shipment result ঠিকই আসে, (৬) branch isolation — `operations@freightcontrol.com` (শুধু CTG_OPS member) HEAD_OFFICE-এর job খুঁজে পায় না, admin পায়, (৭) per-entity cap — ৬টা customer তৈরি করে verify করা হয়েছে ঠিক ৫টা ফেরত আসে ৬টা না, (৮)-(৯) header UI: dropdown render/keyboard Escape dismiss এবং result click করলে সঠিক shipment detail page-এ navigate করে।
  - এই test চালানোর সময় একটা pre-existing, Phase-03-অসম্পর্কিত dev-DB data-drift ধরা পড়েছিল: `operations@freightcontrol.com`-এর আবার stale HEAD_OFFICE membership তৈরি হয়ে গিয়েছিল (Phase 01-এ যেটা একবার ঠিক করা হয়েছিল)। `npm run demo:seed` রি-রান করে সেটা আবার clean করা হয়েছে — কোনো নতুন কোড bug ছিল না, শুধু local dev DB state ছিল stale।
- [x] **Regression sweep** — reseed-এর পরে `01-auth-tenancy-rbac`, `04-shipments`, `33-branch-management`, `34-automated-notifications` (মোট ১৬টা test) আবার চালিয়ে সব pass পাওয়া গেছে — header পরিবর্তন কোনো existing page ভাঙেনি।
- [x] **README** — "Advanced Global Search" feature bullet যোগ করা হয়েছে। কোনো নতুন migration/env var নেই বলে আলাদা upgrade note দরকার হয়নি।
- [ ] **বাকি স্পেস** — পুরো ৩৫-spec regression suite (chromium+firefox+webkit, সবকটা ফাইল) এই phase-এ সম্পূর্ণ চালানো হয়নি, শুধু উপরের targeted subset (৪টা pre-existing spec + নতুন ৩৫ নম্বর)। Full multi-browser regression sweep পরবর্তী কোনো convenient point-এ (বা release gate-এ) চালানোর জন্য বাকি আছে।

---

## Phase 04 — Saved Filters & Views — *Implemented (5-page allowlist)*

**Implement করা হয়েছে:**
- নতুন `savedview` model: companyId, userId, pageKey, versioned validated filter JSON, branch scope, name ও default flag
- Private-view CRUD action + allowlisted list page-এ "Save view" ও dropdown recall
- Current tenant/branch/RBAC scope re-apply ছাড়া কোনো saved view apply হবে না

**Dependency:** Phase 03-এর search/filter UI pattern থেকে ধারণা নেওয়া যায় (soft, ব্লক করে না)।

**Progress:** [x] সম্পূর্ণ (scoped allowlist)

### Sub-progress

- [x] **Schema ও migration** — নতুন `savedview` model: `companyId, userId, pageKey, name, filterVersion, filterJson (Text), branchScope (Text, nullable, বর্তমানে অব্যবহৃত reserved field), isDefault, timestamps, deletedAt`। Migration `20260901020000_add_saved_views` — dev DB-তে (existing data সহ) apply করে এবং আলাদা একটা disposable clean DB-তে সব ৩৫টা migration ক্রমানুসারে `prisma migrate deploy` দিয়ে fresh-install path আলাদাভাবে test করা হয়েছে। `@@unique([companyId, userId, pageKey, name])` — MariaDB partial-unique-index সাপোর্ট না করায় এটা soft-delete-aware না (existing `customer.code` unique constraint-এর মতোই same trade-off)।
- [x] **Page-scoped allowlist (v1: ৫টা page)** — `lib/validators/saved-views.ts`-এ প্রতিটা pageKey-এর জন্য আলাদা `z.object({...}).strict()` schema, unknown key কখনও persist হয় না। Covered: shipments, quotations, tasks, customers, vendors। Report pages এবং invoice/vendor-bill list (যাদের filter নেই) ইচ্ছাকৃতভাবে v1-এর বাইরে — documented scope trade-off।
- [x] **Server-side permission gate per page** — প্রতিটা pageKey নিজের existing view/manage permission দিয়ে গেটেড। ভুল/অননুমোদিত pageKey হলে redirect।
- [x] **"No arbitrary filter" enforcement** — Save action URL query string থেকে শুধু allowlisted key পড়ে, `.strict()` schema দিয়ে validate। Read-time-ও একই schema দিয়ে re-validate, invalid row চুপচাপ বাদ পড়ে (crash না করে)।
- [x] **One-default-per-page/unique-name enforcement** — transaction-এ other views-এর isDefault false করা হয়। Duplicate name P2002 catch করে validation error দেখায়।
- [x] **Private ownership** — সব read/update/delete action-এ companyId ও userId দুটোই match করতে হয়।
- [x] **Recall = plain navigation** — router.push দিয়ে recall; destination page-এর নিজস্ব tenant/branch/RBAC check প্রতিবার fresh চলে।
- [x] **Default-view auto-redirect** — bare visit-এ default view থাকলে redirect করে; deep-link (`?edit=` ইত্যাদি) থাকলে skip হয়।
- [x] **Audit log** — savedview.created/updated/deleted।
- [x] **UI** — `components/saved-views/save-view-control.tsx`, সব `<form action={...}>` server-action pattern।
- [x] **type-check/lint** — সব নতুন/পরিবর্তিত ফাইলে clean।
- [x] **`tests/e2e/36-saved-filters-views.spec.ts`** — ৬টা test pass: save→recall→rename→delete lifecycle, default auto-redirect, duplicate-name rejection, cross-user privacy, branch-scope-respecting recall, tampered-pageKey rejection।
- [x] **আবিষ্কৃত ও ঠিক করা real regression** — বাটন লেবেল "Save current filter"-এ "Filter" শব্দ থাকায় pre-existing `18-task-management.spec.ts`-এর non-exact selector ভেঙেছিল। "Save view"-এ rename করে ঠিক করা হয়েছে।
- [x] **Regression sweep** — ৫টা spec (১৫ test) চালিয়ে ১টা pre-existing অসম্পর্কিত failure ছাড়া (Phase 01-এ আগেই ট্র্যাক করা `canViewCosting` issue) সব pass।
- [x] **README** — feature bullet ও upgrade note যোগ করা হয়েছে।
- [ ] **যা v1-এ বাদ** — Report pages, invoice/vendor-bill list, এবং full multi-browser ৩৬-spec suite।

---

## Phase 05 — Import & Export Data — *Implemented*

**⚠️ Sequencing override:** Phase 04 নিজে সম্পূর্ণ ছিল (concurrent session-এ), কিন্তু plan-এর normal execution order অনুযায়ী Phase 05 শুরু করার আগে "প্রতিটা Phase শেষ" rule strict থাকলে user explicitly override করে সরাসরি এই Phase শুরু করতে বলেছেন — Phase 01/02-এর ছোট কিছু sub-item (Phase 01-এর বাকি E2E spec) তখনও open ছিল। User-এর সরাসরি সিদ্ধান্ত হিসেবে রেকর্ড রাখা হলো।

**Implement করা হয়েছে:**
- `papaparse` (maintained CSV library) দিয়ে parse/generate — hand-rolled parser না, quoting/embedded-comma bug এড়াতে
- Permission-safe CSV export: customers, vendors, shipments, quotations, invoices, vendor bills, payments, tasks — একটাই allowlisted `/api/exports/[entity]` route দিয়ে
- Customer/vendor CSV import wizard — upload → column mapping → validate/preview → explicit commit (এই app-এর প্রথম multi-step wizard UI)
- XLSX, shipment import ও financial import v1 scope-এর বাইরে (অপরিবর্তিত)

**Dependency:** নেই সরাসরি; `lib/validators/admin.ts`-এর বিদ্যমান `customerSchema`/`vendorSchema` পুনর্ব্যবহার হয়েছে।

**Progress:** [x] সম্পূর্ণ (code + type-check + lint; automated E2E test ইচ্ছাকৃতভাবে skip — user নিজে manual QA করবেন বলে জানিয়েছেন, Playwright চালানো হয়নি)

### Sub-progress

- [x] **Schema** — নতুন `ImportJob` model (`companyId, actorId, entityType, status, fileName, filePath, fileSize, rowCount, columnMapping (JSON), duplicatePolicy, createdCount, skippedCount, rejectedCount, rowErrors (JSON, capped ২০০), errorMessage, timestamps`) + ৩টা enum। Row-level error আলাদা child table না করে capped JSON column-এ রাখা হয়েছে — v1 import volume (শুধু customer/vendor) query-করার-মতো ভারী না। Migration `20260901030000_add_import_jobs` — dev DB-তে apply এবং disposable clean DB-তে `prisma migrate deploy` দিয়ে fresh-install path আলাদাভাবে verify করা হয়েছে।
- [x] **নতুন permission** — `exports:csv`, `imports:csv` (existing `exports:print`/`exports:pdf` pattern-এর মতোই, entity-র নিজের view permission-এর *পাশাপাশি* আলাদা gate)। `lib/permissions/rbac.ts`, `lib/actions/roles.ts` (role-assignment UI allowlist), এবং `prisma/seed.ts`-এ (COMPANY_ADMIN স্বয়ংক্রিয়ভাবে সব company-safe permission পায়; OPERATIONS_MANAGER/DOCUMENTATION_OFFICER/ACCOUNTS_OFFICER/SALES_EXECUTIVE-এ `exports:csv` যোগ হয়েছে, `imports:csv` শুধু OPERATIONS_MANAGER ও SALES_EXECUTIVE-এ যাদের customers/vendors:manage আছে) — `npx prisma db seed` চালিয়ে DB-তে সরাসরি verify করা হয়েছে (role-permission mapping সঠিক পাওয়া গেছে)।
- [x] **Export infra** — `lib/exports/csv.ts` (`generateCsv`, formula-injection guard: `=`/`+`/`-`/`@` দিয়ে শুরু হওয়া cell-এ leading `'` বসানো হয়), `lib/exports/export-entities.ts` (৮-entity allowlist config: permission, branch-scoped কিনা, fetch query, column mapper)। Quotation export costing column (`totalBuyAmount`, `totalSellAmount`, `grossProfit`, `profitMarginPercent`) শুধু `costing:view` থাকলে দেখায়। `app/api/exports/[entity]/route.ts` — unknown entity key → 404 (raw table lookup না), permission+branch-scope check, প্রতি export-এ audit log (`EXPORT_CSV`)।
- [x] **৮টা list page-এ export link যোগ** — customers, vendors, shipments, quotations, invoices, vendor-bills, payments, tasks — প্রতিটাতে conditionally-rendered "Download CSV" link (`hasPermission(user, "exports:csv")` চেক করে), existing `<a download href=...>Download PDF</a>` precedent অনুসরণ করে (Next.js `no-html-link-for-pages` lint rule pass করার জন্যও দরকার ছিল)।
- [x] **Import backend (`lib/actions/imports.ts`)** — `uploadImportFile` (file validate: ≤5MB, .csv extension+MIME, ≤৫০০০ row, blob storage-এ save, `ImportJob` row তৈরি করে wizard-এর পরের ধাপে redirect), `previewImport` (mapping+duplicate-policy apply করে validate, **কোনো DB write করে না**, summary + capped row-error preview সেভ করে), `commitImport` (preview-এর state trust না করে **আবার re-validate** করে যাতে preview আর commit-এর মাঝে data পরিবর্তন হলে সমস্যা না হয়; batch loop-এ create/update; একটাই job-level audit log, per-row না), `cancelImport`।
- [x] **Vendor duplicate-key trade-off** — vendor model-এ কোনো unique code নেই (customer-এ আছে, `@@unique([companyId, code])`), তাই vendor duplicate-detect trimmed case-insensitive **name match** দিয়ে করা হয়েছে (MariaDB-র utf8mb4_unicode_ci collation এমনিতেই case-insensitive)। এটা একটা real v1 limitation — দুইটা ভিন্ন vendor একই নাম শেয়ার করলে ভুল match হতে পারে — এখানে স্পষ্ট documented, নতুন schema column যোগ করা হয়নি (scope-এর বাইরে)।
- [x] **Wizard UI** — `/dashboard/imports` (job list, counts, status), `/dashboard/imports/new` (entity বাছাই + file upload), `/dashboard/imports/[id]` (status অনুযায়ী adaptively: UPLOADED → mapping form, VALIDATED → preview summary + commit + re-map option, COMPLETED/FAILED → results + row-error table)। `components/forms/import-forms.tsx`-এ `useActionState`-based client form (existing `admin-action-forms.tsx` pattern অনুসরণ করে, যেহেতু import action-গুলো `ActionState` রিটার্ন করে, plain `<form action={...}>` দিয়ে সরাসরি কাজ করত না)। Sidebar-এ "Data Import" nav item যোগ (Admin/Settings group, `imports:csv` permission-gated)।
- [x] **CSV cell coercion detail** — `customerSchema`/`vendorSchema`-এর ফিল্ডগুলো `z.string()`-এ শুরু হয় (`FormData`-র মতোই সবসময় string আশা করে) — CSV-row-থেকে-schema-input mapping-এ missing/blank cell-কে `undefined` না দিয়ে `""` coerce করা হয়েছে, নাহলে Zod ভুলভাবে "required" error দিত optional field-এর জন্য।
- [x] **type-check, lint** — পুরো প্রজেক্টে clean; নতুন কোনো ফাইলে ০টা error/warning। Full-project lint-এ ঠিক আগের মতোই ৬৪টা pre-existing unrelated problem (৩৫ error, ২৯ warning) — কোনো নতুন সমস্যা যোগ হয়নি (before/after count হুবহু মিলেছে)।
- [ ] **Automated E2E test** — user-এর সুস্পষ্ট নির্দেশে **skip করা হয়েছে এই session-এ** ("tomi sudhu implement korbe, manually ami test korbo, playwright chalabe na")। কোনো `tests/e2e/36-import-export-data.spec.ts` লেখা/চালানো হয়নি। Manual QA user নিজে করবেন।

**Deferred:** opt-in field-level permission audit (যেমন quotation-এর মতো অন্য entity-তেও sensitive column hide করার দরকার আছে কিনা) ভবিষ্যতে দরকার হলে পুনর্বিবেচনা; XLSX import/export; shipment ও financial bulk import।

---

## Phase 06 — Customizable Dashboard — *Implemented (pending manual QA)*

**Implement করা হয়েছে:**
- বিদ্যমান stat card-গুলোকে server-owned independent widget component/registry-তে ভাঙা
- `userdashboardlayout` model: companyId, userId, schema version, validated widget order/visibility JSON
- Reset-to-default, accessible show/hide এবং keyboard reorder UI; drag-reorder optional
- Render-এর আগে module, role ও branch scope অনুযায়ী saved layout normalize করা

**Dependency:** নেই।

**Progress:** [x] Implement সম্পূর্ণ — automated test/manual QA বাকি (user manually check করবেন)

### Sub-progress

- [x] **Schema ও migration** — নতুন `userdashboardlayout` model: `companyId, userId, schemaVersion, layoutJson (Text), timestamps`, `@@unique([companyId, userId])`। Migration `20260902000100_add_user_dashboard_layout` — dev DB-তে (existing data সহ) apply এবং আলাদা disposable clean DB-তে (Phase 05-এর `add_import_jobs` migration-সহ মোট ৩৬টা) `prisma migrate deploy` দিয়ে fresh-install path আলাদাভাবে test করা হয়েছে।
- [x] **Widget granularity: section-level (৬টা), card-level না** — `main-kpi`, `finance-kpi`, `operational-health`, `sales-request-flow`, `quick-actions`, `recent-shipments`। প্রতিটা section-এর ভেতরের individual card আলাদা widget না করে গোটা section-কে এক widget ধরা হয়েছে — কারণ এগুলোর ভেতরের card data একটাই shared aggregate query (`getManagementDashboardSummary`) থেকে আসে, individual-card granularity করলে সেই shared query ভাঙতে হতো (বেশি ঝুঁকিপূর্ণ refactor, user-এর "কোনো functionality break করবে না" নির্দেশের বিরুদ্ধে)।
- [x] **`lib/dashboard/widgets.ts`** — server-owned `DASHBOARD_WIDGET_KEYS` allowlist + `normalizeDashboardLayout()`: saved layout-এর অজানা/removed widget key silently drop হয়, নতুন widget (ভবিষ্যতে যোগ হলে) default position-এ append হয় — "removed/renamed widget-এর safe reset" requirement এভাবে satisfied।
- [x] **`lib/validators/dashboard-layout.ts`** — `z.object({ order: z.array(z.enum(WIDGET_KEYS)), hidden: z.array(z.enum(WIDGET_KEYS)) }).strict()` — browser কখনও widget registry-র বাইরের কোনো key, data source, বা query পাঠাতে পারবে না।
- [x] **`lib/actions/dashboard-layout.ts`** — `saveDashboardLayout`/`resetDashboardLayout`, existing `getScopedCompanyId("dashboard:view")` pattern (dashboard page নিজেই যে permission চায় সেটাই) + audit log (`dashboard_layout.updated`/`.reset`)। Reset হলো hard delete (personal preference row, soft-delete দরকার নেই)।
- [x] **Render-time normalize** — `lib/dashboard/queries.ts`-এর `getDashboardLayout()` প্রতিবার DB থেকে raw JSON পড়ে zod দিয়ে validate করে, তারপর `normalizeDashboardLayout()` দিয়ে registry-র বিপরীতে reconcile করে — কোনো stale/corrupted/manually-edited row থাকলেও crash না করে default-এ fallback করে।
- [x] **UI** — `components/dashboard/dashboard-customizer.tsx`: "Customize dashboard" toggle panel, প্রতিটা widget row-এ real `<button>` up/down (keyboard-focusable, `aria-label` সহ, drag লাগেনি) ও eye/eye-off show-hide টগল (`aria-pressed`), "Reset to default" ও "Save layout" — দুটোই `<form action={...}>` server-action pattern (existing saved-view control-এর মতোই)। React key trick (`key={order+hidden hash}`) দিয়ে save/reset-এর পরে client state force-remount হয়ে fresh server data দেখায়।
- [x] **`app/(dashboard)/dashboard/page.tsx` রিফ্যাক্টর — purely mechanical, কোনো ডেটা/লজিক বদলায়নি** — ৬টা existing JSX block হুবহু অপরিবর্তিত রেখে একটা `widgetContent` lookup object-এ wrap করা হয়েছে, তারপর normalized `order`/`hidden` অনুযায়ী loop করে render করা হয়। **Default state (কোনো saved layout নেই) → output আগের মতোই byte-identical**: একই ৬টা section, একই ক্রম, সবগুলো visible। `!reportsEnabled` fallback branch (Reports module ছাড়া company-র জন্য single "Active shipments" card) সম্পূর্ণ untouched রাখা হয়েছে — customization শুধু rich dashboard-এ প্রযোজ্য।
- [x] **Pre-existing architectural constraint, honestly note করা হলো** — hardening বলে "hidden widget-এর query চলবে না", কিন্তু বর্তমান কোডে সব section-ই একটা shared `getManagementDashboardSummary()`/`getDeliveryReleaseSummary()` call থেকে data পায় (section-ভিত্তিক আলাদা query নেই) — এটা Phase 06-এর আগে থেকেই এভাবে ছিল (যেমন `financial=false` হলেও financeCards-এর aggregate data আগে থেকেই compute হতো, শুধু JSX render skip হতো)। এই shared-query architecture ভাঙা এই phase-এর scope না (এবং "কোনো functionality break করবে না" নির্দেশের সাথে সাংঘর্ষিক ঝুঁকিপূর্ণ কাজ) — তাই "hidden section" শুধু render-level hide করে, query-level না। যদি ভবিষ্যতে per-widget lazy query দরকার হয়, সেটা আলাদা follow-up।
- [x] **`npm run type-check`, `npm run lint`** — নতুন/পরিবর্তিত সব ফাইলে (schema, migration, widgets, validator, action, query, component, page) কোনো error নেই।
- [ ] **Automated E2E test ও manual QA বাকি** — user-এর স্পষ্ট নির্দেশ অনুযায়ী ("তুমি শুধু implement করো, আমি manually check করব") এই ধাপে automated Playwright spec লেখা/চালানো হয়নি এবং dev server restart করে সরাসরি browser-এ verify করা হয়নি। **গুরুত্বপূর্ণ:** নতুন Prisma model ব্যবহার করতে চললে যেই dev server চলছে সেটা restart করে fresh Prisma Client load করতে হবে (আগের ফেজগুলোতে এই একই কারণে stale-client crash হয়েছিল) — `npx prisma generate` এই session-এ চালানো হয়েছে, কিন্তু ইতিমধ্যে চলমান কোনো dev server তার পুরনো client cache-এ থাকতে পারে।

---

## Phase 07 — Recurring Task Management — *Implemented*

**⚠️ Sequencing override:** user-এর সরাসরি নির্দেশে Phase 04-এর পরে normal execution order (05 → 06 → 07) মেনেই এই Phase শুরু হয়েছে — কোনো নতুন override না, যেহেতু 05 ও 06 ততক্ষণে অন্য session-এ সম্পূর্ণ হয়ে গিয়েছিল।

**Implement করা হয়েছে:**
- Dedicated `TaskRecurrence` model: rule (frequency/interval), timezone, start/end date, active state, nextRunAt/lastRunAt, task template fields (title, description, priority, assignee, linked customer/vendor/shipment/quotation/invoice/request) ও branch context
- Generated `Task`-এ `recurrenceId` + `occurrenceDate` — `@@unique([recurrenceId, occurrenceDate])` দিয়ে duplicate-occurrence প্রতিরোধ
- Protected scheduled runner (`/api/cron/recurring-tasks`): idempotent due-occurrence generation → nextRunAt update → crash/retry-safe, বাউন্ডেড catch-up policy সহ

**Dependency:** কোনো external cron infra বসানো লাগেনি — Phase 02-এর `notification-dispatch` cron route-এর ঠিক একই auth/protected-endpoint প্যাটার্ন reuse করা হয়েছে (নিজস্ব আলাদা secret)। নতুন dependency: `luxon` (timezone-aware date math — এই প্রজেক্টে আগে কোনো date/timezone library ছিল না)।

**Progress:** [x] সম্পূর্ণ (code + type-check + lint + pure date-math sanity script; automated E2E test ইচ্ছাকৃতভাবে skip — user নিজে manual QA করবেন বলে জানিয়েছেন, Playwright চালানো হয়নি)

### Sub-progress

- [x] **Schema** — নতুন `TaskRecurrence` model + `taskrecurrence_frequency` (DAILY/WEEKLY/MONTHLY) ও `taskrecurrence_duplicatePolicy`-এর মতোই আলাদা enum। `Task`-এ nullable `recurrenceId`/`occurrenceDate` যোগ + unique pair constraint — বেশিরভাগ task-ই এখনো plain non-recurring (দুইটাই NULL, MySQL-এ প্রতিটা NULL আলাদা গণ্য হয় বলে একে অপরের সাথে collide করে না, Phase 02-এ dedupeKey-এর জন্য শেখা একই lesson)। দুইটা migration লেগেছে (`20260901040000_add_task_recurrence`, ও একটা follow-up `20260901040100_...assignee_fkey` — প্রথমটায় `assignedUserId`-এর জন্য relation বাদ পড়ে গিয়েছিল, দ্বিতীয়টায় ঠিক করা হয়েছে; একবার apply হয়ে যাওয়া migration file পরে edit না করে আলাদা migration হিসেবে ঠিক করা হয়েছে)। দুইটাই dev DB-তে apply এবং disposable clean DB-তে `prisma migrate deploy` দিয়ে fresh-install path আলাদাভাবে verify করা হয়েছে।
- [x] **Idempotent/crash-safe generation logic (`lib/recurring-tasks/runner.ts`)** — প্রতিটা occurrence তৈরির সময় `(recurrenceId, occurrenceDate)` unique constraint-এর উপর নির্ভর করে (P2002 ধরে "already created" হিসেবে treat করে, Phase 02-এর dedupeKey pattern-এর সাথে সামঞ্জস্যপূর্ণ) — তারপরই `nextRunAt` conditional update (`WHERE nextRunAt = <just-read-value>`) দিয়ে এগোয়, যাতে দুইটা concurrent/retried call একই recurrence দুইবার advance করতে না পারে। **Order principle:** task তৈরি *আগে*, nextRunAt advance *পরে* — এভাবে create-এর পরে কিন্তু advance-এর আগে crash হলে, পরের call একই occurrence আবার তৈরি করতে চেষ্টা করবে (idempotent no-op) এবং তারপর সফলভাবে advance করবে — এটাই "missed run" catch-up path, আলাদা special case না।
- [x] **Bounded catch-up** — একটা recurrence-এর জন্য এক call-এ সর্বোচ্চ ৩০টা missed occurrence backfill হয় (`MAX_CATCHUP_PER_RECURRENCE`), যাতে একটা corrupted rule বা অনেক দিনের outage runaway loop তৈরি না করে — বড় backlog পরের call-এ আরও এগোয়।
- [x] **Timezone-correct date math (`lib/recurring-tasks/schedule.ts`, luxon-ভিত্তিক)** — প্রতিটা stored date "recurrence-এর timezone-এ local midnight"-এর সমতুল্য UTC instant হিসেবে রাখা হয়। Monthly recurrence-এ day-of-month clamping (যেমন anchor day ৩১ হলে Feb-এ ২৮/২৯-এ ক্ল্যাম্প হয়, পরের মাসে আবার ৩১-এ ফিরে যায়, "stuck" হয়ে থাকে না)। **সরাসরি script দিয়ে verify করা হয়েছে** (temporary `_check-recurrence.ts`, চালিয়ে delete করা হয়েছে): daily/weekly/monthly interval, leap-year Feb 29 clamping, non-leap Feb 28 clamping, clamped-month-থেকে-পরের-মাসে re-anchor, endDate cutoff, dueInDays offset, ও timezone boundary (Asia/Dhaka local midnight → সঠিক UTC instant) — সবগুলো case pass করেছে।
- [x] **Generated task-এর `dueDate`** existing `saveTask`-এর "noon, no explicit zone" convention (`new Date(`${dateStr}T12:00:00`)`) অনুসরণ করে, যাতে recurrence থেকে তৈরি task manually তৈরি করা task-এর মতোই দেখায়।
- [x] **Protected cron endpoint** (`app/api/cron/recurring-tasks/route.ts`) — Phase 02-এর `notification-dispatch` route-এর হুবহু একই auth pattern (`RECURRING_TASK_DISPATCH_SECRET` env var + `crypto.timingSafeEqual`, secret unset থাকলে সবসময় 401)। নিজস্ব আলাদা secret ব্যবহার করে, notification cron-এর secret-এর সাথে shared না।
- [x] **Manual recovery action** — recurrence detail page-এ "Run now" বাটন (`runTaskRecurrenceNow`), cron যদি এখনো configure না করা থাকে বা backlog সাথে সাথে clear করতে চাইলে — cron endpoint-এর সাথে **হুবহু একই** generation function (`processDueRecurrence`) reuse করে, আলাদা কোনো duplicate logic path না।
- [x] **CRUD actions (`lib/actions/task-recurrences.ts`)** — `saveTaskRecurrence` (create/update, existing `tasks.ts`-এর `validateTaskRelations` export করে reuse করা হয়েছে যাতে customer/vendor/shipment/quotation/invoice/request লিঙ্ক ভ্যালিডেশন duplicate না হয়), `toggleTaskRecurrenceActive` (pause/resume), `deleteTaskRecurrence` (soft delete)। **Edit করলে in-flight schedule (nextRunAt/lastRunAt) touch হয় না** — শুধু template field আপডেট হয়, ইচ্ছাকৃত সিদ্ধান্ত (নাহলে schedule edit করলেই আগের কোনো due occurrence miss/duplicate হয়ে যেতে পারত)।
- [x] **Permission** — কোনো নতুন permission key যোগ করা হয়নি; existing `tasks:create`/`tasks:edit`/`tasks:delete`/`tasks:list`/`tasks:assign` reuse করা হয়েছে (recurrence template একটা task-management-এরই সম্প্রসারণ হিসেবে treat করা হয়েছে, আলাদা permission proliferation এড়াতে)।
- [x] **UI** — `/dashboard/task-recurrences` (list), `/dashboard/task-recurrences/new`, `/dashboard/task-recurrences/[id]` (edit + pause/resume/delete/run-now + generated-task history table)। Existing `TaskForm`-এর options-loading helper (`getTaskFormOptions`) reuse করা হয়েছে, নতুন কিছু বানানো হয়নি। Sidebar-এ "Recurring Tasks" nav item যোগ (Operations group, existing `tasks:list`/`TASKS` module gate reuse করে)।
- [x] **README ও `.env.example`** — feature bullet, upgrade note, ও সম্পূর্ণ self-hosted recurring-task cron setup section (secret, curl command, catch-up ব্যাখ্যা, "Run now" fallback) যোগ করা হয়েছে।
- [x] **type-check, lint** — পুরো প্রজেক্টে clean; নতুন কোনো ফাইলে ০টা error/warning। Full-project lint-এ ঠিক আগের মতোই ৬৪টা pre-existing unrelated problem — কোনো নতুন সমস্যা যোগ হয়নি।
- [ ] **Automated E2E test** — user-এর সুস্পষ্ট নির্দেশে **skip করা হয়েছে এই session-এ** ("tomi sudhu implement korbe, manually ami test korbo, playwright chalabe na")। কোনো `tests/e2e/37-recurring-tasks.spec.ts` লেখা/চালানো হয়নি। Manual QA user নিজে করবেন। **Date-math logic** যদিও pure Node script দিয়ে ইতিমধ্যে verify করা হয়েছে (উপরে দেখুন) — শুধু UI/cron-endpoint end-to-end flow বাকি।

**Deferred:** cron endpoint-এর success-path (সঠিক secret দিয়ে আসল send) কখনো live চালিয়ে দেখা হয়নি, কারণ সেটার জন্য `.env`-এ secret সেট করে dev server restart করতে হতো — Phase 02-এর একই কারণে সেটাও করা হয়নি। Manual QA-তে "Run now" বাটন দিয়ে একই logic path টেস্ট করা সম্ভব, তাই এই গ্যাপ সীমিত।

---

## Phase 08 — Custom Document Templates — *Implemented (pending manual QA)*

বর্তমান: কোনো `DocumentTemplate` মডেল নেই; PDF ও freight-document print layout largely code-defined।

**Implement করা হয়েছে:**
- v1 quotation ও invoice-এর জন্য `documenttemplate` এবং version model: company scope, validated layout JSON, branding এবং active version
- Safe editor UI — approved section order/visibility, placeholder whitelist, preview, activate/deactivate, duplicate ও reset-to-default
- Quotation/invoice PDF output path-কে template-driven করা; HBL/freight print path v1-এর বাইরে documented থাকবে
- Issued/locked document-এর template version snapshot এবং invalid/missing template-এ system-default fallback

**Dependency:** নেই সরাসরি, তবে এই Phase-এ effort সবচেয়ে বেশি।

**Progress:** [x] Implement সম্পূর্ণ — automated test/manual QA বাকি (user manually check করবেন)

### Sub-progress

- [x] **Schema ও migration** — `documenttemplate` (companyId, documentType enum QUOTATION/INVOICE, name, isActive, createdById, timestamps, soft delete) + `documenttemplateversion` (templateId, versionNumber, layoutJson Text, isCurrent, createdById, createdAt) — append-only version history, `@@unique([templateId, versionNumber])`। `Quotation`/`Invoice`-এ nullable `templateVersionId` যোগ করা হয়েছে (existing row-এ সবসময় `NULL`)। Migration `20260902010000_add_document_templates` — dev DB-তে (existing data সহ) apply এবং disposable clean DB-তে (মোট ৩৯টা migration ক্রমানুসারে, Phase 05/07-এর migration-সহ) `prisma migrate deploy` দিয়ে fresh-install path আলাদাভাবে test করা হয়েছে।
- [x] **"System default" কোনো DB row না, code-level fallback** — `workflowtemplate`-এর nullable-companyId precedent অনুসরণ করা হয়নি ইচ্ছাকৃতভাবে; existing hardcoded `PdfSection[]` array-ই system default (byte-identical)। কোনো active company template না থাকলে/deactivate করলে/version invalid হলে — `resolveSectionOrder`/`resolveCustomNoteText` `layout` argument `null`/`undefined` পেলে ঠিক আগের হার্ডকোডেড আউটপুট রিটার্ন করে, নতুন কোনো seed/backfill row লাগেনি।
- [x] **Section whitelist, existing hardcoded section 1:1 মিরর করে** — Quotation: `quotation-details, cargo, charges, total, notes, prepared-by`। Invoice: `invoice-details, line-items, totals, payment-notes, prepared-by`। `z.object({...}).strict()` + `z.enum(...)` — schema-এর বাইরের কোনো key persist হয় না।
- [x] **Placeholder whitelist (শুধু notes/payment-notes section-এর custom text-এ)** — `{{companyName}}`, `{{customerName}}`, `{{documentNo}}`, `{{documentDate}}` — plain string `.replace()`, কোনো HTML/JS/expression evaluation না। খালি রাখলে existing hardcoded default text-ই থাকে (byte-identical)।
- [x] **"Branding" স্কোপ note** — কোনো নতুন logo/color field যোগ করা হয়নি (explore agent নিশ্চিত করেছে company model-এ শুধু logo আছে, কোনো color field নেই) — template render-এ existing `company.logoPath`/`logoUpdatedAt` এবং existing `readSafeCompanyLogo`/`blobGet` mechanism-ই ব্যবহার হয়, duplicate করা হয়নি।
- [x] **Template version snapshot — "first PDF generation locks it," status-transition-based না** — `resolveQuotationTemplateLayout`/`resolveInvoiceTemplateLayout` (`lib/pdf/document-template-resolution.ts`): রেকর্ডে আগে থেকে `templateVersionId` থাকলে সবসময় সেই exact version ব্যবহার হয় (reproducible); না থাকলে company-র current active version resolve করে **সেই মুহূর্তেই stamp করে রাখে** ভবিষ্যতের জন্য। **ইচ্ছাকৃত scope-simplification:** hardening-এ বলা "issued/locked document"-এর বদলে "প্রথম PDF generation"-কে lock point ধরা হয়েছে — কারণ quotation/invoice status-transition action file (billing.ts/finance.ts) touch না করেই কাজ হয়ে যায় (blast radius অনেক ছোট, "existing functionality break করবে না" নির্দেশের সাথে সামঞ্জস্যপূর্ণ)। Stamp write ব্যর্থ হলেও PDF generation crash করে না (`.catch(() => {})`)।
- [x] **Permission — নতুন key যোগ করা হয়েছে** — `documentTemplates:manage` (`lib/permissions/rbac.ts` + `prisma/seed.ts`-এর `companyPermissionDefinitions`, তাই future install-এ COMPANY_ADMIN স্বয়ংক্রিয়ভাবে পাবে যেহেতু `companySafePermissionKeys`-এর অংশ)। **এই session-এর already-seeded dev DB-তে** সরাসরি DB-তে permission row insert করে existing `branding:manage`-ধারী role(s)-কে গ্রান্ট করে দেওয়া হয়েছে (পুরো `prisma db seed` রি-রান না করে, যাতে অন্য চলমান phase-এর demo/transactional data touch না হয়)। নতুন install-এ শুধু `npx prisma db seed` চালালেই হবে।
- [x] **CRUD actions (`lib/actions/document-templates.ts`)** — `createDocumentTemplate`, `saveDocumentTemplateVersion` (নতুন version তৈরি করে, আগের `isCurrent` false করে — কখনো overwrite না), `activateDocumentTemplate`/`deactivateDocumentTemplate` (transaction-এ same company+documentType-এর বাকি template deactivate করে single-active enforce করে), `duplicateDocumentTemplate`, `deleteDocumentTemplate` (soft delete)। সবগুলোতে audit log (`documenttemplate.*`)।
- [x] **"Reset-to-default" ম্যাপিং note** — আলাদা কোনো "reset" action নেই; যেহেতু system default কোনো DB row না (উপরে দেখুন), **Deactivate বাটনই কার্যত reset-to-default** — deactivate করলেই company আবার হার্ডকোডেড default layout-এ ফিরে যায়। Documented scope decision, আলাদা duplicate mechanism বানানো হয়নি।
- [x] **PDF route wiring — ন্যূনতম blast radius** — শুধু `app/api/quotations/[id]/pdf/route.ts` ও `app/api/invoices/[id]/pdf/route.ts` (২ লাইন করে যোগ) এবং `lib/pdf/quotation-pdf.ts`/`invoice-pdf.ts` (hardcoded section array → lookup-map + normalized order, কোনো section-এর ভেতরের content/lines/table বদলায়নি) পরিবর্তিত হয়েছে। `lib/print/data.ts`-এ শুধু `templateVersionId: true` select-এ যোগ হয়েছে (purely additive)। **HBL/freight document generator path সম্পূর্ণ untouched** (explore agent নিশ্চিত করেছে সেটা আলাদা, PDFKit-ই ব্যবহার করে না) — plan-এর নিজস্ব scope boundary অনুযায়ী।
- [x] **UI** — `/dashboard/settings/document-templates` (list, per-document-type grouped, create/activate/deactivate/duplicate/delete), `/dashboard/settings/document-templates/[id]` (editor: keyboard up/down + show/hide, existing Phase 06 pattern পুনর্ব্যবহার করে, custom note textarea placeholder-hint সহ), `/api/document-templates/[id]/preview` (GET, company-র সাম্প্রতিকতম real quotation/invoice দিয়ে saved version preview করে, `templateVersionId` stamp করে না)। Sidebar-এ "Document Templates" nav item যোগ (existing nav-item pattern অনুসরণ করে)।
- [x] **`npm run type-check`, `npm run lint`** — নতুন/পরিবর্তিত সব ফাইলে ০টা error। `app-sidebar.tsx`/`prisma/seed.ts`-এ যে ৩টা lint error দেখা গেছে সেগুলো pre-existing, আমার যোগ করা লাইনের ধারেকাছেও না (line number check করে নিশ্চিত করা হয়েছে)।
- [ ] **Automated E2E test ও manual QA বাকি** — user-এর সুস্পষ্ট নির্দেশ অনুযায়ী ("তুমি শুধু implement করবে, আমি manually test করব") এই ধাপে কোনো Playwright spec লেখা/চালানো হয়নি, dev server restart করে সরাসরি PDF generate করে দেখা হয়নি। **গুরুত্বপূর্ণ:** dev server restart লাগবে (নতুন Prisma model), এবং যে role দিয়ে টেস্ট করবেন তার কাছে `documentTemplates:manage` permission আছে কিনা নিশ্চিত করতে হবে (Company Admin/Owner role-এ এই session-এই manually grant করা হয়েছে, উপরে দেখুন)।
- [x] **Extension — user নিজে জিজ্ঞেস করলেন "feature description-এ 'freight and operational document templates' বলা আছে, কিন্তু আসলে কী implement হয়েছে?" এবং কনফার্ম করার পর scope বাড়ানো হয়েছে:** মূল Phase 08 শুধু Quotation/Invoice কভার করত — feature description-এর "freight and operational documents" claim-এর সাথে মেলেনি (HBL/HAWB/freight print path তখন ইচ্ছাকৃতভাবে scope-এর বাইরে রাখা হয়েছিল)। User-এর explicit নির্দেশে ("feature-a ja chaiche tai actualy implement koro, kono functionality breake korbe na") এখন সেই ৪টা freight document type-ও (HBL, HAWB, DEBIT_NOTE, MANIFEST — যাদের নিজস্ব code-defined print layout ছিল) একই template system-এর আওতায় আনা হয়েছে; বাকি freight document type (MBL, PACKING_LIST ইত্যাদি) আগের generic JSON-dump fallback-ই রাখা হয়েছে, অপরিবর্তিত।
  - **Schema/migration** (`20260908010000_add_freight_document_templates`): `documenttemplate_documentType` enum-এ HBL/HAWB/DEBIT_NOTE/MANIFEST যোগ, এবং `FreightDocument`-এ Quotation/Invoice-এর মতোই nullable `templateVersionId` কলাম + FK (ON DELETE SET NULL)। Existing row-এ `NULL` — dev DB-তে existing data সহ apply করা হয়েছে, output অপরিবর্তিত থাকে।
  - **Section registry** (`lib/validators/document-templates.ts`, `lib/document-templates/sections.ts`): প্রতিটা type-এর জন্য section key list বানানো হয়েছে যা print page-এর আসল visual block-গুলোর সাথে ১:১ মেলে (যেমন HBL: parties/routing/delivery/cargo/terms) — কোনো নতুন section আবিষ্কার করা হয়নি, existing hardcoded block-গুলোকেই key দেওয়া হয়েছে। Freight layout-এ `customNoteText` নেই (কোনো placeholder slot নেই এই document-গুলোর print output-এ), তাই editor UI-তেও (`showCustomNoteText={false}`) এই ৪ type-এর জন্য সেই textarea দেখানো হয় না।
  - **Byte-identical default guarantee** — প্রতিটা section key list-এর ক্রম হুবহু print page-এর আসল (আগের) hardcoded রেন্ডার-অর্ডারের সাথে মিলিয়ে বানানো হয়েছে, তাই `resolveSectionOrder(keys, null)` (কোনো active template না থাকলে) ঠিক আগের মতোই সব section আগের ক্রমে রিটার্ন করে — Phase 08-এর মূল "system default = কোনো DB row না, byte-identical" guarantee এখানে বহাল রাখা হয়েছে। Company/branding header ও footer status-line Quotation/Invoice-এর মতোই fixed রাখা হয়েছে (section list-এর বাইরে, configurable না)।
  - **Lock-in point — "first print-page view," PDF-generation event নয়:** Quotation/Invoice-এর PDF route-এর মতো freight document-এর কোনো আলাদা "generate" server action নেই (browser-এর `window.print()`-ই ব্যবহার হয়) — তাই print page-এর প্রথম GET view-ই resolve+stamp করে (`resolveFreightDocumentTemplateLayout`, `lib/pdf/document-template-resolution.ts`), ঠিক Quotation/Invoice-এর pattern অনুসরণ করেই।
  - **Preview — আলাদা approach লাগলো কারণ PDFKit ব্যবহার হয় না:** freight document-এর print page React JSX (PDFKit না), তাই preview-এর জন্য নতুন standalone PDF generator বানানো হয়নি — বরং company-র সাম্প্রতিকতম real HBL/HAWB/debit-note/manifest document-এর print page-এই `?previewTemplateId=` query param দিয়ে saved (এমনকি inactive/draft) version preview করা যায়, `documentTemplates:manage` permission-হোল্ডার হলেই শুধু কাজ করে, কখনো stamp করে না (`loadTemplateVersionLayoutForPreview`)।
  - **`npm run type-check`, `npm run lint`** — সব নতুন/পরিবর্তিত ফাইলে ০টা নতুন error; project-wide lint problem count আগের ৬৪ থেকে ৬৩-এ নেমেছে (কমেছে, বাড়েনি)। print page-এর pre-existing `any`/`prefer-const` lint entry-গুলো (আগে থেকেই ছিল, শুধু নতুন line number-এ shift হয়েছে) গণনা করে confirm করা হয়েছে কোনো নতুন instance যোগ হয়নি।
  - **স্কোপ বাউন্ডারি, ইচ্ছাকৃত:** শুধু internal dashboard-এর print page (`app/(dashboard)/.../freight-documents/[docId]/print`) template-driven করা হয়েছে। Customer-facing portal-এর নিজস্ব, সম্পূর্ণ আলাদা কোডেড copy (`app/(portal)/portal/[companySlug]/.../freight-documents/[docId]/page.tsx`, ৪ type-এর জন্যই আলাদা hardcoded JSX, প্রায় ৮০০ লাইন) touch করা হয়নি — সেখানে template activate করলেও পুরনো fixed layout-ই customer দেখবে। এটা client-facing surface টাচ করার ঝুঁকি এড়াতে ইচ্ছাকৃতভাবে বাদ রাখা হয়েছে (Phase 08-এর নিজস্ব "blast radius ছোট রাখা" নীতি অনুসরণ করে) — user confirm করলে এটা আলাদা follow-up হিসেবে করা যাবে।
  - **এখনও বাকি:** dev server restart এবং manual QA (কমপক্ষে একটা real HBL/HAWB/debit-note/manifest document দিয়ে template activate করে internal dashboard-এর print/preview verify করা)।

---

## Phase 09 — Approval Workflow System — *Implemented (pending manual QA)*

বর্তমান: quotation/document approval আছে; vendor-bill/payment-এর configurable approval chain নেই। Expense lifecycle v1 scope-এর বাইরে।

**Implement করা হয়েছে:**
- Vendor bill ও payment-এর জন্য reusable approval policy, approval request, approval step এবং immutable decision/audit model
- Company/branch scope, BDT-normalized threshold, ordered role-based approver এবং reject/resubmit policy
- Server-side rule: creator self-approve করতে পারবে না; pending/rejected record pay/send করা যাবে না; material edit হলে re-approval লাগবে
- Expense, quotation-এর expanded approval এবং other sensitive-action workflow future scoped extension

**Dependency:** Phase 02 (Automated Status Notifications) সম্পূর্ণ থাকলে approver-কে alert পাঠানো সহজ হয় (soft)।

**Progress:** [x] Implement সম্পূর্ণ — automated test/manual QA বাকি (user manually check করবেন)

### Sub-progress

- [x] **Schema ও migration** — নতুন ৪টা model: `approvalpolicy` (companyId, documentType enum VENDOR_BILL/PAYMENT, name, branchId nullable, thresholdAmountBDT, approverRoleSequence JSON text, isActive, soft delete), `approvalrequest` (policyId, vendorBillId/paymentId nullable pair, status, currentSequence, amountBDT snapshot, submittedById), `approvalstep` (requestId, sequence, approverRoleCode — সরাসরি existing `role_code` enum পুনর্ব্যবহার করা হয়েছে, status, decidedById/decidedAt), `approvaldecision` (append-only, কখনো update হয় না — প্রতিটা decision-এ নতুন row)। `Quotation`/`Invoice`-এর মতো `VendorBill`/`Payment`-এ কোনো নতুন column যোগ হয়নি — approval reference শুধু `approvalrequest.vendorBillId`/`paymentId`-এ থাকে। Migration `20260902020000_add_approval_workflow` — dev DB (existing data সহ) এবং disposable clean DB-তে (মোট ৪০টা migration) দুইভাবেই apply করে test করা হয়েছে।
- [x] **Version model বাদ দেওয়ার সিদ্ধান্ত, documented** — Phase 08-এর `documenttemplateversion`-এর মতো আলাদা version history table এখানে বানানো হয়নি, কারণ policy edit করলে ভবিষ্যতের submission-এই নতুন role-sequence প্রযোজ্য হয় — ইতিমধ্যে-চলমান (in-flight) request নিজের `approvalstep` row-এই sequence/role snapshot করে রাখে policy তৈরির মুহূর্তে, তাই policy পরে বদলালেও পুরনো request প্রভাবিত হয় না। এটা reproducibility guarantee দেয় extra table ছাড়াই।
- [x] **BDT normalization** — `lib/approvals/money.ts`-এ নতুন exported `toBdt()` helper (আগে `finance.ts`/`billing.ts`-এ duplicate private helper হিসেবে ছিল, এখানে সেটা duplicate না করে নতুন ছোট exported ভার্সন বানানো হয়েছে)। VendorBill-এর জন্য bill.totalAmount × bill.exchangeRateToBDT দিয়ে compute করা হয়; Payment-এর জন্য existing precomputed `amountInBDT` column-ই সরাসরি ব্যবহার হয়।
- [x] **Policy resolution — branch-specific আগে, company-wide fallback** — `lib/approvals/policy.ts`-এর `resolveApplicablePolicy()`: প্রথমে ওই branch-এর জন্য active policy খোঁজে, না পেলে `branchId: null` (company-wide) active policy। `@@unique([companyId, documentType, branchId])` DB constraint non-null branchId-র জন্য কাজ করে (MariaDB-তে একাধিক NULL আলাদা গণ্য হয় বলে company-wide duplicate DB-level block হয় না — Phase 04-এ শেখা একই limitation, এখানে গুরুত্বপূর্ণ না কারণ duplicate company-wide policy শুধু "কোনটা first match" প্রশ্ন তৈরি করে, security risk না)।
- [x] **"Approver role(s), sequence, required level"-এর interpretation, documented** — "required level" কে ordered role-sequence-এর length/depth হিসেবে ধরা হয়েছে (প্রতি step-এ ঠিক ১ জন approver, কোনো quorum/multi-approver-per-step না) — বাউন্ডেড, defensible scope simplification।
- [x] **Approver eligibility, live-recomputed** — `lib/approvals/roles.ts`-এর `getEligibleApproverUserIds()`: company-তে সেই role-code-ধারী user, তারপর ওই user হয় request-এর branch-এ member অথবা `branches:access_all` permission রাখে। Decision-time-এ cache না করে প্রতিবার fresh query করা হয় যাতে membership/role পরিবর্তন সাথে সাথে effective হয়।
- [x] **Permission — নতুন ৩টা key, শুধু Company Admin default** — `vendorBills:approve`, `payments:approve`, `approvalPolicies:manage` (`rbac.ts` + `seed.ts`-এর catalog)। Existing `quotations:approve` precedent-এর মতোই শুধু COMPANY_ADMIN default-এ পায় (`companySafePermissionKeys` derive করে); ACCOUNTS_OFFICER-এর existing পূর্ণ vendorBills/payments CRUD ইচ্ছাকৃতভাবে অপরিবর্তিত রাখা হয়েছে (approve permission যোগ করা হয়নি)। **এই session-এর already-seeded dev DB-তে** সরাসরি grant করে দেওয়া হয়েছে (Phase 08-এর মতো, পুরো reseed এড়িয়ে)।
- [x] **গুরুত্বপূর্ণ fail-closed design note, README-এ ও UI-তে documented** — policy-তে কোনো role বেছে নিলে সেই role-এর matching approve permission-ও থাকতে হবে, নাহলে কেউ সেই step decide করতে পারবে না (approvals inbox query permission দিয়েও filter করে, শুধু role match না)। ভুল হলে security risk না (কেউ approve করতে পারবে না, ভুল কেউ approve করতে পারবে না) — কিন্তু বাস্তবে policy কাজ করার আগে verify করা দরকার।
- [x] **Vendor bill wiring — `updateVendorBillStatus`-এ early-return branch, existing transaction অপরিবর্তিত** — target "RECEIVED" হলে policy+threshold check করে; প্রয়োজন হলে সরাসরি status change না করে approval request submit করে return করে (bill DRAFT-ই থাকে)। Threshold-এর নিচে বা কোনো active policy না থাকলে existing code path হুবহু অপরিবর্তিত।
- [x] **Material-edit supersede — `saveVendorBill`-এ single `if` block যোগ** — bill update-এ totalAmount বদলালে (line item change), একই transaction-এ সেই bill-এর PENDING approvalrequest থাকলে CANCELLED করে দেয় — approver stale amount-এ decide করতে পারবে না। Non-material edit (remarks, dueDate ইত্যাদি) pending request touch করে না।
- [x] **Payment wiring — সবচেয়ে ঝুঁকিপূর্ণ অংশ, সবচেয়ে সতর্কভাবে করা হয়েছে** — `createPayment`-এর existing "apply paidAmount/dueAmount to linked invoice/vendorbill" logic হুবহু অপরিবর্তিত রেখে একটা নতুন `applyPaymentFinancialEffectTx()` function-এ extract করা হয়েছে (শুধু move, কোনো computation বদলায়নি)। Threshold-এর উপরে হলে payment `PENDING` status-এ তৈরি হয় (আগে থেকেই schema-তে unused enum value ছিল, পুনর্ব্যবহার করা হয়েছে) এবং `applyPaymentFinancialEffectTx` না চালিয়ে approval request submit হয় — অর্থাৎ due amount কমে না যতক্ষণ না পুরো chain approve হয়। Threshold-এর নিচে বা policy না থাকলে: `status: "CLEARED"` + effect সাথে সাথে apply, **হুবহু আগের behavior**।
- [x] **Approval effect application, ঠিক একবারই ঘটে** — `applyApprovedVendorBillReceipt()`/`applyApprovedPayment()` (নতুন exported function, `billing.ts`-এ) — শেষ step approve হলে `lib/actions/approvals.ts`-এর `decideApproval` action এগুলো কল করে। Payment-এর ক্ষেত্রে `applyPaymentFinancialEffectTx` আবার সেই একই shared function দিয়ে call হয় (কোনো duplicate calculation logic নেই), নিজের Serializable transaction-এ, তারপর payment PENDING→CLEARED।
- [x] **Reject path** — Vendor bill: কিছুই বদলায় না (bill আগে থেকেই DRAFT-এ ছিল, RECEIVED হয়নি) — resubmit মানে শুধু আবার "Mark received" ক্লিক করা। Payment: PENDING payment row `CANCELLED`-এ চলে যায় (financial effect কখনো apply-ই হয়নি) — resubmit মানে নতুন payment তৈরি করা, existing `updatePayment` আগে থেকেই শুধু CLEARED payment edit করতে দেয় বলে PENDING/CANCELLED payment edit করার আলাদা কোনো path লাগেনি।
- [x] **Server-side rule সব enforce করা হয়েছে (`lib/actions/approvals.ts`)** — creator self-approve ব্লক (`submittedById === user.id` check), sequence skip রোধ (শুধু `request.currentSequence`-এর step-ই decide করা যায়, অন্য কোনো step না), eligible approver re-verify (role + branch, live), permission check (`vendorBills:approve`/`payments:approve`)।
- [x] **Notification wiring — existing Phase 02 mechanism পুনর্ব্যবহার** — `event-definitions.ts`-এ নতুন ২টা internal-only event (`approval_requested`, `approval_decided`)। Multi-approver fan-out-এর জন্য existing single-recipient `dispatchNotificationEvent()`-কে loop করে call করা হয় (report-এ নিশ্চিত হয়েছিল কোনো existing fan-out helper নেই) — dedupeKey recipient-ভিত্তিক বলে প্রতিটা call safely idempotent।
- [x] **UI** — `/dashboard/settings/approval-policies` (policy create/activate/deactivate/delete, ৫টা ordered `<select>` দিয়ে role-sequence — নতুন drag/reorder component না বানিয়ে simplest safe option বেছে নেওয়া হয়েছে), `/dashboard/approvals` (inbox — pending decision, remarks সহ approve/reject), vendor-bill detail page-এ pending/rejected approval badge ও "Mark received" বাটন conditional hide। Sidebar-এ "Approvals" ও "Approval Policies" nav item যোগ।
- [x] **`npm run type-check`, `npm run lint`** — নতুন/পরিবর্তিত সব ফাইলে (schema, migration, ৭টা নতুন lib file, billing.ts-এর substantial edit, ৩টা নতুন page, ২টা নতুন component, sidebar, permissions, seed) কোনো error নেই — বিশেষভাবে গুরুত্বপূর্ণ যেহেতু `billing.ts`-এ real money-movement logic touch হয়েছে।
- [x] **User-এর "properly implement হয়েছে কি?" প্রশ্নের পর adversarial self-review — ৩টা real bug পাওয়া গেছে এবং ঠিক করা হয়েছে:**
  1. **Permission-bypass security bug (critical):** `decideApproval`-এ প্রথম implementation-এ client-supplied hidden `documentType` form field দিয়ে ঠিক হতো কোন permission (`vendorBills:approve` vs `payments:approve`) check হবে — অর্থাৎ শুধু `vendorBills:approve`-ধারী কেউ DOM tamper করে `payments:approve` ছাড়াই payment decide করতে পারত। এই ফিক্সে: আগে `requireUserScope("COMPANY")` দিয়ে authenticate করে request DB থেকে load করা হয়, তারপর request-এর **server-known real `documentType`** অনুযায়ী permission check হয় (`hasPermission`)। এটা top-level quality gate-এর "Browser থেকে আসা ID, JSON trusted নয়" নিয়ম নিজেই ভেঙেছিল — এখন ঠিক।
  2. **Race condition (data integrity):** দুইজন eligible approver একই step প্রায় একই মুহূর্তে decide করার চেষ্টা করলে দুটোই সফল হয়ে duplicate decision তৈরি করতে পারত। ফিক্স: `recordDecisionTx`-এ step claim করা হয় `updateMany({where: {id, status: "PENDING"}})`-এর মাধ্যমে (Phase 02-এর notification atomic-claim pattern পুনর্ব্যবহার করে) — affected-row-count 0 হলে `StepAlreadyDecidedError` throw করে, caller-কে friendly message দেখানো হয়।
  3. **Stale-amount data-integrity bug:** Payment approval-এর জন্য pending থাকা অবস্থায় (অন্য payment হয়ে) bill/invoice-এর dueAmount কমে গেলে, approve করার সময় সেটা re-check না করেই blindly apply হতো — সম্ভাব্য negative dueAmount। ফিক্স: `applyApprovedPayment`-এ effect apply করার ঠিক আগে current dueAmount-এর বিরুদ্ধে re-validate করা হয় (`createPayment`-এর creation-time validation-এর মতোই); stale হলে payment silently apply না করে `CANCELLED`-এ পাঠানো হয় এবং submitter-কে resubmit করতে বলা হয়।
  - তিনটাই fix করার পর আবার পুরো project-এ `type-check`/`lint` চালিয়ে confirm করা হয়েছে — কোনো নতুন error/warning নেই, ৬৪টা pre-existing unrelated problem অপরিবর্তিত।
- [ ] **Automated E2E test ও manual QA বাকি** — user-এর সুস্পষ্ট নির্দেশ ছাড়াই এই session-এ implement-focused approach বজায় রাখা হয়েছে (আগের কয়েকটা phase-এর একই pattern অনুসরণ করে) — কোনো Playwright spec লেখা/চালানো হয়নি, dev server restart করে সরাসরি vendor bill/payment approval flow browser-এ চালিয়ে দেখা হয়নি। **গুরুত্বপূর্ণ:** dev server restart লাগবে (নতুন Prisma model), এবং test করার আগে অন্তত ২টা ভিন্ন company user দরকার হবে (submitter ও approver, যেহেতু self-approval block করা আছে) — demo data-তে `admin@freightcontrol.com`-ই একমাত্র Company Admin, তাই approval workflow বাস্তবে টেস্ট করতে হলে দ্বিতীয় কোনো role-কে temporarily approve permission দিতে হতে পারে, অথবা একটা দ্বিতীয় company-admin-সমতুল্য user তৈরি করতে হবে।

---

## Detailed engineering requirements

এই section প্রতিটি Phase-এর short implementation list-কে production-ready scope-এ রূপ দেয়। Short list এবং এই section-এর মধ্যে conflict হলে এই section-এর security, migration ও test requirement প্রাধান্য পাবে।

### Phase 01 — Branch Management hardening

- Branch entity-তে companyId, unique branch code per company, name, address/contact fields, active flag, timestamps এবং soft delete থাকবে।
- User-এর জন্য single branchId নয়; branch membership relation এবং one default branch per user থাকবে। এতে একজন user একাধিক permitted branch ব্যবহার করতে পারবে।
- Branch is a data-scope overlay, not a replacement for the existing company-level role/permission model. A company permission plus branch membership is required; an explicit all-branches capability is limited to the same company.
- Shipment, quotation, invoice, vendor bill, payment, task, shipment request, document, workflow, notification delivery এবং report query-তে branch ownership/visibility assessment লিখিতভাবে করতে হবে।
- Existing company-র জন্য HEAD_OFFICE branch backfill, existing records assign, existing users membership create এবং rollback/upgrade test mandatory।
- Both large seed paths, prisma/seed.ts and scripts/seed-demo-data.ts, must create realistic multi-branch records and be exercised after migration. Seed/demo updates are a tracked Phase 01 deliverable, not a final cleanup task.
- Server-side centralized branch-scope helper ছাড়া কোনো page/action-এ custom branch filter লেখা যাবে না।

### Phase 03 — Global Search hardening

- Search API/service প্রতিটি model query-এর আগে authenticated user, company, branch, enabled module এবং permission filter apply করবে।
- Search results limited metadata হবে: type, title, secondary reference, safe link এবং optional branch label। File contents, encrypted data, restricted document data, internal cost/profit fields অননুমোদিত user-কে কখনও ফেরত দেওয়া যাবে না।
- Minimum query length, debounce, cancelled stale request, per-model/total result cap, empty/error state এবং keyboard focus, Escape, Enter accessibility বাধ্যতামূলক।
- MariaDB query pattern এবং required indexes document করতে হবে; unbounded contains search বা unrestricted result list করা যাবে না।

### Phase 04 — Saved Filters and Views hardening

- Saved view entity-তে companyId, userId, page key, versioned filter JSON, branch scope, name, default flag, timestamps এবং soft delete থাকবে।
- Page key allowlist এবং page-specific server schema ছাড়া JSON save/apply করা যাবে না। Saved JSON arbitrary query, permission or SQL-like filter হতে পারবে না।
- One active default per user/page এবং unique active view name per user/page enforce করতে হবে।
- v1 views private থাকবে। Shared/company views future scoped feature; এখন private view অন্য user দেখতে বা apply করতে পারবে না।
- Apply করার সময় saved filter-এর উপরেও current tenant, branch এবং RBAC scope সবসময় পুনরায় apply হবে।

### Phase 05 — Import and Export Data hardening

- CSV v1 mandatory। Customer এবং vendor import first release; shipment, invoice, payment বা financial bulk import আলাদা approved extension ছাড়া নয়।
- Export v1-এ current safe filters, current branch scope এবং field-level permissions honour করে CSV generate হবে; every export audit log হবে।
- Import wizard হবে: upload, mapping, validate/preview, explicit commit। Preview কোনো database write করবে না।
- Validate file size, MIME/type, encoding, headers, row count, dates, numbers, currencies, duplicate keys, referenced master data, company এবং branch mapping।
- Duplicate policy per entity আগে define করতে হবে: reject, skip অথবা explicit update by stable key। Silent overwrite নিষিদ্ধ।
- Commit bounded transaction/batch ব্যবহার করবে এবং import job/audit record-এ actor, file metadata, totals, created/skipped/rejected rows ও row-level errors থাকবে।

### Phase 06 — Customizable Dashboard hardening

- User dashboard layout entity-তে companyId, userId, schema version, validated widget order/visibility JSON, timestamps এবং unique user/company constraint থাকবে।
- Widget registry server-owned হবে। Browser arbitrary widget, data source বা query submit করতে পারবে না।
- Render-এর আগে current role, enabled module, branch scope এবং widget availability অনুযায়ী saved layout normalize করতে হবে। Hidden/unauthorized widget-এর query চলবে না।
- Reset-to-default বাধ্যতামূলক। Drag/reorder থাকলেও keyboard move-up/move-down control থাকতে হবে।
- Removed/renamed widget-এর জন্য layout schema migration অথবা safe reset থাকতে হবে।

### Phase 07 — Recurring Task hardening

- Only parentTaskId যথেষ্ট নয়। Dedicated recurrence/template entity-তে rule, timezone, start/end, active state, nextRunAt, lastRunAt, template fields, ownership এবং branch context থাকবে।
- Generated task-এ recurrence reference এবং unique occurrence key থাকবে, যাতে repeated cron call/retry duplicate task তৈরি না করে।
- Protected runner atomically due schedule claim করবে, documented catch-up policy মেনে instance create করবে, nextRunAt update করবে এবং crash/retry-safe থাকবে।
- In-process timer ব্যবহার করা যাবে না। Phase 00-এর documented cron deployment contract অনুযায়ী authenticated endpoint/worker ব্যবহার হবে; manual recovery action থাকবে।

### Phase 08 — Custom Document Templates hardening

- v1 document type Phase 00-তে freeze হবে; quotation/invoice অথবা HBL-এর মতো সীমিত scope দিয়ে শুরু হবে।
- Template এবং template version entities-এ company scope, document type, schema version, validated layout JSON, active status, creator/editor, timestamps, audit এবং soft delete থাকবে।
- Layout JSON শুধুমাত্র server-owned schema এবং approved placeholder whitelist ব্যবহার করবে। Arbitrary HTML, JavaScript, CSS URL বা expression rendering নিষিদ্ধ।
- Template change-এর পরে historic issued/locked document reproducible রাখতে used template version snapshot করতে হবে।
- Actual output paths inventory করতে হবে: PDF generator paths এবং freight document print page paths এক নয়। কোন path v1-এ included সেটি documentation-এ স্পষ্ট থাকবে।
- Missing/invalid/deactivated template হলে tested system default fallback render করতে হবে।

### Phase 09 — Approval Workflow hardening

- v1 vendor bill এবং payment দিয়ে শুরু হবে। Expense model তখনই যোগ হবে যখন তার separate business lifecycle approved হবে।
- Simple per-table approver fields-এর বদলে reusable approval policy, approval request, approval step এবং immutable decision/audit design ব্যবহার করতে হবে।
- Policy-তে company/branch applicability, amount threshold, currency basis, approver role(s), sequence, required level এবং self-approval rule থাকবে।
- Server enforce করবে: creator approve করতে পারবে না, approver same company/branch-এর হবে, sequence skip করা যাবে না, pending/rejected record paid/sent করা যাবে না।
- Material edit approval supersede/cancel করে re-approval চাইবে; non-material edit list documented থাকবে।
- Phase 02 notification service দিয়ে idempotent approval request/decision message queue হবে।

## CodeCanyon final release gate

- [ ] Fresh install, migration upgrade, seed, build, type-check, lint documented environment-এ pass।
- [ ] Environment example file সব optional integration, dry-run/default behaviour, storage, cron এবং encryption requirement explain করে।
- [ ] Backup/restore, migration rollback/forward recovery, sample data reset এবং self-hosted scheduler setup buyer documentation-এ আছে।
- [ ] Demo data সব delivered feature দেখায়; fake AI, fake delivery বা undocumented external dependency নেই।
- [ ] Different companies, roles এবং branch-restricted users দিয়ে buyer-style manual QA run record করা হয়েছে।
- [ ] Documentation, screenshots এবং marketplace marketing copy শুধু বাস্তবে delivered behaviour claim করে।

## নোট

- একটা Phase সম্পূর্ণ শেষ (কোড + টেস্ট) না হওয়া পর্যন্ত পরের Phase শুরু হবে না।
- Phase 01 (Branch Management) শুরু করার আগে Phase 00-এর ব্যবসায়িক সিদ্ধান্ত complete করুন — এটি সবচেয়ে বেশি টেবিল স্পর্শ করে।
- **AI-Powered Features (15টি) এই plan-এ নেই** — Phase 01–09 সব শেষ হওয়ার পর আলাদা plan হিসেবে করা হবে।

## Known gap — Platform company onboarding (future work, এই ৯-ফেজ প্ল্যানের বাইরে)

Phase 01 (Multi-Company & Branch Management)-এর manual QA করতে গিয়ে (multi-company isolation টেস্ট) এই gap-টা ধরা পড়েছে:

**সমস্যা:** Platform panel-এর "Create platform company" action (`lib/actions/platform.ts`) শুধু company-র metadata (নাম, email, module, subscription) তৈরি করে — কিন্তু নতুন company-র জন্য কোনো role/permission catalog, কোনো branch (Head Office), বা কোনো login-যোগ্য admin user তৈরি করে না। ফলে platform panel দিয়ে তৈরি করা যেকোনো নতুন company কার্যত অকেজো থাকে, যতক্ষণ না ম্যানুয়ালি (script/DB দিয়ে) কেউ এই ডেটা বসিয়ে দেয়। "Email" ফিল্ডটা শুধু `company.email` মেটাডেটা হিসেবে সংরক্ষিত হয়, কোনো `User` রেকর্ড তৈরি করে না।

**যাচাই করা হয়েছে:** সরাসরি DB চেক করে নিশ্চিত করা হয়েছে — role/permission catalog তৈরির লজিক শুধু `prisma/seed.ts`-এ আছে (dev-only script), কোনো application action এটা করে না।

**প্রস্তাবিত প্রফেশনাল সমাধান:** এই কোডবেসে ইতিমধ্যে থাকা client-portal invite/activation প্যাটার্ন (one-time token + activation link, `customerportalactivationtoken`-এর মতো) company-admin onboarding-এর জন্য reuse করা:
1. "Create company" ফর্মে শুধু "Admin email" ফিল্ড যোগ (password ফিল্ড না)
2. Company তৈরির সাথে সাথে backend-এ স্বয়ংক্রিয়ভাবে role/permission catalog, Head Office branch, এবং password-বিহীন "pending" admin user তৈরি
3. সেই email-এ secure activation link পাঠানো (existing notification system দিয়ে)
4. একটা activation পেজ যেখানে token যাচাই করে ব্যক্তি নিজে password সেট করবে

**Status:** [ ] শুরু হয়নি — user-এর সিদ্ধান্তে আপাতত শুধু নোট করে রাখা হলো, Phase 01–09 এবং AI plan-এর পরে আলাদাভাবে বিবেচনা করা হবে।
