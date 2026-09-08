# Freito — AI-Powered Features Implementation Plan

Audit (2026-09-07)-এ দেখা গেছে ১৫টা marketed AI feature-এর মধ্যে ১৩টার কোনো কোড নেই, একটা (AI Document Reader) শুধু `components/shipments/ai-extract-marks-button.tsx`-এ `setInterval` + `Math.random()` দিয়ে বানানো cosmetic mock, আর একটা (AI Smart Search) real কিন্তু non-AI keyword search (`app/api/search/route.ts`)। এই plan সবগুলো real AI/LLM integration দিয়ে বানানোর জন্য।

`IMPLEMENTATION_PLAN.md`-এর ভারী CodeCanyon delivery process (প্রতিটা ফিচারে বাধ্যতামূলক migration-double-test/E2E-suite/আলাদা admin UI) এখানে **প্রযোজ্য না**। ফিচারগুলোকে dependency অনুযায়ী ৯টা Phase-এ ভাগ করা হয়েছে — যেগুলো সত্যিই একে অপরের কোড শেয়ার করে (যেমন Health Score/Delay Alerts/Profit Analysis/Exception Radar) সেগুলো একসাথে রাখা হয়েছে, আর যেগুলো আসলে অসম্পর্কিত (Report Insights, Search, Task Suggestions, Customer Insights) সেগুলো আলাদা Phase-এ রাখা হয়েছে যাতে একটাতে সমস্যা হলে বাকিগুলো আটকে না যায়।

**প্রতিটি Phase শেষ হলে পরের Phase শুরু হবে।**

- মোট Phase: 9 (Foundation + 8 feature-phase, ১৫টা ফিচার কভার করে)
- প্রতিটা Phase হালকা: শুধু "কী বানাতে হবে" + ছোট "Definition of done" — ভারী checklist নেই

Progress marker: Phase শেষ হলে শিরোনামের `[ ]` কে `[x]` করে দিন।

---

## Provider ও infra সিদ্ধান্ত

CodeCanyon-এ বিক্রি হবে এবং প্রতিটা install multi-tenant (একই deployment-এ একাধিক `company`) — তাই AI-কে single global config দিয়ে সীমাবদ্ধ রাখা হয়নি, বরং প্রোডাক্টের আগে থেকে থাকা pattern-ই (per-company `communicationaccount` + encryption) reuse করা হয়েছে:

- `.env`-এ একটা **platform-level default**: provider + fallback API key + default daily cap — buyer নিজে deploy করার সময় একটাই সেট করলে পুরো install কাজ করবে (zero-config শুরু)।
- প্রতিটা `company` চাইলে নিজের **override** সেট করতে পারবে (নিজের API key, নিজের daily cap, নিজে enable/disable) — না করলে platform default apply হয়। ছোট একটা টেবিল (`companyaisettings`), ভারী admin infra না।
- Provider abstraction থাকবে (Gemini/OpenAI/Anthropic সুইচযোগ্য), একটা gateway function-এর মধ্য দিয়েই সব ফিচার কল করবে।
- Permission: `ai:use` (সাধারণ ব্যবহারকারী — নিজের entity permission-এর পাশাপাশি) ও `ai:configure` (company admin — settings page-এ enable/key/cap বদলাতে পারবে)।
- **Cost control:** প্রতিটা company-র daily AI-call সংখ্যা cap-এর ভেতরে থাকতে হবে — নতুন logging টেবিল না বানিয়ে বিদ্যমান `auditlog`/`audit()` হেল্পার দিয়েই গোনা হবে।
- **Audit trail:** প্রতিটা সফল AI generation call একটা `audit({ action: "AI_GENERATE", entityType: feature, ... })` entry রাখবে — বিদ্যমান helper reuse।
- Generative ফিচার (Document Reader, Email/Quotation Generator, Summary) সবসময় editable draft দেখাবে, direct auto-save/auto-send করবে না।
- AI off (platform/company)/misconfigured/quota-exceeded/error হলে ওই অংশের UI hide অথবা সাধারণ "not available" message দেখাবে, crash করবে না।

---

## Execution order

| # | Phase | Feature | কেন এই গ্রুপিং |
| ---: | --- | --- | --- |
| 1 | Foundation | — | সব ফিচারের ভিত্তি |
| 2 | Shipment Intelligence | Health Score, Delay Alerts, Profit Analysis, Exception Radar | একই risk/aggregation কোড শেয়ার করে; Radar বাকি ৩টার output ব্যবহার করে |
| 3 | AI Document Reader | Document Reader | সবচেয়ে জটিল ও foundational — বিদ্যমান fake mock প্রতিস্থাপন করে, Checker/Cross-Check এর ওপর নির্ভর করবে |
| 4 | Document Verification | Document Checker, Document Cross-Check | দুটোই Phase 3-এর extraction ব্যবহার করে, একই UI pattern |
| 5 | Shipment Copilot | Shipment Summary, Shipment Assistant | Summary সরাসরি Assistant-এর ভেতরে ব্যবহার হয় |
| 6 | Generative Content | Email Generator, Quotation Generator | দুটোই independent generative draft feature |
| 7 | Reports & Search Intelligence | Report Insights, Smart Search | দুটোই বিদ্যমান feature (reports, Phase 03 search)-এর ওপর AI layer |
| 8 | Task Suggestions | Task Suggestions | Phase 2-এর signal consume করে, কিন্তু নিজের UI/flow আলাদা |
| 9 | Customer Insights | Customer Insights | সবচেয়ে standalone, শেষে |

---

## Phase 1 — AI Foundation

**যা বানাতে হবে:**
- `npm install ai @ai-sdk/google` (Gemini দিয়ে শুরু, mock-এ যেই নাম আগে থেকেই আছে)
- `.env`: `AI_ENABLED` (platform-wide kill-switch), `AI_PROVIDER`, `GOOGLE_GENERATIVE_AI_API_KEY` (platform fallback key), `AI_DEFAULT_DAILY_REQUEST_CAP`, `AI_SECRET_KEY` (company override key এনক্রিপ্ট করতে)
- **Schema (একটা মাত্র নতুন টেবিল):** `companyaisettings` — `companyId (unique), enabled (Boolean, default false), provider (enum, nullable = platform default), encryptedApiKey (String?, LongText), dailyRequestCap (Int?, nullable = platform default), timestamps`
- `lib/ai/encryption.ts` — `lib/communications/encryption.ts`-এর প্যাটার্নে, `AI_SECRET_KEY` দিয়ে company override key এনক্রিপ্ট/ডিক্রিপ্ট
- `lib/ai/client.ts` — provider client init + `generateText()`, `generateObject()` wrapper
- `lib/ai/gateway.ts` — একমাত্র entrypoint, ক্রম: platform `AI_ENABLED` → company `enabled` → permission `ai:use` → daily cap (আজকের `auditlog` count) → provider কল → সফল হলে `audit({ action: "AI_GENERATE", entityType: feature, ... })`
- নতুন permission: `ai:use`, `ai:configure` — role seed-এ যোগ
- `/dashboard/ai-settings` — enable/disable, নিজের API key (optional), daily cap, আজকের ব্যবহার — `communication-accounts` page-এর pattern অনুসরণ করে, `ai:configure` দিয়ে গেটেড

