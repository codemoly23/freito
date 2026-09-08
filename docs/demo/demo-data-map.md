# Demo Data Map

This map explains the Phase 18A demo data in business language. All names and records are fictional.

## Demo Company

- Freight Control Demo Company
- Slug: `demo-freight`

## Demo Customers

- Demo Client Company
- Bengal Apparel Export Ltd.
- Metro Electronics Importers
- Global Trading & Logistics

## Demo Vendors

- Blue Horizon Ocean Line: ocean carrier / shipping line
- SkyBridge Air Cargo: airline / air cargo provider
- Delta C&F Services: C&F agent
- PrimeMover Delivery Fleet: trucking and delivery vendor
- HarborLink Destination Agents: overseas destination agent

## Demo Job Scenarios

### A. Sea Import, Port to Port, Active

- Job: `JOB-DEMO-2026-0001`
- Customer: Demo Client Company
- Route: Shanghai to Chattogram
- Purpose: Shows active workload, missing documents, attention-needed operations, and open finance.
- Good demo areas: dashboard warnings, shipment detail, document gap, operations report.

### B. Air Export, In Progress

- Job: `JOB-DEMO-2026-0002`
- Customer: Bengal Apparel Export Ltd.
- Route: Dhaka to Frankfurt
- Purpose: Shows air shipment workflow, MAWB/HAWB context, and in-progress operations.
- Good demo areas: air export job file, documentation, operational workload.

### C. Door to Door, Delivered + POD Completed

- Job: `JOB-DEMO-2026-0003`
- Customer: Demo Client Company
- Route: Singapore to Dhaka
- Purpose: Shows completed delivery, POD verified, and close-ready finance status.
- Good demo areas: delivery/POD workflow, client portal tracking, closeout readiness.

### D. Delivered But Finance Open

- Job: `JOB-DEMO-2026-0004`
- Customer: Demo Client Company
- Route: Benapole to Dhaka
- Purpose: Shows the common owner question: cargo delivered, but money and closeout are still pending.
- Good demo areas: dashboard warning, finance closeout queue, pending receivable/payable.

### E. Finance Locked / Final Profit

- Job: `JOB-DEMO-2026-0005`
- Customer: Global Trading & Logistics
- Route: Chattogram to Felixstowe
- Purpose: Shows finalized financial closeout and final profit snapshot for authorized users only.
- Good demo areas: finance report, final profit, management view, locked closeout.

## Demo Quotations

- `QT-DEMO-2026-0001`: pending/sent quote for Metro Electronics Importers
- `QT-DEMO-2026-0002`: accepted quote for Demo Client Company, converted to `JOB-DEMO-2026-0001`
- `QT-DEMO-2026-0003`: rejected air export quote for Global Trading & Logistics

## Documents Included

- HBL
- HAWB
- Manifest
- Customer Debit Note
- External documents
- Delivery Order
- Gate Pass
- POD
- Commercial Invoice and Packing List style document records

Client-visible documents are meant to be safe for portal display. Internal/vendor/cost records remain backoffice-only.

## Finance Examples

- Customer invoices
- Vendor bills
- Payment received
- Pending receivable
- Pending payable
- Finance close-ready job
- Finance locked job with final profit snapshot

Sensitive finance fields are for authorized company users only and must not be shown in the client portal.

