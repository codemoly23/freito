# Demo Access Guide

These credentials are demo/local credentials only. Do not reuse them in production, do not share them as real client credentials, and do not enter confidential customer data into this environment.

## Local URL

- App URL: `http://localhost:3000`

## Platform Login

- URL: `http://localhost:3000/platform-login`
- Email: `platform@freightcontrol.com`
- Password: `Admin123`
- Use this only to show platform-level company/module administration.

## Company Dashboard Login

- URL: `http://localhost:3000/login`
- Email: `admin@freightcontrol.com`
- Password: `Admin123`
- Use this for the main freight forwarding company demo.

## Client Portal Login

- URL: `http://localhost:3000/portal/demo-freight/login`
- Client ID: `DFC-CL-2026-0001`
- Password: `Admin123`
- Use this to show client-safe shipment tracking, documents, invoices, and communication.

## Required Before Demo

- XAMPP MySQL must be running.
- Next.js must be running on localhost:

```powershell
npm.cmd run dev -- --webpack -H 0.0.0.0
```

- If the demo data needs to be reset:

```powershell
npm.cmd run demo:clean
npm.cmd run demo:seed
```

## Security Warning

This demo uses fictional local data and demo credentials only. Never load real client documents, commercial invoices, bank details, vendor cost sheets, or production passwords into the demo environment.