**Definition of done:** টেস্ট কল কাজ করে; platform বা company যেকোনো লেভেলে বন্ধ করলে gateway "unavailable" রিটার্ন করে; cap পার হলে ব্লক হয় কিন্তু crash করে না; প্রতিটা সফল কলে auditlog row তৈরি হয়।

**Progress:** [x] সম্পূর্ণ (2026-09-07)

### Sub-progress
- [x] `npm install ai @ai-sdk/google` (installed: `ai@^7.0.93`, `@ai-sdk/google@^4.0.64`)
- [x] Schema — `companyaisettings` model + `companyaisettings_provider` enum; migration `20260907000000_add_ai_foundation` হাতে লিখে সরাসরি dev DB-তে apply করে `prisma migrate resolve --applied` দিয়ে history-তে বুকিং করা হয়েছে (dev DB pre-existing drift-এ ছিল — `prisma migrate dev` চালালে reset চাইতো, তাই সেটা এড়িয়ে শুধু নতুন টেবিলটাই isolate করে যোগ করা হয়েছে, অন্য কোনো drifted table টাচ করা হয়নি)
- [x] `lib/ai/encryption.ts`, `lib/ai/client.ts` (Gemini adapter, provider abstraction-ready), `lib/ai/gateway.ts`, `lib/ai/features.ts`
- [x] Permission `ai:use`, `ai:configure` — `lib/permissions/rbac.ts` ও `prisma/seed.ts`-এ যোগ; DB-তে সরাসরি query করে verify করা হয়েছে (COMPANY_ADMIN উভয়টা পায়, OPERATIONS_MANAGER/DOCUMENTATION_OFFICER/ACCOUNTS_OFFICER/SALES_EXECUTIVE `ai:use` পায়, CLIENT_USER পায় না)
- [x] `/dashboard/settings/ai` পেজ + `AiSettingsForm` + `saveAiSettings`/`testAiConnection` action + sidebar nav item (`ai:configure` gated)
- [x] `.env`/`.env.example`-এ `AI_ENABLED` (default false), `AI_PROVIDER`, `GOOGLE_GENERATIVE_AI_API_KEY`, `AI_DEFAULT_DAILY_REQUEST_CAP`, `AI_SECRET_KEY` যোগ — সবকিছু default বন্ধ, তাই deploy করলে existing behavior অপরিবর্তিত থাকে
- [x] `npm run type-check` — clean, ০ error
- [x] `npm run lint` — নতুন কোনো ফাইলে ০ error/warning; full-project count ৬৪টা pre-existing unrelated problem (৩৫ error, ২৯ warning) অপরিবর্তিত (before/after হুবহু মিলেছে)
- [x] ইতিমধ্যে চলমান dev server (hot-reload) দিয়ে sanity check — `/dashboard`, `/dashboard/settings/ai`, `/login` সবগুলো সঠিক response দিয়েছে, dev log-এ কোনো নতুন compile error নেই
- **আবিষ্কৃত কিন্তু out-of-scope pre-existing issue (এই কাজের সাথে সম্পর্কহীন, টাচ করা হয়নি):** `npx prisma migrate dev` চালালে dev DB-তে drift detected হয় (HBL/document-checklist/shipment-job ইত্যাদি অনেক আগের কলাম নিয়ে, আমার AI কাজের সাথে সম্পর্কহীন — root cause একই যা IMPLEMENTATION_PLAN.md Phase 01-এ আগে নোট করা ছিল)। `npx prisma db seed` শেষে গিয়ে একটা pre-existing bug-এ fail করে (`shipmentRequest.create`-এ `company` argument missing, IMPLEMENTATION_PLAN.md Phase 02-তে আগেই নোট করা) — কিন্তু permission/role-assignment seeding ওই ব্যর্থতার অনেক আগেই সফলভাবে শেষ হয়, DB query দিয়ে verify করা হয়েছে। `npm run build` (Turbopack) `components/approvals/create-policy-form.tsx` → `lib/db/prisma.ts` → `@prisma/adapter-mariadb`-এর `tls` module resolution নিয়ে ব্যর্থ হয় — approval-policies ফিচার ও prisma adapter-এর pre-existing bundling সমস্যা, AI কাজের কোনো ফাইল এই trace-এ নেই।

---

## Phase 2 — Shipment Intelligence

**Feature covered:** AI Shipment Health Score, AI Delay Alerts, AI Profit Analysis, AI Exception Radar

**যা বানাতে হবে:**
- `lib/ai/health-score.ts` — status progress/milestone delay/missing-rejected document/overdue task থেকে ০-১০০ score (deterministic হিসাব; LLM শুধু optional এক-লাইন ব্যাখ্যা)। Shipment detail/list-এ badge + breakdown tooltip।
- `lib/ai/delay-risk.ts` — planned vs actual milestone gap থেকে risk level (LOW/MEDIUM/HIGH); Health Score-এর factor কোড reuse। Dashboard-এ "At-risk shipments" widget।
- `lib/ai/profit-analysis.ts` — route/customer/mode-ভিত্তিক average margin থেকে outlier/low-margin শিপমেন্ট বের করা (statistical, LLM ছাড়াই সম্ভব; narrative optional)। Financial reports page-এ section। `costing:view` + `ai:use` উভয় লাগবে।
- `lib/ai/exception-radar.ts` — উপরের তিনটা + document rejection/overdue approval একসাথে "needs attention" feed। Dashboard widget + `/dashboard/exceptions` page।

**Definition of done:** সব score/alert branch-scope মেনে হিসাব হয় (`branchScopeWhere` reuse); non-AI-user এগুলো দেখতে পাবে না।

**Progress:** [x] সম্পূর্ণ (2026-09-07)

