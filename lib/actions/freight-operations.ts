"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ensureModuleAccess } from "@/lib/access/company-access";
import { prisma } from "@/lib/db/prisma";
import { createUserNotification } from "@/lib/notifications/create-notification";
import { audit, getScopedCompanyId, getString } from "@/lib/actions/helpers";
import { recalculateShipmentWorkflow } from "@/lib/actions/shipment-workflow";
import { emailSmtpProvider } from "@/lib/communications/providers/email-smtp";
import { environmentProviderConfig } from "@/lib/communications/accounts";
import type { EmailSmtpConfig } from "@/lib/communications/providers/types";
import { branchScopeWhere, getCurrentBranchScope } from "@/lib/access/branch-access";
import type { vendor_type, billoflading_approvalStatus } from "@/lib/generated/prisma/client";

const date = (value: string) => value ? new Date(value) : null;
const decimal = (value: string) => value ? Number(value) : null;
const checked = (formData: FormData, key: string) => formData.get(key) === "on";

async function scope(permission: Parameters<typeof getScopedCompanyId>[0]) {
  const context = await getScopedCompanyId(permission);
  if (await ensureModuleAccess(context.companyId, "SHIPMENT_OPERATIONS")) {
    redirect("/module-disabled");
  }
  return context;
}

async function shipment(id: string, companyId: string) {
  const accessibleBranchIds = await getCurrentBranchScope(companyId);
  return prisma.shipmentjob.findFirst({
    where: { id, companyId, deletedAt: null, ...branchScopeWhere(accessibleBranchIds) },
    include: { customer: true, container: { where: { deletedAt: null } } },
  });
}

export async function createCarrierQuery(formData: FormData) {
  const { user, companyId } = await scope("carrierQueries:create");
  const accessibleBranchIds = await getCurrentBranchScope(companyId);
  const shipmentRequestId = getString(formData, "shipmentRequestId") || null;
  const shipmentJobId = getString(formData, "shipmentJobId") || null;
  const vendorId = getString(formData, "vendorId");
  const [request, job, vendor] = await Promise.all([
    shipmentRequestId ? prisma.shipmentrequest.findFirst({ where: { id: shipmentRequestId, companyId, deletedAt: null, ...branchScopeWhere(accessibleBranchIds) } }) : null,
    shipmentJobId ? shipment(shipmentJobId, companyId) : null,
    prisma.vendor.findFirst({ where: { id: vendorId, companyId, deletedAt: null, status: "ACTIVE" } }),
  ]);
  if ((!request && !job) || !vendor) redirect("/dashboard/carrier-queries/new?error=invalid-scope");
  const query = await prisma.carrierquery.create({
    data: {
      id: randomUUID(),
      companyId,
      shipmentRequestId: request?.id,
      shipmentJobId: job?.id,
      vendorId: vendor.id,
      mode: (getString(formData, "mode") || request?.transportMode || job?.transportMode || "SEA") as "SEA" | "AIR" | "LAND",
      origin: getString(formData, "origin") || `${request?.originCountry ?? job?.originCountry}${request?.originPort || job?.originPort ? ` / ${request?.originPort ?? job?.originPort}` : ""}`,
      destination: getString(formData, "destination") || `${request?.destinationCountry ?? job?.destinationCountry}${request?.destinationPort || job?.destinationPort ? ` / ${request?.destinationPort ?? job?.destinationPort}` : ""}`,
      cargoSummary: getString(formData, "cargoSummary") || request?.cargoDescription || job?.cargoDescription || "",
      hsCode: getString(formData, "hsCode") || request?.hsCode || job?.hsCode,
      weight: decimal(getString(formData, "weight")) ?? request?.grossWeight ?? job?.grossWeight,
      cbm: decimal(getString(formData, "cbm")) ?? request?.cbm ?? job?.cbm,
      packageInfo: getString(formData, "packageInfo") || [request?.packageCount ?? job?.packageCount, request?.packageType ?? job?.packageType].filter(Boolean).join(" "),
      containerRequirement: getString(formData, "containerRequirement") || request?.containerRequirement,
      requestedDate: date(getString(formData, "requestedDate")),
      responseDueAt: date(getString(formData, "responseDueAt")),
      notes: getString(formData, "notes") || null,
      status: getString(formData, "status") === "SENT" ? "SENT" : "DRAFT",
      querySentAt: getString(formData, "status") === "SENT" ? new Date() : null,
      updatedAt: new Date(),
    },
  });
  await audit({ companyId, actorId: user.id, action: getString(formData, "status") === "SENT" ? "CARRIER_QUERY_SENT" : "CARRIER_QUERY_CREATED", entityType: "CarrierQuery", entityId: query.id });
  redirect(`/dashboard/carrier-queries/${query.id}`);
}

