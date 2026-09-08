import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions/rbac";
import { getEnabledModules } from "@/lib/access/company-access";
import { branchScopeWhere, getAccessibleBranchIds } from "@/lib/access/branch-access";
import { parseSmartSearchQuery } from "@/lib/ai/smart-search";

export const dynamic = "force-dynamic";

const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 100;
const PER_MODEL_LIMIT = 5;
const TOTAL_LIMIT = 25;

type SearchResultType = "customer" | "shipment" | "quotation" | "invoice" | "vendor" | "document";

type SearchResult = {
  type: SearchResultType;
  id: string;
  title: string;
  secondary: string | null;
  href: string;
  branchLabel: string | null;
};

function noStore(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.scope !== "COMPANY" || !user.companyId) {
    return noStore({ ok: false, results: [] }, 401);
  }

  const companyId = user.companyId;
  const permissions = user.permissions ?? [];

  const { searchParams } = new URL(request.url);
  const rawQuery = (searchParams.get("q") ?? "").trim();

  if (rawQuery.length < MIN_QUERY_LENGTH) {
    return noStore({ ok: true, results: [], query: rawQuery });
  }
  // Bound the query length so a pathological input can't inflate the LIKE scan.
  let query = rawQuery.slice(0, MAX_QUERY_LENGTH);
  let interpretedQuery: string | null = null;

  // "Ask AI" mode: turn a natural-language question into the literal keyword
  // the substring search below actually needs. Everything downstream (per-
  // entity permission/module/branch scoping, the search functions themselves)
  // is completely unchanged -- this only swaps what `query` holds. Any
  // gateway failure (AI off, not configured, quota, etc.) silently falls
  // back to plain keyword search with the original text.
  if (searchParams.get("ai") === "1" && hasPermission(user, "ai:use")) {
    const parsed = await parseSmartSearchQuery({ id: user.id, companyId, permissions }, query);
    if (parsed.ok && parsed.data.keyword.trim()) {
      interpretedQuery = parsed.data.keyword.trim().slice(0, MAX_QUERY_LENGTH);
      query = interpretedQuery;
    }
  }

  const [accessibleBranchIds, enabledModules] = await Promise.all([
    getAccessibleBranchIds({ userId: user.id, companyId, permissions }),
    getEnabledModules(companyId),
  ]);
  const branchWhere = branchScopeWhere(accessibleBranchIds);
  const modules = new Set(enabledModules);

  const searches: Array<Promise<SearchResult[]>> = [];

  if (hasPermission(user, "customers:manage")) {
    searches.push(searchCustomers(companyId, query));
  }
  if (hasPermission(user, "vendors:manage")) {
    searches.push(searchVendors(companyId, query));
  }
  if (modules.has("SHIPMENTS") && hasPermission(user, "shipments:view")) {
    searches.push(searchShipments(companyId, branchWhere, query));
  }
  if (modules.has("QUOTATIONS") && hasPermission(user, "quotations:view")) {
    searches.push(searchQuotations(companyId, branchWhere, query));
  }
  if (modules.has("BILLING") && hasPermission(user, "invoices:view")) {
    searches.push(searchInvoices(companyId, branchWhere, query));
  }
  if (modules.has("DOCUMENTS") && hasPermission(user, "documents:view")) {
    searches.push(searchDocuments(companyId, branchWhere, query));
  }

  const resultGroups = await Promise.all(searches);
  const results = resultGroups.flat().slice(0, TOTAL_LIMIT);

  return noStore({ ok: true, results, query: rawQuery, interpretedQuery });
}

async function searchCustomers(companyId: string, query: string): Promise<SearchResult[]> {
  const rows = await prisma.customer.findMany({
    where: {
      companyId,
      deletedAt: null,
      OR: [
        { name: { contains: query } },
        { code: { contains: query } },
        { email: { contains: query } },
        { phone: { contains: query } },
      ],
    },
    select: { id: true, name: true, code: true, email: true },
    orderBy: { name: "asc" },
    take: PER_MODEL_LIMIT,
  });

  return rows.map((row) => ({
    type: "customer",
    id: row.id,
    title: row.name,
    secondary: row.code ?? row.email ?? null,
    href: `/dashboard/customers?edit=${row.id}`,
    branchLabel: null,
  }));
}

async function searchVendors(companyId: string, query: string): Promise<SearchResult[]> {
  const rows = await prisma.vendor.findMany({
    where: {
      companyId,
      deletedAt: null,
      OR: [{ name: { contains: query } }, { email: { contains: query } }, { phone: { contains: query } }],
    },
    select: { id: true, name: true, type: true },
    orderBy: { name: "asc" },
    take: PER_MODEL_LIMIT,
  });

  return rows.map((row) => ({
    type: "vendor",
    id: row.id,
    title: row.name,
    secondary: row.type,
    href: `/dashboard/vendors?edit=${row.id}`,
    branchLabel: null,
  }));
}