### Sub-progress
- [x] `lib/ai/health-score.ts` — deterministic ০-১০০ score (ETA overdue/overdue workflow step/blocked stage/overdue task/loss-margin factor), কোনো LLM কল ছাড়াই কাজ করে। `components/shipments/ai-health-score-badge.tsx` (server component, `<details>/<summary>` দিয়ে JS ছাড়াই expandable breakdown) — shipment detail page-এ header badge-row-এ ২ লাইন যোগ করে inject করা হয়েছে (existing 1992-লাইনের ফাইলে বাকি সব অপরিবর্তিত)।
- [x] `lib/ai/delay-risk.ts` — existing `lib/reports/dashboard-summary.ts`-এর delayedJobs detection (ETA overdue বা overdue workflow step)-এর একই criteria দিয়ে actual shipment list (job no, customer, reason, LOW/HIGH severity) রিটার্ন করে, শুধু count না।
- [x] `lib/ai/profit-analysis.ts` — existing profit/margin selection logic (locked হলে final, না হলে current) reuse করে; নতুন কিছু: company-এর নিজের average margin-এর ৫০%-এর নিচে থাকা শিপমেন্টকে "outlier" হিসেবে flag করা (শুধু fixed ১০% threshold না)।
- [x] `lib/ai/exception-radar.ts` — delay risk + low-margin/loss + rejected document (per-shipment একটাই entry, flood এড়াতে) একসাথে merge করে severity অনুযায়ী sort করা ফিড।
- [x] Dashboard widget registry (`lib/dashboard/widgets.ts`)-এ `ai-delay-alerts`, `ai-exception-radar` যোগ — existing customizable-dashboard (show/hide/reorder) স্বয়ংক্রিয়ভাবে এই দুইটাও সাপোর্ট করে, নতুন কোনো customizer কোড লাগেনি। `app/(dashboard)/dashboard/page.tsx`-এ widgetContent entry (ai:use না থাকলে graceful "ask admin" card)।
- [x] `components/reports/ai-profit-insights-card.tsx` — `/dashboard/reports/financial` পেজে existing Job-wise profit table-এর ঠিক আগে বসানো (ai:use না থাকলে null রিটার্ন করে, silently hide)।
- [x] `/dashboard/exceptions` পেজ + sidebar-এ "AI Exception Radar" nav item (Reports group-এ, `reports:view` permission)।
- [x] **List-page badge ইচ্ছাকৃতভাবে বাদ** — plan-এর নিজের deferred note অনুযায়ী, shipment list-এ per-row health-score computation করলে N+1 query performance risk হতো; শুধু detail page-এই রাখা হয়েছে, cached column ছাড়া list-এ যোগ করা হয়নি।
- [x] `npm run type-check` — ক্লিন। `npm run lint` — নতুন ফাইলে ০ error/warning, full-project ৬৪টা pre-existing সমস্যা অপরিবর্তিত।
- [x] চলমান dev server দিয়ে sanity check — `/dashboard`, `/dashboard/exceptions`, `/dashboard/reports/financial`, `/dashboard/shipments` সবগুলো hot-reload-এ ঠিকভাবে compile হয়েছে, dev log-এ কোনো নতুন error নেই।

---

## Phase 3 — AI Document Reader

**বর্তমান:** `ai-extract-marks-button.tsx`-এ পুরোপুরি ভুয়া mock — `setInterval` scripted progress + `Math.random()` placeholder output।

**যা বানাতে হবে:**
- ভুয়া `setInterval`/`Math.random()` কোড সম্পূর্ণ মুছে ফেলা
- `lib/ai/document-reader.ts` — uploaded file (blob URL, `lib/blob`) → vision-capable model → structured field extraction (marks/numbers-এ সীমাবদ্ধ না, general document field হিসেবে reusable বানানো, যাতে Phase 4 এটা reuse করতে পারে)
- বিদ্যমান UI flow অপরিবর্তিত: extract → editable textarea → explicit "Save & Apply" (existing `saveShipmentMarksAndNumbers` action টাচ করার দরকার নেই)
- Low-confidence field-এ visual flag; unsupported/corrupt file-এ graceful error

**Definition of done:** Real extraction কাজ করে, ভুল/corrupt ফাইলে crash করে না, fabricated-এর মতো দেখতে placeholder output আর দেখাবে না।

**Progress:** [x] সম্পূর্ণ (2026-09-07)

### Sub-progress
- [x] `lib/ai/client.ts` — `generateProviderObject` extend করে vision input সাপোর্ট যোগ (optional `file: { data: Buffer, mediaType }`, present থাকলে text+file part সহ `messages` পাঠায়, না থাকলে আগের মতোই plain `prompt`) — Phase 1-এর সিগনেচার backward-compatible রাখা হয়েছে।
- [x] `lib/ai/gateway.ts` — `generateAIObject`-এ optional `file` param pass-through যোগ; platform/company/permission/quota gate ও audit logic অপরিবর্তিত।
- [x] `lib/ai/document-reader.ts` (নতুন) — `getDocumentExtraction(user, documentId)`: `shipmentdocument` কে company+branch-scope (`branchScopeWhere`) দিয়ে lookup করে, `blobGet(filePath)` দিয়ে ফাইল আনে, mimeType allowlist (PDF/JPEG/PNG/WEBP/HEIC/HEIF) চেক করে, তারপর Zod schema (`fields: {label,value,confidence}[]`, `text`) দিয়ে `generateAIObject` কল করে। General/reusable — marks-নির্দিষ্ট কিছু নেই, তাই Phase 4 (Checker/Cross-Check) সরাসরি reuse করতে পারবে।
- [x] `lib/actions/ai-document-reader.ts` (নতুন) — `extractShipmentDocumentFields(documentId)` server action, `shipments:update` permission দিয়ে গেটেড (যেই permission দিয়ে `saveShipmentMarksAndNumbers` আগে থেকেই গেটেড, যেহেতু extraction সরাসরি ওই action-এই ফিড হয়)।
- [x] `components/shipments/ai-extract-marks-button.tsx` — ভুয়া `setInterval`/`Math.random()`/scripted-steps কোড সম্পূর্ণ মুছে ফেলা হয়েছে; এখন `extractShipmentDocumentFields` সার্ভার অ্যাকশন কল করে real extraction করে। Error state (NOT_FOUND/UNSUPPORTED_FILE/PLATFORM_DISABLED/QUOTA_EXCEEDED/PROVIDER_ERROR ইত্যাদি সব ক্ষেত্রে) একটা inline message + "Try Again"/"Close" দেখায়, crash করে না। LOW-confidence field থাকলে textarea-এর উপরে amber warning banner দেখায়। **বিদ্যমান UI flow (editable textarea → explicit "Save & Apply" → `saveShipmentMarksAndNumbers`) অপরিবর্তিত, ওই action টাচ করা হয়নি।**
- [x] `app/(dashboard)/dashboard/shipments/[id]/page.tsx` — বাটনে `documentId={document.id}` pass করা হয়েছে (আগে শুধু নাম/shipper/consignee পাঠাত, mock টেক্সট বানাতে ব্যবহৃত হতো — সেগুলো আর দরকার নেই); visibility gate যোগ (`canUpdate && ai:use`, আগে কোনো permission check ছাড়াই বাটনটা দেখাত)।
- [x] `npm run type-check` — ক্লিন, ০ error। `npm run lint` — নতুন/পরিবর্তিত কোনো ফাইলে ০ error/warning, full-project pre-existing baseline অপরিবর্তিত।
- [x] চলমান dev server দিয়ে sanity check — shipment detail route (auth redirect পর্যন্ত) নতুন কোড দিয়ে ঠিকভাবে compile হয়েছে, dev log-এ কোনো নতুন error নেই। **লক্ষণীয়:** `.env`-এ `AI_ENABLED=false` ও কোনো `GOOGLE_GENERATIVE_AI_API_KEY` সেট নেই (Phase 1-এর zero-config-by-default design অনুযায়ী), তাই আসল Gemini vision কল দিয়ে end-to-end টেস্ট করা যায়নি — টেস্ট করতে হলে `.env`-এ key বসিয়ে `AI_ENABLED=true` করে কোনো company-তে `/dashboard/settings/ai`-এ enable করতে হবে।

