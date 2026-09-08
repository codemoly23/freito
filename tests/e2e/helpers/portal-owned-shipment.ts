import "dotenv/config";
import { expect, type Page } from "@playwright/test";
import mariadb from "mariadb";
import { randomUUID } from "node:crypto";
import { waitForHydration } from "./auth";
import { generateTestName } from "./test-data";

type ShipmentOptions = {
  prefix: string;
  transportMode?: "SEA" | "AIR";
  shipmentType?: "IMPORT" | "EXPORT";
  serviceScope?: "PORT_TO_PORT" | "DOOR_TO_DOOR";
  loadType?: "FCL" | "AIR_CARGO";
};

async function createDbConnection() {
  const databaseUrl = new URL(process.env.DATABASE_URL ?? "");
  return mariadb.createConnection({
    host: databaseUrl.hostname,
    port: databaseUrl.port ? Number(databaseUrl.port) : 3306,
    user: decodeURIComponent(databaseUrl.username),
    password: decodeURIComponent(databaseUrl.password),
    database: databaseUrl.pathname.slice(1),
  });
}

async function findShipmentByShipperName(shipperName: string) {
  const connection = await createDbConnection();
  try {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const [shipment] = await connection.query<{ id: string; jobNo: string }[]>(
        `SELECT id, jobNo
         FROM ShipmentJob
         WHERE shipperName = ? AND deletedAt IS NULL
         ORDER BY createdAt DESC
         LIMIT 1`,
        [shipperName],
      );
      if (shipment) return { shipmentId: shipment.id, jobNo: shipment.jobNo };
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  } finally {
    await connection.end();
  }

  throw new Error(`Shipment was not created for ${shipperName}`);
}

async function linkShipmentToDemoPortal(shipmentId: string, options: Required<ShipmentOptions>) {
  const connection = await createDbConnection();
  const stableTimestamp = new Date("2024-01-04T00:00:00.000Z");

  try {
    const [scope] = await connection.query<{
      companyId: string;
      customerId: string;
      accountId: string;
    }[]>(
      `SELECT c.id AS companyId, cpa.customerId AS customerId, cpa.id AS accountId
       FROM Company c
       JOIN ClientPortalAccount cpa ON cpa.companyId = c.id
       WHERE c.portalSlug = ? AND cpa.deletedAt IS NULL AND cpa.displayClientCode = ?
       LIMIT 1`,
      ["demo-freight", "DFC-CL-2026-0001"],
    );
    expect(scope).toBeTruthy();

    const requestId = `req_${randomUUID().replace(/-/g, "")}`;
    const requestNo = `REQ-P12-${randomUUID().slice(0, 8).toUpperCase()}`;

    await connection.query(
      `UPDATE Customer
       SET deletedAt = NULL, updatedAt = ?
       WHERE id = ? AND companyId = ?`,
      [stableTimestamp, scope.customerId, scope.companyId],
    );
    await connection.query(
      `UPDATE ShipmentJob
       SET customerId = ?, updatedAt = ?
       WHERE id = ? AND companyId = ?`,
      [scope.customerId, stableTimestamp, shipmentId, scope.companyId],
    );
    await connection.query(
      `INSERT INTO ShipmentRequest (
        id, companyId, customerId, clientPortalAccountId, requestNo, status,
        shipmentType, transportMode, serviceScope, loadType, originCountry,
        originPort, destinationCountry, destinationPort, cargoDescription,
        customerReference, convertedShipmentJobId, source, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, 'CONVERTED', ?, ?, ?, ?,
        ?, ?, ?, ?, 'Phase 12 professional output cargo',
        'Phase 12 document portal ownership', ?, 'CLIENT_PORTAL', ?, ?)`,
      [
        requestId,
        scope.companyId,
        scope.customerId,
        scope.accountId,
        requestNo,
        options.shipmentType,
        options.transportMode,
        options.serviceScope,
        options.loadType,
        options.transportMode === "AIR" ? "Bangladesh" : "China",
        options.transportMode === "AIR" ? "DAC" : "Shanghai",
        options.transportMode === "AIR" ? "USA" : "Bangladesh",
        options.transportMode === "AIR" ? "JFK" : "Chattogram",
        shipmentId,
        stableTimestamp,
        stableTimestamp,
      ],
    );
  } finally {
    await connection.end();
  }
}

export async function createPortalOwnedShipment(page: Page, options: ShipmentOptions) {
  const shipmentOptions: Required<ShipmentOptions> = {
    transportMode: options.transportMode ?? "SEA",
    shipmentType: options.shipmentType ?? "IMPORT",
    serviceScope: options.serviceScope ?? "PORT_TO_PORT",
    loadType: options.loadType ?? (options.transportMode === "AIR" ? "AIR_CARGO" : "FCL"),
    prefix: options.prefix,
  };

  await page.goto("/dashboard/shipments/new");
  await waitForHydration(page);

  const jobRef = generateTestName(shipmentOptions.prefix);
  await page.fill('input[name="shipperName"]', jobRef);
  await page.selectOption('select[name="shipmentType"]', shipmentOptions.shipmentType);
  await page.selectOption('select[name="transportMode"]', shipmentOptions.transportMode);
  await page.selectOption('select[name="loadType"]', shipmentOptions.loadType);
  await page.selectOption('select[name="serviceScope"]', shipmentOptions.serviceScope);
  await page.selectOption('select[name="customerId"]', { index: 1 });
  await page.fill('input[name="originCountry"]', shipmentOptions.transportMode === "AIR" ? "Bangladesh" : "China");
  await page.fill('input[name="originPort"]', shipmentOptions.transportMode === "AIR" ? "DAC" : "Shanghai");
  await page.fill('input[name="destinationCountry"]', shipmentOptions.transportMode === "AIR" ? "USA" : "Bangladesh");
  await page.fill('input[name="destinationPort"]', shipmentOptions.transportMode === "AIR" ? "JFK" : "Chattogram");
  await page.fill('textarea[name="cargoDescription"]', "Phase 12 professional output cargo");
  await page.selectOption('select[name="assignedToId"]', { index: 1 });

  await page.getByRole("button", { name: "Create shipment" }).click();
  const created = await findShipmentByShipperName(jobRef);
  await linkShipmentToDemoPortal(created.shipmentId, shipmentOptions);

  return {
    ...created,
    href: `/dashboard/shipments/${created.shipmentId}`,
  };
}
