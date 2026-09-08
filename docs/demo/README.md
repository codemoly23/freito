# Freight Control Demo Pack

This demo pack is for showing the Freight Control System to freight forwarding owners, managers, operations teams, documentation teams, accounts teams, and pilot customers.

It is designed for a clean local demo using fictional sample data only. It should help a viewer understand the daily operational workload, shipment file visibility, document control, delivery/POD workflow, finance closeout, client portal, and management reporting.

## Stable Base

- Commit: `a188c5b`
- Tag: `stable-demo-data-pack`
- Demo company slug: `demo-freight`
- Demo data pack: Phase 18A

## Who Should Use This

- Founders or sales team members preparing a client demo
- Product owners explaining the workflow to freight forwarding companies
- Implementation team members collecting pilot feedback
- Internal QA or support teams validating the demo flow

## Demo Preparation Checklist

- XAMPP MySQL is running.
- The local Next.js server is running on `http://localhost:3000`.
- The demo database has already been prepared with:
  - `npm.cmd run demo:clean`
  - `npm.cmd run demo:seed`
- Use only the demo/local credentials in the access guide.
- Open company dashboard, client portal, and reports in separate browser profiles if possible.
- Avoid showing browser autofill, local files, terminal secrets, or database credentials.

## What Not To Show

- Real client names, real shipment files, real invoices, or real documents.
- Buy cost, vendor cost, gross profit, final profit, margin, or vendor payable data to client portal users.
- Internal notes or backoffice-only documents in the client portal.
- Raw uploaded file paths or server paths.
- Platform/admin areas unless the audience is the system owner or internal admin team.

## Deferred Features And Limitations

The current demo is intentionally focused on core freight forwarding operations. The following items are future roadmap areas:

- Real-time shipping line, airline, customs, and port API integrations
- Deep accounting and ledger integration
- Tax/VAT workflows
- Claim and dispute management
- Advanced Excel, PDF, and BI export packs
- Production deployment hardening and customer-specific infrastructure setup