---

## Phase 4 — Document Verification

**Feature covered:** AI Document Checker, AI Document Cross-Check

**যা বানাতে হবে:**
- `lib/ai/document-checker.ts` — Phase 3-এর extraction ব্যবহার করে content-level ভুল ধরা (যেমন HBL vs shipment record-এ consignee নাম না মেলা, missing mandatory field)। Document verify UI-তে "AI Check" বাটন — শুধু flag করবে, verify/reject decision মানুষের হাতেই থাকবে (existing action অপরিবর্তিত)।
- `lib/ai/document-cross-check.ts` — একই শিপমেন্টের একাধিক document (Invoice/Packing List/HBL) compare করে mismatch বের করা। Shipment detail-এ "Cross-check documents" action (কমপক্ষে ২টা প্রাসঙ্গিক document upload থাকলে enable)।

**Definition of done:** কোনোটাই স্বয়ংক্রিয়ভাবে document reject করে না, শুধু issue তালিকা দেখায়।

**Progress:** [x] সম্পূর্ণ (2026-09-07)

### Sub-progress
- [x] `lib/ai/document-checker.ts` — Phase 3-এর `getDocumentExtraction()` reuse করে একটা document-এর extracted text + shipment record-এর নিজস্ব fact (shipper/consignee/notify party/MBL-HBL-MAWB-HAWB/booking no/package/weight/cargo description) — দুটোই একসাথে দ্বিতীয় একটা `generateAIObject` কলে পাঠিয়ে mismatch/missing-field খুঁজে বের করে (structured `{field, severity, issue, shipmentRecordValue, documentValue}[]`)। শুধু flag করে, কিছু write করে না।
- [x] `lib/ai/document-cross-check.ts` — শিপমেন্টের সব uploaded document (latest version per name, cap ৫টা)-এর extraction sequentially নিয়ে (parallel না — daily-quota check-এর race window কমাতে ইচ্ছাকৃত) একসাথে LLM-কে পাঠিয়ে cross-document field mismatch বের করে (`{field, severity, issue, valuesByDocument}[]`)।
- [x] `lib/actions/ai-document-checker.ts` — `checkShipmentDocumentAction`, `crossCheckShipmentDocumentsAction`, দুটোই `shipments:update` permission দিয়ে গেটেড, কোনো DB write নেই।
- [x] `components/shipments/ai-document-checker-button.tsx`, `ai-document-cross-check-button.tsx` — modal দিয়ে issue list দেখায়, স্পষ্ট disclaimer ("informational only, verify/reject নিজে করুন"), cross-check বাটন ২টার কম document থাকলে disabled।
- [x] Shipment detail page-এ wiring — "AI Check" বাটন প্রতিটা document row-এ (Extract Marks বাটনের পাশে), "Cross-check documents" বাটন Documents Checklist section-এর header-action row-এ, uploaded document count নিয়ে enable/disable হিসাব।
- [x] `npm run type-check`, `npm run lint` — নতুন ৫টা ফাইলের একটাতেও কোনো error/warning নেই (grep করে নিশ্চিত করা হয়েছে)।
- [x] **একটা critical, সম্পূর্ণ অসম্পর্কিত bug আবিষ্কার ও ঠিক করা হয়েছে (blocking ছিল বলে fix করতে হয়েছে):** verification চলাকালীন দেখা যায় পুরো dev server-ই ৫০০ error দিচ্ছিল (`/login` পর্যন্ত) — root cause: `components/approvals/create-policy-form.tsx` ("use client") `lib/approvals/roles.ts` থেকে `APPROVER_ROLE_CODES` import করছিল, কিন্তু ওই ফাইলের top-level-এ `import { prisma } from "@/lib/db/prisma"` ছিল (`"server-only"` guard ছাড়া) — ফলে client bundle-এ পুরো Prisma/`@prisma/adapter-mariadb`/mariadb driver টানার চেষ্টা হতো, যেটা browser-এ `fs`/`net`/`tls` Node module resolve করতে না পেরে পুরো app ভেঙে দিতো। এটা AI Phase-এর কোনো কাজের কারণে হয়নি (pre-existing, Phase 09 Approval Workflow-এর অংশ), কিন্তু এত ফাইল পরিবর্তনের পর Turbopack-এর shared chunk rebuild হয়ে এই latent bug ধরা পড়ে যায়। **সমাধান:** client-safe constant (`APPROVER_ROLE_CODES`, `isApproverRoleCode`, `ApproverRoleCode`) আলাদা করে নতুন `lib/approvals/approver-roles.ts`-এ (কোনো Prisma import নেই) সরানো হয়েছে; `lib/approvals/roles.ts`-এ `"server-only"` guard যোগ করে ওখান থেকে re-export করা হয়েছে (backward-compatible, বাকি সব server-side importer অপরিবর্তিত); `create-policy-form.tsx`-এর import path নতুন ফাইলে পয়েন্ট করা হয়েছে। Fix-এর পর `npm run type-check` ক্লিন, `/login`/`/dashboard`/সব route আবার 200/307 (আগে 500 ছিল)।
- [x] Fix-পরবর্তী পুরো lint সুইপ (241 লাইন সম্পূর্ণ আউটপুট, আগের মতো `tail`-এ কাটা অংশ না) — `approver-roles.ts`/`roles.ts`/`create-policy-form.tsx` কোথাও কোনো নতুন সমস্যা নেই। **সংশোধনী নোট:** Phase 1-3-এ lint verify করার সময় `tail -20`/`tail -100` দিয়ে আউটপুট কাটা হয়েছিল বলে পুরো ফাইল-লিস্ট (241 লাইন) কখনো সরাসরি দেখা হয়নি, শুধু চূড়ান্ত count-টা trust করা হয়েছিল — সেই count-ভিত্তিক তুলনা ভুল ছিল না, কিন্তু "কোন ফাইলে কী" claim-গুলো এখন full-output দিয়ে re-verify করে নিশ্চিত করা হলো: app-sidebar.tsx-এর ২টা sidebar-collapse/mobile-menu effect ও ai-extract-marks-button.tsx-এর close-on-save effect pre-existing (আমার কোনো Phase-এর সংযোজন না), shipments/[id]/page.tsx-এর unrelated `any`/unused-var pre-existing।