// Vendor type → transport mode mapping
function vendorTypesForMode(mode: string): vendor_type[] {
  if (mode === "SEA") return ["SHIPPING_LINE"];
  if (mode === "AIR") return ["AIRLINE"];
  if (mode === "LAND") return ["TRUCK_VENDOR"];
  return ["SHIPPING_LINE", "AIRLINE", "TRUCK_VENDOR"];
}

// Build professional RFQ email body (text + HTML)
function buildRfqEmail(params: {
  companyName: string;
  companyEmail: string;
  mode: string;
  origin: string;
  destination: string;
  cargoSummary: string;
  hsCode?: string | null;
  weight?: string | null;
  cbm?: string | null;
  packageInfo?: string | null;
  containerRequirement?: string | null;
  responseDueAt?: string | null;
  notes?: string | null;
}) {
  const modeLabel = params.mode === "SEA" ? "Ocean Freight" : params.mode === "AIR" ? "Air Freight" : "Road/Land Freight";
  const subject = `Request for Freight Quotation – ${params.mode} – ${params.origin} → ${params.destination}`;

  const textBody = [
    `Dear Sir/Madam,`,
    ``,
    `We request your best freight quotation for the following shipment:`,
    ``,
    `  Transport Mode  : ${modeLabel}`,
    `  Origin          : ${params.origin || "—"}`,
    `  Destination     : ${params.destination || "—"}`,
    `  Cargo Summary   : ${params.cargoSummary || "—"}`,
    params.hsCode   ? `  HS Code         : ${params.hsCode}` : null,
    params.weight   ? `  Gross Weight    : ${params.weight} KG` : null,
    params.cbm      ? `  CBM             : ${params.cbm}` : null,
    params.packageInfo ? `  Packages        : ${params.packageInfo}` : null,
    params.containerRequirement ? `  Container Req.  : ${params.containerRequirement}` : null,
    params.responseDueAt ? `  Response Due By : ${params.responseDueAt}` : null,
    params.notes ? `\nAdditional Notes:\n${params.notes}` : null,
    ``,
    `Kindly provide your best rates along with:`,
    `  • Transit time`,
    `  • Free time at destination`,
    `  • Rate validity`,
    `  • Any applicable local charges`,
    ``,
    `Best regards,`,
    `${params.companyName}`,
    `${params.companyEmail}`,
  ].filter(Boolean).join("\n");

  const htmlBody = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
      <div style="background:#1e3a5f;padding:20px 24px;">
        <h2 style="color:#ffffff;margin:0;font-size:18px;">Request for Freight Quotation</h2>
        <p style="color:#93c5fd;margin:4px 0 0;font-size:13px;">${modeLabel} &nbsp;|&nbsp; ${params.origin} → ${params.destination}</p>
      </div>
      <div style="padding:24px;background:#ffffff;">
        <p style="color:#374151;font-size:14px;">Dear Sir/Madam,</p>
        <p style="color:#374151;font-size:14px;">We request your best freight quotation for the following shipment:</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;">
          <tr style="background:#f8fafc;"><td style="padding:8px 12px;font-weight:600;color:#374151;border:1px solid #e2e8f0;width:40%;">Transport Mode</td><td style="padding:8px 12px;color:#1f2937;border:1px solid #e2e8f0;">${modeLabel}</td></tr>
          <tr><td style="padding:8px 12px;font-weight:600;color:#374151;border:1px solid #e2e8f0;">Origin</td><td style="padding:8px 12px;color:#1f2937;border:1px solid #e2e8f0;">${params.origin || "—"}</td></tr>
          <tr style="background:#f8fafc;"><td style="padding:8px 12px;font-weight:600;color:#374151;border:1px solid #e2e8f0;">Destination</td><td style="padding:8px 12px;color:#1f2937;border:1px solid #e2e8f0;">${params.destination || "—"}</td></tr>
          <tr><td style="padding:8px 12px;font-weight:600;color:#374151;border:1px solid #e2e8f0;">Cargo Summary</td><td style="padding:8px 12px;color:#1f2937;border:1px solid #e2e8f0;">${params.cargoSummary || "—"}</td></tr>
          ${params.hsCode ? `<tr style="background:#f8fafc;"><td style="padding:8px 12px;font-weight:600;color:#374151;border:1px solid #e2e8f0;">HS Code</td><td style="padding:8px 12px;color:#1f2937;border:1px solid #e2e8f0;">${params.hsCode}</td></tr>` : ""}
          ${params.weight ? `<tr><td style="padding:8px 12px;font-weight:600;color:#374151;border:1px solid #e2e8f0;">Gross Weight</td><td style="padding:8px 12px;color:#1f2937;border:1px solid #e2e8f0;">${params.weight} KG</td></tr>` : ""}
          ${params.cbm ? `<tr style="background:#f8fafc;"><td style="padding:8px 12px;font-weight:600;color:#374151;border:1px solid #e2e8f0;">CBM</td><td style="padding:8px 12px;color:#1f2937;border:1px solid #e2e8f0;">${params.cbm}</td></tr>` : ""}
          ${params.packageInfo ? `<tr><td style="padding:8px 12px;font-weight:600;color:#374151;border:1px solid #e2e8f0;">Packages</td><td style="padding:8px 12px;color:#1f2937;border:1px solid #e2e8f0;">${params.packageInfo}</td></tr>` : ""}
          ${params.containerRequirement ? `<tr style="background:#f8fafc;"><td style="padding:8px 12px;font-weight:600;color:#374151;border:1px solid #e2e8f0;">Container Req.</td><td style="padding:8px 12px;color:#1f2937;border:1px solid #e2e8f0;">${params.containerRequirement}</td></tr>` : ""}
          ${params.responseDueAt ? `<tr><td style="padding:8px 12px;font-weight:600;color:#374151;border:1px solid #e2e8f0;">Response Due By</td><td style="padding:8px 12px;color:#1f2937;border:1px solid #e2e8f0;">${params.responseDueAt}</td></tr>` : ""}
        </table>
        ${params.notes ? `<div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:6px;padding:12px;margin:12px 0;font-size:13px;color:#92400e;"><strong>Notes:</strong> ${params.notes}</div>` : ""}
        <p style="color:#374151;font-size:13px;">Kindly provide your best rates along with transit time, free time, rate validity, and any applicable local charges.</p>
        <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;color:#6b7280;">
          <strong>${params.companyName}</strong><br/>${params.companyEmail}
        </div>
      </div>
    </div>
  `;

  return { subject, textBody, htmlBody };
}

// Send RFQ email to ALL vendors matching the transport mode, in BCC
export async function sendCarrierQueryBlast(formData: FormData): Promise<{ ok: boolean; message: string; sentCount: number; skippedCount: number }> {
  const { user, companyId } = await scope("carrierQueries:create");

  const shipmentRequestId = getString(formData, "shipmentRequestId") || null;
  const shipmentJobId = getString(formData, "shipmentJobId") || null;
  const mode = (getString(formData, "mode") || "SEA") as "SEA" | "AIR" | "LAND";
  const origin = getString(formData, "origin");
  const destination = getString(formData, "destination");
  const cargoSummary = getString(formData, "cargoSummary");
  const hsCode = getString(formData, "hsCode") || null;
  const weight = getString(formData, "weight") || null;
  const cbm = getString(formData, "cbm") || null;
  const packageInfo = getString(formData, "packageInfo") || null;
  const containerRequirement = getString(formData, "containerRequirement") || null;
  const responseDueAt = getString(formData, "responseDueAt") || null;
  const notes = getString(formData, "notes") || null;

  if (!cargoSummary) {
    return { ok: false, message: "Cargo summary is required.", sentCount: 0, skippedCount: 0 };
  }

  // Fetch company details for email sender info
  const company = await prisma.company.findFirst({
    where: { id: companyId, deletedAt: null },
    select: { name: true, email: true },
  });

  // Fetch all matching vendors with their emails
  const allowedTypes = vendorTypesForMode(mode);
  const vendors = await prisma.vendor.findMany({
    where: {
      companyId,
      deletedAt: null,
      status: "ACTIVE",
      type: { in: allowedTypes },
    },
    include: {
      vendorcontact: {
        where: { email: { not: null } },
        select: { email: true },
      },
    },
    orderBy: { name: "asc" },
  });

  // Collect unique BCC email addresses
  const vendorEmailMap = new Map<string, string>(); // vendorId → email
  for (const vendor of vendors) {
    const email = vendor.email || vendor.vendorcontact[0]?.email;
    if (email) vendorEmailMap.set(vendor.id, email);
  }

  const bccEmails = Array.from(vendorEmailMap.values());
  const skippedVendors = vendors.filter((v) => !vendorEmailMap.has(v.id));

  if (bccEmails.length === 0) {
    return {
      ok: false,
      message: `No ${mode} vendors with email addresses found. Add emails to vendors first.`,
      sentCount: 0,
      skippedCount: vendors.length,
    };
  }

  // Build email content
  const { subject, textBody, htmlBody } = buildRfqEmail({
    companyName: company?.name || "Freight Forwarder",
    companyEmail: company?.email || user.email || "",
    mode,
    origin,
    destination,
    cargoSummary,
    hsCode,
    weight,
    cbm,
    packageInfo,
    containerRequirement,
    responseDueAt,
    notes,
  });

  // Send single email with all vendors in BCC
  const smtpConfig = environmentProviderConfig("EMAIL_SMTP") as EmailSmtpConfig;
  const emailResult = await emailSmtpProvider.send(smtpConfig, {
    channel: "EMAIL",
    recipientEmail: company?.email || user.email || "",
    bcc: bccEmails,
    subject,
    messageBody: textBody,
    htmlBody,
  });

  // Create CarrierQuery records for each vendor for tracking
  const now = new Date();
  await prisma.carrierquery.createMany({
    data: Array.from(vendorEmailMap.entries()).map(([vendorId]) => ({
      id: randomUUID(),
      companyId,
      shipmentRequestId,
      shipmentJobId,
      vendorId,
      mode,
      origin,
      destination,
      cargoSummary,
      hsCode,
      weight: weight ? Number(weight) : null,
      cbm: cbm ? Number(cbm) : null,
      packageInfo,
      containerRequirement,
      responseDueAt: responseDueAt ? new Date(responseDueAt) : null,
      notes,
      status: emailResult.ok ? "SENT" : "DRAFT",
      querySentAt: emailResult.ok ? now : null,
      updatedAt: now,
    })),
  });

  await audit({
    companyId,
    actorId: user.id,
    action: "CARRIER_QUERY_SENT",
    entityType: "CarrierQuery",
    entityId: companyId,
    metadata: {
      mode,
      vendorCount: vendorEmailMap.size,
      bccCount: bccEmails.length,
      emailResult: emailResult.ok,
    },
  });

  revalidatePath("/dashboard/carrier-queries");

  return {
    ok: emailResult.ok,
    message: emailResult.ok
      ? `RFQ sent to ${bccEmails.length} vendor${bccEmails.length > 1 ? "s" : ""} via BCC.${skippedVendors.length > 0 ? ` ${skippedVendors.length} vendor(s) skipped (no email).` : ""}`
      : `Email delivery failed: ${emailResult.error}`,
    sentCount: emailResult.ok ? bccEmails.length : 0,
    skippedCount: skippedVendors.length,
  };
}

export async function addCarrierProposal(formData: FormData) {
  const { user, companyId } = await scope("carrierProposals:manage");
  const carrierQueryId = getString(formData, "carrierQueryId");
  const query = await prisma.carrierquery.findFirst({ where: { id: carrierQueryId, companyId, deletedAt: null } });
  if (!query) return;
  const proposal = await prisma.carrierproposal.create({
    data: {
      id: randomUUID(),
      companyId, carrierQueryId, vendorId: query.vendorId,
      buyingFreightAmount: Number(getString(formData, "buyingFreightAmount") || 0),
      localCharges: Number(getString(formData, "localCharges") || 0),
      currency: (getString(formData, "currency") || "USD") as "BDT" | "USD" | "EUR" | "GBP",
      validUntil: date(getString(formData, "validUntil")),
      transitTime: getString(formData, "transitTime") || null,
      etd: date(getString(formData, "etd")), eta: date(getString(formData, "eta")),
      freeTime: getString(formData, "freeTime") || null,
      routeNote: getString(formData, "routeNote") || null,
      terms: getString(formData, "terms") || null,
      providerReference: getString(formData, "providerReference") || null,
      updatedAt: new Date(),
    },
  });
  await prisma.carrierquery.update({ where: { id: query.id }, data: { status: "PROPOSAL_RECEIVED", updatedAt: new Date() } });
  await audit({ companyId, actorId: user.id, action: "CARRIER_PROPOSAL_RECEIVED", entityType: "CarrierProposal", entityId: proposal.id });
  revalidatePath(`/dashboard/carrier-queries/${query.id}`);
}

export async function selectCarrierProposal(formData: FormData) {
  const { user, companyId } = await scope("carrierProposals:select");
  const proposalId = getString(formData, "proposalId");
  const quotationId = getString(formData, "quotationId") || null;
  const proposal = await prisma.carrierproposal.findFirst({ where: { id: proposalId, companyId, deletedAt: null }, include: { carrierquery: true } });
  if (!proposal) return;
  const now = new Date();
  await prisma.$transaction([
    prisma.carrierproposal.updateMany({ where: { carrierQueryId: proposal.carrierQueryId }, data: { selected: false, status: "REJECTED", updatedAt: now } }),
    prisma.carrierproposal.update({ where: { id: proposal.id }, data: { selected: true, status: "SELECTED", updatedAt: now } }),
    prisma.carrierquery.update({ where: { id: proposal.carrierQueryId }, data: { status: "SELECTED", updatedAt: now } }),
    ...(quotationId ? [prisma.quotation.updateMany({ where: { id: quotationId, companyId }, data: { selectedCarrierProposalId: proposal.id, updatedAt: now } })] : []),
  ]);
  await audit({ companyId, actorId: user.id, action: "CARRIER_PROPOSAL_SELECTED", entityType: "CarrierProposal", entityId: proposal.id, metadata: { carrierQueryId: proposal.carrierQueryId, selectedAt: now.toISOString() } });
  revalidatePath(`/dashboard/carrier-queries/${proposal.carrierQueryId}`);
}

export async function saveBooking(formData: FormData) {
  const { user, companyId } = await scope("bookings:manage");
  const shipmentJobId = getString(formData, "shipmentJobId");
  const job = await shipment(shipmentJobId, companyId);
  const vendor = await prisma.vendor.findFirst({ where: { id: getString(formData, "vendorId"), companyId, deletedAt: null } });
  if (!job || !vendor) return;
  const status = (getString(formData, "status") || "BOOKING_REQUESTED") as "BOOKING_REQUESTED" | "BOOKING_ACKNOWLEDGED" | "BOOKING_CONFIRMED" | "FORWARDED_TO_CUSTOMER" | "CANCELLED" | "AMENDED";
  const now = new Date();
  const record = await prisma.freightbooking.upsert({
    where: { shipmentJobId },
    create: { id: randomUUID(), companyId, shipmentJobId, vendorId: vendor.id, status, sentById: user.id, bookingRequestAt: now, providerReference: getString(formData, "providerReference") || null, confirmationNumber: getString(formData, "confirmationNumber") || null, notes: getString(formData, "notes") || null, acknowledgedAt: status === "BOOKING_ACKNOWLEDGED" ? now : null, confirmedAt: status === "BOOKING_CONFIRMED" ? now : null, forwardedToCustomer: status === "FORWARDED_TO_CUSTOMER", forwardedAt: status === "FORWARDED_TO_CUSTOMER" ? now : null, updatedAt: now },
    update: { vendorId: vendor.id, status, providerReference: getString(formData, "providerReference") || null, confirmationNumber: getString(formData, "confirmationNumber") || null, notes: getString(formData, "notes") || null, acknowledgedAt: status === "BOOKING_ACKNOWLEDGED" ? now : undefined, confirmedAt: status === "BOOKING_CONFIRMED" ? now : undefined, forwardedToCustomer: status === "FORWARDED_TO_CUSTOMER", forwardedAt: status === "FORWARDED_TO_CUSTOMER" ? now : undefined, updatedAt: now },
  });
  const action = status === "BOOKING_ACKNOWLEDGED" ? "BOOKING_ACKNOWLEDGED" : status === "BOOKING_CONFIRMED" ? "BOOKING_CONFIRMED" : status === "FORWARDED_TO_CUSTOMER" ? "BOOKING_FORWARDED_TO_CUSTOMER" : "BOOKING_REQUESTED";
  await audit({ companyId, actorId: user.id, action, entityType: "FreightBooking", entityId: record.id });
  if (status === "BOOKING_CONFIRMED") await createUserNotification({ companyId, userId: job.assignedToId, type: "BOOKING_CONFIRMED", title: "Booking confirmed", message: `Booking confirmed for ${job.jobNo}.`, linkUrl: `/dashboard/shipments/${job.id}/operations` });
  await recalculateShipmentWorkflow(shipmentJobId);
  revalidatePath(`/dashboard/shipments/${job.id}/operations`);
}

export async function saveStuffingPlan(formData: FormData) {
  const { user, companyId } = await scope("bookings:manage");
  const shipmentJobId = getString(formData, "shipmentJobId");
  if (!await shipment(shipmentJobId, companyId)) return;
  const now = new Date();
  const plan = await prisma.stuffingplan.upsert({
    where: { shipmentJobId },
    create: { id: randomUUID(), companyId, shipmentJobId, status: getString(formData, "status") as never, depotLocation: getString(formData, "depotLocation") || null, plannedStuffingAt: date(getString(formData, "plannedStuffingAt")), actualStuffingAt: date(getString(formData, "actualStuffingAt")), containersRequired: Number(getString(formData, "containersRequired") || 0) || null, remarks: getString(formData, "remarks") || null, updatedAt: now },
    update: { status: getString(formData, "status") as never, depotLocation: getString(formData, "depotLocation") || null, plannedStuffingAt: date(getString(formData, "plannedStuffingAt")), actualStuffingAt: date(getString(formData, "actualStuffingAt")), containersRequired: Number(getString(formData, "containersRequired") || 0) || null, remarks: getString(formData, "remarks") || null, updatedAt: now },
  });
  await audit({ companyId, actorId: user.id, action: "STUFFING_PLAN_UPDATED", entityType: "StuffingPlan", entityId: plan.id });
  revalidatePath(`/dashboard/shipments/${shipmentJobId}/operations`);
}

export async function saveShippingInstruction(formData: FormData) {
  const { user, companyId } = await scope("shippingInstructions:manage");
  const shipmentJobId = getString(formData, "shipmentJobId");
  const job = await shipment(shipmentJobId, companyId);
  if (!job) return;
  const status = (getString(formData, "status") || "DRAFT") as "DRAFT" | "READY" | "SUBMITTED" | "ACCEPTED" | "REVISION_REQUIRED" | "CANCELLED";
  const now = new Date();
  const data = {
    status, bookingReference: getString(formData, "bookingReference") || null,
    shipper: getString(formData, "shipper") || job.shipperName, consignee: getString(formData, "consignee") || job.consigneeName,
    notifyParty: getString(formData, "notifyParty") || job.notifyParty, vesselVoyageFlight: getString(formData, "vesselVoyageFlight") || [job.vesselName, job.voyageNo, job.flightNo].filter(Boolean).join(" / "),
    placeOfReceipt: getString(formData, "placeOfReceipt") || job.placeOfReceipt, portOfLoading: getString(formData, "portOfLoading") || job.originPort,
    portOfDischarge: getString(formData, "portOfDischarge") || job.destinationPort, finalDestination: getString(formData, "finalDestination") || job.placeOfDelivery,
    etd: date(getString(formData, "etd")) || job.etd, eta: date(getString(formData, "eta")) || job.eta,
    cargoDescription: getString(formData, "cargoDescription") || job.cargoDescription, hsCode: getString(formData, "hsCode") || job.hsCode,
    packageCount: Number(getString(formData, "packageCount") || job.packageCount || 0) || null, packageType: getString(formData, "packageType") || job.packageType,
    grossWeight: decimal(getString(formData, "grossWeight")) ?? job.grossWeight, netWeight: decimal(getString(formData, "netWeight")) ?? job.netWeight,
    cbm: decimal(getString(formData, "cbm")) ?? job.cbm, containerNumbers: getString(formData, "containerNumbers") || job.container.map(c => c.containerNo).join(", "),
    sealNumbers: getString(formData, "sealNumbers") || job.container.map(c => c.sealNo).filter(Boolean).join(", "),
    freightTerm: (getString(formData, "freightTerm") || null) as "PREPAID" | "COLLECT" | null,
    releasePreference: (getString(formData, "releasePreference") || "NOT_APPLICABLE") as never,
    specialInstructions: getString(formData, "specialInstructions") || null,
    submittedAt: status === "SUBMITTED" ? new Date() : undefined, submittedById: status === "SUBMITTED" ? user.id : undefined,
    updatedAt: now,
  };
  const si = await prisma.shippinginstruction.upsert({ where: { shipmentJobId }, create: { id: randomUUID(), companyId, shipmentJobId, ...data }, update: data });
  await audit({ companyId, actorId: user.id, action: status === "SUBMITTED" ? "SI_SUBMITTED" : "SI_CREATED", entityType: "ShippingInstruction", entityId: si.id });
  await recalculateShipmentWorkflow(shipmentJobId);
  revalidatePath(`/dashboard/shipments/${shipmentJobId}/operations`);
}

export async function saveBillOfLading(formData: FormData) {
  const permission = getString(formData, "finalLocked") === "on" ? "billOfLading:lock" : "billOfLading:manage";
  const { user, companyId } = await scope(permission);
  const shipmentJobId = getString(formData, "shipmentJobId");
  const job = await shipment(shipmentJobId, companyId);
  if (!job) return;
  const existing = await prisma.billoflading.findUnique({ where: { shipmentJobId } });
  if (existing?.finalLocked && !checked(formData, "adminCorrection")) return;
  const finalLocked = checked(formData, "finalLocked");
  const requestedApproval = (getString(formData, "approvalStatus") || "NOT_RECEIVED") as billoflading_approvalStatus;
  const approvalStatus: billoflading_approvalStatus = finalLocked ? "FINAL_LOCKED" : requestedApproval;
  const now = new Date();
  const data = { documentType: (getString(formData, "documentType") || "HBL") as never, draftNumber: getString(formData, "draftNumber") || null, draftReceivedAt: date(getString(formData, "draftReceivedAt")), draftForwardedAt: date(getString(formData, "draftForwardedAt")), approvalStatus, customerApprovalAt: approvalStatus === "APPROVED_BY_CUSTOMER" ? new Date() : undefined, customerCorrectionRemarks: getString(formData, "customerCorrectionRemarks") || null, finalNumber: getString(formData, "finalNumber") || null, finalLocked, finalLockedAt: finalLocked ? new Date() : null, releaseType: (getString(formData, "releaseType") || "NOT_APPLICABLE") as never, releaseStatus: (getString(formData, "releaseStatus") || "PENDING") as never, releaseReference: getString(formData, "releaseReference") || null, paymentReceived: checked(formData, "paymentReceived"), notes: getString(formData, "notes") || null, updatedAt: now };
  const bl = await prisma.billoflading.upsert({ where: { shipmentJobId }, create: { id: randomUUID(), companyId, shipmentJobId, shippingInstructionId: getString(formData, "shippingInstructionId") || null, ...data }, update: data });
  const action = finalLocked ? "FINAL_BL_LOCKED" : approvalStatus === "APPROVED_BY_CUSTOMER" ? "DRAFT_BL_APPROVED" : approvalStatus === "SENT_TO_CUSTOMER" ? "DRAFT_BL_FORWARDED" : "DRAFT_BL_RECEIVED";
  await audit({ companyId, actorId: user.id, action, entityType: "BillOfLading", entityId: bl.id });
  if (finalLocked) await createUserNotification({ companyId, userId: job.assignedToId, type: "FINAL_BL_LOCKED", title: "Final BL locked", message: `Final BL/AWB locked for ${job.jobNo}.`, linkUrl: `/dashboard/shipments/${job.id}/operations` });
  await recalculateShipmentWorkflow(shipmentJobId);
  revalidatePath(`/dashboard/shipments/${shipmentJobId}/operations`);
}

export async function generatePreAlert(formData: FormData) {
  const { user, companyId } = await scope("preAlerts:manage");
  const shipmentJobId = getString(formData, "shipmentJobId");
  const job = await shipment(shipmentJobId, companyId);
  if (!job) return;
  const status = (getString(formData, "status") || "READY") as "DRAFT" | "READY" | "SENT" | "ACKNOWLEDGED" | "REVISION_REQUIRED" | "CANCELLED";
  const agentId = getString(formData, "destinationAgentId") || null;
  if (agentId && !await prisma.vendor.findFirst({ where: { id: agentId, companyId, deletedAt: null } })) return;
  const now = new Date();
  const preAlert = await prisma.prealert.upsert({ where: { shipmentJobId }, create: { id: randomUUID(), companyId, shipmentJobId, destinationAgentId: agentId, status, sentAt: status === "SENT" ? new Date() : null, invoiceAvailable: checked(formData, "invoiceAvailable"), packingListAvailable: checked(formData, "packingListAvailable"), attachedDocumentChecklist: getString(formData, "attachedDocumentChecklist") || null, chargesInstruction: getString(formData, "chargesInstruction") || null, remarks: getString(formData, "remarks") || null, updatedAt: now }, update: { destinationAgentId: agentId, status, sentAt: status === "SENT" ? new Date() : undefined, invoiceAvailable: checked(formData, "invoiceAvailable"), packingListAvailable: checked(formData, "packingListAvailable"), attachedDocumentChecklist: getString(formData, "attachedDocumentChecklist") || null, chargesInstruction: getString(formData, "chargesInstruction") || null, remarks: getString(formData, "remarks") || null, updatedAt: now } });
  await audit({ companyId, actorId: user.id, action: status === "SENT" ? "PRE_ALERT_SENT" : "PRE_ALERT_GENERATED", entityType: "PreAlert", entityId: preAlert.id });
  await createUserNotification({ companyId, userId: job.assignedToId, type: "PRE_ALERT_UPDATED", title: `Pre-alert ${status.toLowerCase()}`, message: `Pre-alert for ${job.jobNo} is ${status.toLowerCase()}.`, linkUrl: `/dashboard/shipments/${job.id}/operations` });
  await recalculateShipmentWorkflow(shipmentJobId);
  revalidatePath(`/dashboard/shipments/${shipmentJobId}/operations`);
}

export async function saveReleaseChecklist(formData: FormData) {
  const { user, companyId } = await scope("releaseChecks:manage");
  const shipmentJobId = getString(formData, "shipmentJobId");
  const job = await shipment(shipmentJobId, companyId);
  if (!job) return;
  const bl = await prisma.billoflading.findUnique({ where: { shipmentJobId } });
  const requestedStatus = getString(formData, "status") || "DOCUMENTS_PENDING";
  const paymentOk = checked(formData, "shipperPaymentConfirmed") && checked(formData, "customerPaymentConfirmed");
  const blOk = bl?.releaseType === "ORIGINAL_BL" ? checked(formData, "originalBlReceived") && checked(formData, "bankBlAuthenticityVerified") : ["SURRENDER_BL", "TELEX_RELEASE"].includes(bl?.releaseType ?? "") ? checked(formData, "telexSurrenderConfirmed") : true;
  const status = ["READY_FOR_RELEASE", "RELEASED", "DELIVERED"].includes(requestedStatus) && (!paymentOk || !blOk) ? (!paymentOk ? "PAYMENT_PENDING" : "BL_AUTH_PENDING") : requestedStatus;
  const now = new Date();
  const checklist = await prisma.cargoreleasechecklist.upsert({ where: { shipmentJobId }, create: { id: randomUUID(), companyId, shipmentJobId, status: status as never, arrived: checked(formData, "arrived"), arrivedAt: checked(formData, "arrived") ? now : null, arrivalNoticeReceived: checked(formData, "arrivalNoticeReceived"), consigneeDocumentsReceived: checked(formData, "consigneeDocumentsReceived"), shipperPaymentConfirmed: checked(formData, "shipperPaymentConfirmed"), customerPaymentConfirmed: checked(formData, "customerPaymentConfirmed"), bankBlAuthenticityVerified: checked(formData, "bankBlAuthenticityVerified"), originalBlReceived: checked(formData, "originalBlReceived"), telexSurrenderConfirmed: checked(formData, "telexSurrenderConfirmed"), deliveryOrderReleased: checked(formData, "deliveryOrderReleased"), customsReady: checked(formData, "customsReady"), cargoReleased: status === "RELEASED" || status === "DELIVERED", cargoReleasedAt: status === "RELEASED" || status === "DELIVERED" ? now : null, delivered: status === "DELIVERED", deliveredAt: status === "DELIVERED" ? now : null, holdReason: getString(formData, "holdReason") || null, updatedAt: now }, update: { status: status as never, arrived: checked(formData, "arrived"), arrivedAt: checked(formData, "arrived") ? now : undefined, arrivalNoticeReceived: checked(formData, "arrivalNoticeReceived"), consigneeDocumentsReceived: checked(formData, "consigneeDocumentsReceived"), shipperPaymentConfirmed: checked(formData, "shipperPaymentConfirmed"), customerPaymentConfirmed: checked(formData, "customerPaymentConfirmed"), bankBlAuthenticityVerified: checked(formData, "bankBlAuthenticityVerified"), originalBlReceived: checked(formData, "originalBlReceived"), telexSurrenderConfirmed: checked(formData, "telexSurrenderConfirmed"), deliveryOrderReleased: checked(formData, "deliveryOrderReleased"), customsReady: checked(formData, "customsReady"), cargoReleased: status === "RELEASED" || status === "DELIVERED", cargoReleasedAt: status === "RELEASED" || status === "DELIVERED" ? now : undefined, delivered: status === "DELIVERED", deliveredAt: status === "DELIVERED" ? now : undefined, holdReason: getString(formData, "holdReason") || null, updatedAt: now } });
  await audit({ companyId, actorId: user.id, action: status === "DELIVERED" ? "CARGO_DELIVERED" : status === "RELEASED" ? "CARGO_RELEASED" : "RELEASE_CHECK_UPDATED", entityType: "CargoReleaseChecklist", entityId: checklist.id });
  await recalculateShipmentWorkflow(shipmentJobId);
  revalidatePath(`/dashboard/shipments/${shipmentJobId}/operations`);
}