async function searchShipments(
  companyId: string,
  branchWhere: ReturnType<typeof branchScopeWhere>,
  query: string,
): Promise<SearchResult[]> {
  const rows = await prisma.shipmentjob.findMany({
    where: {
      companyId,
      deletedAt: null,
      ...branchWhere,
      OR: [
        { jobNo: { contains: query } },
        { mblNo: { contains: query } },
        { hblNo: { contains: query } },
        { mawbNo: { contains: query } },
        { hawbNo: { contains: query } },
        { bookingNo: { contains: query } },
        { shipperName: { contains: query } },
        { consigneeName: { contains: query } },
      ],
    },
    select: {
      id: true,
      jobNo: true,
      shipperName: true,
      consigneeName: true,
      currentStatus: true,
      branch: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: PER_MODEL_LIMIT,
  });

  return rows.map((row) => ({
    type: "shipment",
    id: row.id,
    title: row.jobNo,
    secondary: row.shipperName ?? row.consigneeName ?? row.currentStatus ?? null,
    href: `/dashboard/shipments/${row.id}`,
    branchLabel: row.branch?.name ?? null,
  }));
}

async function searchQuotations(
  companyId: string,
  branchWhere: ReturnType<typeof branchScopeWhere>,
  query: string,
): Promise<SearchResult[]> {
  const rows = await prisma.quotation.findMany({
    where: {
      companyId,
      deletedAt: null,
      ...branchWhere,
      quoteNo: { contains: query },
    },
    select: {
      id: true,
      quoteNo: true,
      status: true,
      customer: { select: { name: true } },
      branch: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: PER_MODEL_LIMIT,
  });

  return rows.map((row) => ({
    type: "quotation",
    id: row.id,
    title: row.quoteNo,
    secondary: row.customer?.name ?? row.status,
    href: `/dashboard/quotations/${row.id}`,
    branchLabel: row.branch?.name ?? null,
  }));
}

async function searchInvoices(
  companyId: string,
  branchWhere: ReturnType<typeof branchScopeWhere>,
  query: string,
): Promise<SearchResult[]> {
  const rows = await prisma.invoice.findMany({
    where: {
      companyId,
      deletedAt: null,
      ...branchWhere,
      invoiceNo: { contains: query },
    },
    select: {
      id: true,
      invoiceNo: true,
      status: true,
      customer: { select: { name: true } },
      branch: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: PER_MODEL_LIMIT,
  });

  return rows.map((row) => ({
    type: "invoice",
    id: row.id,
    title: row.invoiceNo,
    secondary: row.customer?.name ?? row.status,
    href: `/dashboard/invoices/${row.id}`,
    branchLabel: row.branch?.name ?? null,
  }));
}

async function searchDocuments(
  companyId: string,
  branchWhere: ReturnType<typeof branchScopeWhere>,
  query: string,
): Promise<SearchResult[]> {
  const perSourceLimit = Math.ceil(PER_MODEL_LIMIT / 2);

  const [shipmentDocs, freightDocs] = await Promise.all([
    prisma.shipmentdocument.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...branchWhere,
        OR: [{ documentName: { contains: query } }, { documentType: { contains: query } }],
      },
      select: {
        id: true,
        documentName: true,
        documentType: true,
        shipmentJobId: true,
        branch: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: perSourceLimit,
    }),
    prisma.freightdocument.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...branchWhere,
        OR: [{ documentNo: { contains: query } }, { referenceNo: { contains: query } }],
      },
      select: {
        id: true,
        documentNo: true,
        referenceNo: true,
        type: true,
        shipmentJobId: true,
        branch: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: perSourceLimit,
    }),
  ]);

  const results: SearchResult[] = [
    ...shipmentDocs.map((row) => ({
      type: "document" as const,
      id: row.id,
      title: row.documentName,
      secondary: row.documentType,
      href: `/dashboard/shipments/${row.shipmentJobId}`,
      branchLabel: row.branch?.name ?? null,
    })),
    ...freightDocs.map((row) => ({
      type: "document" as const,
      id: row.id,
      title: row.documentNo,
      secondary: row.referenceNo ?? row.type,
      href: `/dashboard/shipments/${row.shipmentJobId}`,
      branchLabel: row.branch?.name ?? null,
    })),
  ];

  return results.slice(0, PER_MODEL_LIMIT);
}