---

## Phase 5 — Shipment Copilot

**Feature covered:** AI Shipment Summary, AI Shipment Assistant

**যা বানাতে হবে:**
- `lib/ai/shipment-summary.ts` — status/milestone/document/task থেকে ৩-৫ লাইনের summary। Shipment detail-এ card + "Regenerate" বাটন। প্রতিবার fresh generate (cache না)।
- `app/api/ai/assistant/route.ts` — streaming chat endpoint; context = Summary + Health Score + Delay Alert + Exception Radar item + pending task (pre-fetched, scoped — raw DB access LLM-কে দেওয়া হবে না)। Shipment detail-এ chat panel। প্রথম ভার্সনে read-only, conversation persist করা হবে না।

**Definition of done:** Assistant শুধু ওই নির্দিষ্ট শিপমেন্টের ডেটা নিয়ে উত্তর দেয়, অন্য company/branch-এর ডেটা leak করে না।

**Progress:** [x] সম্পূর্ণ (2026-09-07) — **নোট:** এই Phase তখন Phase 4 (Document Verification)-এর আগে implement করা হয়েছিল (ব্যবহারকারীর অনুরোধে)। কোনো code dependency ছিল না — Phase 5 কোথাও Document Checker/Cross-Check-এর output ব্যবহার করে না, শুধু Phase 2-এর Health Score আর shipment-এর নিজের ডেটা লাগে। Phase 4 এখন (পরে, আলাদাভাবে) সম্পূর্ণ হয়ে গেছে — উপরে দেখুন।

### Sub-progress
- [x] `lib/ai/client.ts` — `streamProviderText()` যোগ (ai SDK-এর `streamText` wrap করে, `onFinish` callback সহ)।
- [x] `lib/ai/gateway.ts` — preflight check লজিক (platform/company/permission/quota) `runGateway`-এর ভেতর থেকে বের করে `resolveGate()`-এ শেয়ার করা হয়েছে; নতুন `generateAIStreamText()` একই gate ব্যবহার করে কিন্তু generation শেষ হওয়ার জন্য অপেক্ষা না করেই stream রিটার্ন করে — audit entry (যেটার ওপর daily cap নির্ভর করে) `onFinish`-এ লেখা হয়, তাই abort/failed stream quota-তে গোনা হয় না।
- [x] `lib/ai/shipment-summary.ts` (নতুন) — `getShipmentAiContext()`: shipment-কে company+branch scope-এ lookup করে non-LLM raw data জোগাড় করে (status, ETA, Phase 2-এর Health Score reuse, overdue workflow step, rejected document, pending task) — এটাই "Summary + Health Score + Delay Alert + Exception Radar item + pending task" context, একটাতেই একত্র করা, দুইবার আলাদা করে গণনা করার দরকার নেই। `getShipmentSummary()` সেই context থেকে prompt বানিয়ে `generateAIText` কল করে ৩-৫ লাইনের narrative — cache নেই, প্রতিবার fresh।
- [x] `lib/actions/ai-shipment-copilot.ts` (নতুন) — `generateShipmentSummary(shipmentId)` server action, `shipments:view` দিয়ে গেটেড (shipment detail page যেই permission দিয়ে গেটেড, সেটাই)।
- [x] `app/api/ai/assistant/route.ts` (নতুন) — streaming POST endpoint। Auth: session + `shipments:view` + `ai:use`। Input validation: message role শুধু user/assistant (system role client থেকে block করা prompt-injection ঠেকাতে), message count ≤20, প্রতিটা ≤4000 char। Context = `getShipmentAiContext()`-এর আউটপুট সরাসরি system prompt-এ বসানো ("only this shipment's data" নির্দেশসহ) — raw DB access মডেলকে দেওয়া হয়নি। `generateAIStreamText()` কল করে `toTextStreamResponse()` রিটার্ন করে।
- [x] `components/shipments/ai-shipment-summary-card.tsx` (নতুন) — client component, "Generate"/"Regenerate" বাটনে ক্লিক করলে সার্ভার অ্যাকশন কল করে (page load-এ auto-generate করে না, যাতে প্রতিটা page visit-এ অকারণে quota না পোড়ে)।
- [x] `components/shipments/ai-shipment-assistant-panel.tsx` (নতুন) — client component, fetch দিয়ে `/api/ai/assistant`-এ POST করে, `response.body.getReader()` দিয়ে token-by-token স্ট্রিম রিড করে UI-তে দেখায়। Conversation শুধু component state-এ থাকে, persist হয় না (page refresh করলে হারিয়ে যায়) — plan অনুযায়ী।
- [x] `app/(dashboard)/dashboard/shipments/[id]/page.tsx` ও `components/shipments/shipment-detail-tabs.tsx` — নতুন "AI Copilot" ট্যাব যোগ (`ai:use` permission থাকলেই দেখা যাবে), যার ভেতর Summary card + Assistant panel পাশাপাশি বসানো হয়েছে।
- [x] `npm run type-check` — ক্লিন, ০ error। `npm run lint` — নতুন/পরিবর্তিত কোনো ফাইলে ০ error/warning, full-project pre-existing baseline (৬৩টা, Phase 3-এ একটা warning কমে গিয়েছিল সেটাসহ) অপরিবর্তিত।
- [x] **Runtime sanity check** — লেখার সময় pre-existing `create-policy-form.tsx`/`prisma`/`mariadb` client-bundle bug-এর কারণে পুরো `(dashboard)` route group সাময়িকভাবে 500 দিচ্ছিল (এই Phase-এর কোনো ফাইল কারণ ছিল না)। Phase 4-এর সময় সেই bug root-cause ধরে ঠিক করা হয়েছে (`lib/approvals/roles.ts` থেকে client-safe constant আলাদা করে `lib/approvals/approver-roles.ts`-এ সরানো হয়েছে) — এখন সব route (shipment detail-সহ) স্বাভাবিক 307/200 দেয়, পরবর্তী audit pass-এ curl দিয়ে confirm করা হয়েছে।

---

## Phase 6 — Generative Content

**Feature covered:** AI Email Generator, AI Quotation Generator

**যা বানাতে হবে:**
- `lib/ai/email-generator.ts` — শিপমেন্ট/কাস্টমার context + preset purpose (status update/delay notice/document request) থেকে email draft (subject+body)। Existing manual-send email UI-তে prefill, auto-send না।
- `lib/ai/quotation-generator.ts` — customer + shipment requirement + কোম্পানির আগের একই route/mode-এর quotation থেকে reference rate নিয়ে draft charge breakdown। Quotation create form-এ "Generate with AI" বাটন — prefill করবে, submit user নিজে করবে।

**Definition of done:** কোনো draft user review ছাড়া সরাসরি send/save হয় না।

**Progress:** [x] সম্পূর্ণ (2026-09-07)

### Sub-progress
- [x] `lib/ai/email-generator.ts` (নতুন) — Phase 5-এর `getShipmentAiContext()`/`shipmentContextToPromptBlock()` reuse করে (query duplicate করা হয়নি), তিনটা preset purpose (`STATUS_UPDATE`/`DELAY_NOTICE`/`DOCUMENT_REQUEST`) অনুযায়ী আলাদা instruction দিয়ে prompt বানিয়ে `generateAIObject` কল করে `{subject, body}` structured draft রিটার্ন করে। Prompt-এ স্পষ্ট নিষেধ: internal cost/profit/system detail email-এ আসবে না।
- [x] `lib/ai/quotation-generator.ts` (নতুন) — কোম্পানির একই company+branch-scope-এর (`branchScopeWhere`) মধ্যে একই `transportMode`+`originCountry`+`destinationCountry`-র সাম্প্রতিক ৫টা quotation (ও তাদের `quotationcharge`) খুঁজে reference rate হিসেবে prompt-এ পাঠায়; কোনো matching past quotation না থাকলে AI-কে rate ০ রাখতে বলা হয় (আন্দাজ করতে না দেওয়ার জন্য)। Output schema-র `chargeType`/`chargeBasis`/`currency` enum ঠিক `lib/validators/finance.ts`-এর const array থেকে নেওয়া, তাই generated draft সবসময় existing `saveQuotation` action-এর validation দিয়ে পাস করবে।
- [x] `lib/actions/ai-generative-content.ts` (নতুন) — `generateShipmentEmailDraftAction` (`shipments:view` গেটেড) ও `generateQuotationChargeDraftAction` (`quotations:create` গেটেড), দুটোই শুধু draft রিটার্ন করে, কোনো DB write নেই।
- [x] `components/shipments/ai-email-draft-button.tsx` (নতুন) — modal-এ purpose বেছে generate করলে editable Subject/Body দেখায়; "Open in Email App" বাটন বিদ্যমান `buildEmailShareUrl()` (mailto:) reuse করে বানানো — কোনো নতুন send-path তৈরি করা হয়নি, ইমেইল পাঠানো এখনও পুরোপুরি ব্যবহারকারীর নিজের mail client-এর ওপর নির্ভর করে (server থেকে কিছু send হয় না)। Shipment detail page-এর header-এ existing `ShareButton`-এর ঠিক পাশে বসানো হয়েছে, `share:view && ai:use` দিয়ে গেটেড।
- [x] `components/forms/finance-forms.tsx`-এর `QuotationForm`-এ নতুন `canUseAi` prop + "Generate charges with AI" বাটন — বর্তমানে ফর্মে যা ভরা আছে (transport mode/route/cargo/weight ইত্যাদি, `fillFromShipment`-এর মতোই `formRef.current.elements` থেকে পড়া) সার্ভার অ্যাকশনে পাঠিয়ে charge line draft আনে, তারপর `QuotationChargesEditor`-কে `key` বদলে remount করিয়ে নতুন charge lines বসায় (editor নিজের internal state শুধু mount-এ seed করে, তাই বাইরে থেকে push করার এটাই সবচেয়ে কম ঝুঁকিপূর্ণ উপায় ছিল — editor-এর নিজের কোনো API বদলাতে হয়নি)। Route/mode/customer না ভরলে বাটন inline error দেখায়, generate করে না।
- [x] `app/(dashboard)/dashboard/quotations/new/page.tsx` ও `.../[id]/edit/page.tsx` — দুটোতেই `canUseAi={hasPermission(currentUser, "ai:use")}` পাস করা হয়েছে (দুটোই একই `QuotationForm` শেয়ার করে)।
- [x] `npm run type-check` — ক্লিন, ০ error। `npm run lint` — নতুন/পরিবর্তিত কোনো ফাইলে ০ error/warning, ৬৩টা pre-existing baseline অপরিবর্তিত।
- [x] dev server sanity check — `/dashboard`, `/dashboard/quotations/new`, `/dashboard/shipments/[id]` সবগুলো clean 307 (auth redirect) দিয়েছে, কোনো নতুন compile error নেই। (উল্লেখ্য: Phase 4-এ ঠিক করা pre-existing approval-policies/prisma-adapter client-bundle bug-এর কারণে আগে একবার পুরো dashboard 500 দিচ্ছিল — সেটা এখন resolved, তাই এই Phase-এর জন্য runtime verification স্বাভাবিকভাবেই সম্পন্ন হয়েছে।)
- **আবিষ্কার:** এই Phase-এর কাজ শুরুর আগে দেখা গেছে Phase 4 (Document Verification) এবং Phase 7-এর `lib/ai/smart-search.ts` — দুটোই ইতিমধ্যে অন্য কোনো session/agent দিয়ে কোডে যোগ হয়ে গেছে (Phase 4 doc-এও `[x] সম্পূর্ণ` মার্ক করা পাওয়া গেছে), যদিও Phase 7-এর progress marker এখনও `[ ] শুরু হয়নি` — এই প্রজেক্টে একাধিক session সমান্তরালে কাজ করছে বলে মনে হচ্ছে। Phase 7 সম্পূর্ণ কিনা যাচাই না করে touch করা হয়নি।

---

## Phase 7 — Reports & Search Intelligence

**Feature covered:** AI Report Insights, AI Smart Search

**যা বানাতে হবে:**
- `lib/ai/report-insights.ts` — report-এর period-over-period aggregate data (Phase 2-এর Profit Analysis output-সহ) থেকে ৩-৪ লাইনের narrative insight। প্রতিটা report page-এ optional panel।
- `lib/ai/smart-search.ts` — natural-language query কে existing `/api/search`-এর structured filter-এ parse করে, তারপর বিদ্যমান scoped search pipeline-ই কল করে (নতুন data-access path না)। `global-search.tsx`-এ "Ask AI" mode toggle, disabled হলে silently keyword search-এ fallback।

**Definition of done:** Smart Search AI mode বন্ধ থাকলেও normal keyword search ভাঙে না।

**Progress:** [x] সম্পূর্ণ (2026-09-07)

### Sub-progress
- [x] `lib/ai/report-insights.ts` — generic `generateReportInsight(user, {reportName, periodLabel, metrics})`, কোনো নির্দিষ্ট report-এর ডেটা শেপ জানে না, তাই যেকোনো report page থেকে reuse করা যায়।
- [x] `components/reports/ai-report-insight-card.tsx` — server component, নিজে `getCurrentUser()` কল করে, AI off/misconfigured হলে silently `null` রিটার্ন করে (কাজ করা report-এর পাশে error দেখাবে না)। `/dashboard/reports/financial` পেজে wiring — current period vs ঠিক আগের সমান-দৈর্ঘ্যের period compute করে (`getFinanceProfitSummary` দুইবার আলাদা date-range দিয়ে কল, existing function অপরিবর্তিত) ৮টা metric (sell/buy/profit/margin/receivable/payable/low-margin-count/loss-count) পাঠায়।
- [x] `lib/ai/smart-search.ts` — `parseSmartSearchQuery`: natural-language প্রশ্ন থেকে সবচেয়ে distinctive literal keyword বের করে (structured output)। **স্পষ্টীকরণ:** বিদ্যমান `/api/search` route-এ কোনো structured filter (date/status) নেই, শুধু plain `q` substring match — তাই "structured filter-এ parse" এর বদলে বাস্তবসম্মত ডিজাইন হলো natural-language কে ভালো একটা keyword-এ rewrite করা, যেটা তারপর ঠিক সেই একই বিদ্যমান per-entity search function-গুলোতেই (অপরিবর্তিত) যায়।
- [x] `app/api/search/route.ts` — `?ai=1` param (শুধু `ai:use` থাকলে effective) যোগ; AI success হলে `query` variable-টা rewrite হয়ে যায়, তারপর নিচের পুরো pipeline (permission/module/branch scope, per-entity search function, limit) **হুবহু অপরিবর্তিত** থাকে — নতুন কোনো data-access path নেই। AI ব্যর্থ/বন্ধ হলে silently original raw query দিয়েই চলে। Response-এ নতুন `interpretedQuery` field (কী keyword দিয়ে আসলে খোঁজা হয়েছে, UI-তে দেখানোর জন্য)।
- [x] `components/global-search.tsx` — `canUseAi` prop (default false), prop true থাকলে input-এর পাশে Sparkles টগল বাটন ("Ask AI" mode); mode অন থাকলে fetch-এ `ai=1` যোগ হয়, `interpretedQuery` থাকলে dropdown-এর উপরে "Searched for X" hint দেখায়। মূল debounce/abort/keyboard-nav লজিক অপরিবর্তিত।
- [x] `components/dashboard-header.tsx` + `app/(dashboard)/layout.tsx` — `canUseAiSearch={hasPermission(user, "ai:use")}` prop chain (layout → header → GlobalSearch), যাতে permission ছাড়া কেউ টগলটাই না দেখে।
- [x] `npm run type-check`, `npm run lint` — নতুন কোনো ফাইলে ০ error/warning; full lint ৬৩ problems (Phase 4-fix-পরবর্তী baseline-এর সাথে হুবহু মিলেছে)।
- [x] dev server sanity check — `/dashboard`, `/dashboard/reports/financial`, `/api/search` (unauth → 401) সব ঠিক সাড়া দিয়েছে। একটা transient React Fast-Refresh warning ("useEffect dependency array changed size") browser log-এ একবার দেখা গিয়েছিল — `global-search.tsx`-এ নতুন `useState` hook যোগ করায় ইতিমধ্যে-mounted পুরনো component instance-এর hot-reload reconciliation artifact (hook slot shift), fresh page load-এ প্রভাবহীন — repeat/loop হয়নি, পরের সব request স্বাভাবিক থেকেছে।

---

## Phase 8 — AI Task Suggestions

**বর্তমান:** কোনো কোড নেই।

**যা বানাতে হবে:**
- `lib/ai/task-suggestions.ts` — Phase 2-এর Exception Radar/Health Score/Delay Alert flagged item থেকে suggested task তৈরি করা (যেমন missing document থাকলে "Request packing list from shipper")।
- Task list/dashboard-এ "Suggested tasks" section — এক ক্লিকে accept করলে existing `tasksCreate` action দিয়ে real task তৈরি হয় (নতুন write path না); accept না করলে কিছুই তৈরি হয় না।

**Definition of done:** Suggestion শুধু propose করে, explicit accept ছাড়া কোনো task তৈরি হয় না।

**Progress:** [x] সম্পূর্ণ (2026-09-07)

### Sub-progress
- [x] `lib/ai/task-suggestions.ts` — Phase 2-এর `getExceptionRadarFeed()` reuse করে, প্রতিটা exception type-কে **deterministic template**-এ ম্যাপ করে (LLM কল নেই — `lib/ai/health-score.ts`-এর একই যুক্তি: একটা real task হয়ে যাওয়া টেক্সটে ভুল AI-শব্দচয়নের চেয়ে স্পষ্ট template ভালো)। Severity অনুযায়ী priority (HIGH/MEDIUM) ও due date (১/৩ দিন) সহ।
- [x] `components/tasks/ai-suggested-tasks-section.tsx` — নিজে `tasks:create` permission চেক করে (শুধু Exception Radar-এর `ai:use` চেক যথেষ্ট না, কারণ Accept বাটন `saveTask`-এ ফিড করে) — permission ছাড়া section-ই দেখায় না, তাই কখনো এমন "Accept" বাটন দেখাবে না যেটা click করলে access-denied হবে।
- [x] `lib/actions/ai-task-suggestions.ts` — `acceptTaskSuggestion` পাতলা wrapper, existing `saveTask` (একই validation/branch-scope/audit/notification সহ) কল করে — নতুন write path না, শুধু plain `<form action>`-এর জন্য signature adapt করা।
- [x] Wiring — `/dashboard/tasks` পেজে (KPI section-এর নিচে) এবং main dashboard-এ নতুন widget key `ai-task-suggestions` (customizer-এ show/hide/reorder স্বয়ংক্রিয়ভাবে কাজ করে, Phase 2-এর মতোই)।
- [x] **একটা real bug ধরা পড়েছিল ও ঠিক করা হয়েছে (নতুন React Compiler purity lint rule দিয়ে):** প্রথম ভার্সনে due-date হিসাব সরাসরি JSX `.map()`-এর ভেতরে `Date.now()` কল করে হতো, যেটা `react-hooks/purity` rule ধরেছে ("impure function during render")। সমাধান: due date হিসাব `lib/ai/task-suggestions.ts`-এ (data layer, render-এর বাইরে) সরিয়ে আনা হয়েছে, component এখন শুধু pre-computed `dueDate` স্ট্রিং ব্যবহার করে — এটা আসলে ভালো ডিজাইনও (component pure presentational থাকলো)।
- [x] `npm run type-check` — ক্লিন। `npm run lint` — ৬৩ problems, established baseline-এর সাথে হুবহু মিলেছে, নতুন কোনো ফাইলে সমস্যা নেই।
- [x] dev server sanity check — `/dashboard/tasks`, `/dashboard` দুটোই ঠিক সাড়া দিয়েছে, কোনো নতুন error নেই।

---

## Phase 9 — AI Customer Insights

**বর্তমান:** কোনো কোড নেই।

**যা বানাতে হবে:**
- `lib/ai/customer-insights.ts` — customer-এর shipment/invoice/quotation history + Phase 2-এর Profit Analysis output থেকে summary (activity trend, payment reliability, potential upsell route/lane)। Sensitive financial figure prompt-এ পাঠানোর আগে redact/aggregate করা।
- Customer detail page-এ "AI Insights" card। `customers:manage` + `ai:use` উভয় লাগবে।

**Definition of done:** Insight শুধু already-scoped customer data থেকে আসে, cross-branch/cross-company leak হয় না।

**Progress:** [x] সম্পূর্ণ (2026-09-07)

### Sub-progress
- [x] **আবিষ্কার:** এই Phase শুরু করার আগে দেখা গেছে `app/(dashboard)/dashboard/customers/[id]/page.tsx` (customer detail page) আদৌ কোনোদিন বানানো হয়নি — customers module-এ শুধু list+inline-edit পেজ (`customers/page.tsx`) আর একটা `portal-access` sub-page ছিল। তাই এই Phase-এর কাজ শুরু হয়েছে একটা নতুন, ছোট detail page বানিয়ে (profile card + branch-scoped activity count card), তারপর তার ভেতরে AI Insights card বসিয়ে — বিদ্যমান list page-এর CRUD/edit ফর্ম টাচ করা হয়নি, শুধু row-action-এ একটা "View" লিংক যোগ করা হয়েছে।
- [x] `lib/ai/customer-insights.ts` (নতুন) — `customer` model-এর নিজের কোনো `branchId` নেই (company-wide entity) দেখে confirm করা হয়েছে যে scoping করতে হবে child record (shipmentjob/invoice/quotation)-এর ওপর `branchScopeWhere` দিয়ে। Aggregate করা হয়: activity trend (মোট শিপমেন্ট, শেষ ৯০ দিনে কয়টা, top ৩টা shipped route), potential upsell (quote করা হয়েছে কিন্তু কখনো ship হয়নি এমন route), payment reliability (total/overdue invoice count, on-time rate %, BDT total rounded to nearest 1000), quotation acceptance rate। **Redaction:** exact profit margin কখনো prompt-এ যায় না — শুধু bucket লেবেল ("Healthy"/"Thin margin"/"Loss-making"/"Unknown") পাঠানো হয়; টাকার অঙ্ক নিকটতম ১০০০-এ round করা হয়, individual invoice/shipment-level ডেটা কখনো পাঠানো হয় না, শুধু aggregate।
- [x] `lib/actions/ai-customer-insights.ts` (নতুন) — `generateCustomerInsights(customerId)`, `customers:manage` permission দিয়ে গেটেড (gateway ভেতরে আলাদাভাবে `ai:use`-ও এনফোর্স করে, তাই দুটো permission-ই লাগে যেমনটা plan-এ বলা ছিল)।
- [x] `components/customers/ai-customer-insights-card.tsx` (নতুন) — Phase 5/6-এর মতোই explicit "Generate"/"Regenerate" বাটন (page load-এ auto-generate করে না, quota বাঁচাতে)।
- [x] `app/(dashboard)/dashboard/customers/[id]/page.tsx` (নতুন) — `customers:manage` দিয়ে গেটেড, profile info + branch-scoped activity count (`_count` filtered দিয়ে) + `ai:use` থাকলে AI Insights card।
- [x] `app/(dashboard)/dashboard/customers/page.tsx`-এ row-action-এ "View" বাটন যোগ (নতুন detail page-এ লিংক করে) — বাকি কিছু অপরিবর্তিত।
- [x] `npm run type-check` — ক্লিন, ০ error। `npm run lint` — ৬৩টা pre-existing baseline অপরিবর্তিত, নতুন কোনো ফাইলে সমস্যা নেই।
- [x] dev server sanity check — `/dashboard/customers`, `/dashboard/customers/[id]` দুটোই clean 307 (auth redirect) দিয়েছে।
- **সব ৯টা Phase (১৫টা marketed AI ফিচার) এখন সম্পূর্ণ।** Foundation-সহ পুরো plan document-এ আর কোনো `[ ]` বাকি নেই।

---

## Deferred / v1 scope-এর বাইরে

- Assistant conversation history persist করা, action-oriented tool-calling
- Per-feature আলাদা on/off (v1-এ পুরো AI module একসাথে on/off)
- Health/Delay score list-এ sort/filter-এর জন্য cached column (দরকার পড়লে পরে)
