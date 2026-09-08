import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requirePortalAccount } from "@/lib/client-portal/access";
import { PortalDocumentApprovalForm } from "@/components/forms/freight-document-forms";
import {
  clientApproveFreightDocument,
  clientRejectFreightDocument,
} from "@/lib/actions/portal-freight-documents";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Image from "next/image";

type PageProps = {
  params: Promise<{ companySlug: string; id: string; docId: string }>;
};

export default async function PortalFreightDocumentDetailPage({ params }: PageProps) {
  const { companySlug, id: shipmentJobId, docId } = await params;
  const { account } = await requirePortalAccount(companySlug);

  // Retrieve freight document with client portal context validation
  const docRaw = await prisma.freightdocument.findFirst({
    where: {
      id: docId,
      shipmentJobId,
      companyId: account.companyId,
      isClientVisible: true,
      visibility: "CLIENT_SAFE",
      type: {
        in: [
          "HBL",
          "HAWB",
          "MANIFEST",
          "DEBIT_NOTE",
          "COMMERCIAL_INVOICE",
          "PACKING_LIST",
          "CERTIFICATE_OF_ORIGIN",
          "MSDS_DG_CERTIFICATE",
          "INSURANCE_CERTIFICATE",
          "POD",
          "DELIVERY_CHALLAN",
          "DELIVERY_ORDER",
          "CUSTOMS_RELEASE",
        ],
      },
      deletedAt: null,
      shipmentjob: {
        customerId: account.customerId,
        deletedAt: null,
        shipmentrequest: {
          clientPortalAccountId: account.id,
          deletedAt: null,
        },
      },
    },
    include: {
      company: {
        select: {
          name: true,
          legalName: true,
          email: true,
          phone: true,
          address: true,
          logoPath: true,
          logoUpdatedAt: true,
          hblPrintWatermarkEnabled: true,
        },
      },
      documentversion: {
        orderBy: { versionNumber: "desc" },
        take: 1,
      },
    },
  });

  if (!docRaw) notFound();

  const doc = {
    ...docRaw,
    versions: docRaw.documentversion,
  };

  const version = doc.versions[0];
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const content = (version?.content || {}) as any;

  const hasLogo = Boolean(doc.company?.logoPath);
  const logoUrl = hasLogo ? `/api/portal/${companySlug}/branding/logo?v=${doc.company?.logoUpdatedAt ? new Date(doc.company.logoUpdatedAt).getTime() : ""}` : null;
  const companyName = doc.company?.name || "";
  const companyLegalName = doc.company?.legalName || companyName;
  const companyAddress = doc.company?.address || "";
  const companyEmail = doc.company?.email || "";
  const companyPhone = doc.company?.phone || "";

  const approveAction = clientApproveFreightDocument.bind(null, companySlug);
  const rejectAction = clientRejectFreightDocument.bind(null, companySlug);

  return (
    <main className="min-h-screen bg-slate-50 p-5 font-sans">
      <div className="mx-auto max-w-4xl space-y-6">
        <style
          dangerouslySetInnerHTML={{
            __html: `
              @media print {
                /* Enforce crisp deep black borders when printing */
                .border,
                .border-t,
                .border-b,
                .border-l,
                .border-r,
                .divide-y > *,
                .divide-x > *,
                table,
                tr,
                th,
                td {
                  border-color: #000000 !important;
                }
                /* Stretch containers to A4 / Letter full page fit */
                .print-page {
                  width: 100% !important;
                  min-height: 268mm !important;
                  height: 268mm !important;
                  max-height: 268mm !important;
                  display: flex !important;
                  flex-direction: column !important;
                  justify-content: space-between !important;
                  box-sizing: border-box !important;
                  border-radius: 0 !important;
                  padding: 12px !important;
                  margin: 0 !important;
                  box-shadow: none !important;
                  border: 1px solid #000000 !important;
                }
                .print-content {
                  display: flex !important;
                  flex-direction: column !important;
                  justify-content: space-between !important;
                  flex-grow: 1 !important;
                  height: 100% !important;
                }
              }
            `,
          }}
        />
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{doc.documentNo}</h1>
            <p className="text-xs text-slate-500">Document Type: {doc.type} | Version: v{version?.versionNumber || 1}</p>
          </div>
          <Button asChild variant="outline">
            <Link href={`/portal/${companySlug}/shipments/${shipmentJobId}`}>
              Back to Shipment
            </Link>
          </Button>
        </div>

        {/* Client Portal Action Form */}
        {doc.status === "UNDER_REVIEW" && (
          <PortalDocumentApprovalForm
            approveAction={approveAction}
            rejectAction={rejectAction}
            documentId={doc.id}
            documentNo={doc.documentNo}
          />
        )}

        {/* Premium Visual Layout of the Document (Sell-side Whitelisted Fields Only) */}
        {doc.type === "HBL" ? (
          <Card className="relative border border-slate-200 bg-white p-8 text-slate-950 text-xs shadow-sm space-y-0 leading-normal select-none overflow-hidden print-page">
            {/* Print Metadata label at top right */}
            <div className="absolute top-4 right-6 text-[8px] font-extrabold text-slate-950 uppercase tracking-wider z-20">
              Customer Copy
            </div>

            {/* Styled CSS Watermark Overlay in the middle background */}
            {doc.company.hblPrintWatermarkEnabled && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0 opacity-[0.04] overflow-hidden">
                <div className="text-[55px] font-black tracking-widest text-slate-950 uppercase rotate-[25deg] text-center whitespace-pre-line leading-none">
                  CUSTOMER COPY
                </div>
              </div>
            )}

            <div className="relative z-10 space-y-3 print-content">
            {/* Company Branding Header */}
            <div className="flex items-center justify-between border border-slate-900 border-b-0 p-3 bg-slate-50/50">
              {logoUrl ? (
                <Image
                  alt={`${companyName} logo`}
                  className="h-10 w-auto object-contain"
                  height={40}
                  src={logoUrl}
                  unoptimized
                  width={140}
                />
              ) : (
                <div className="text-[11px] font-bold text-slate-850 uppercase tracking-wide">
                  {companyName}
                </div>
              )}
              <div className="text-right text-[7px] text-slate-500 font-medium leading-normal">
                <p className="font-bold text-[8px] text-slate-850 uppercase">{companyLegalName}</p>
                {companyAddress && <p className="max-w-[200px] line-clamp-2">{companyAddress}</p>}
                <p>{[companyEmail, companyPhone].filter(Boolean).join(" | ")}</p>
              </div>
            </div>

            {/* Upper Section */}
            <div className="grid grid-cols-2 border border-slate-900 border-b-0 text-[10px]">
              {/* Left Column */}
              <div className="divide-y divide-slate-900 border-r border-slate-900">
                <div className="p-2 min-h-[90px] space-y-1">
                  <p className="font-bold text-[7px] text-slate-500 uppercase tracking-wider">Shipper</p>
                  <p className="whitespace-pre-line font-medium text-slate-800 text-[9px] leading-tight">{(content.clientFields?.shipper) || "—"}</p>
                </div>
                <div className="p-2 min-h-[90px] space-y-1">
                  <p className="font-bold text-[7px] text-slate-500 uppercase tracking-wider">Consignee (or order)</p>
                  <p className="whitespace-pre-line font-medium text-slate-800 text-[9px] leading-tight">{(content.clientFields?.consignee) || "—"}</p>
                </div>
                <div className="p-2 min-h-[90px] space-y-1">
                  <p className="font-bold text-[7px] text-slate-500 uppercase tracking-wider">Notify Party</p>
                  <p className="whitespace-pre-line font-medium text-slate-800 text-[9px] leading-tight">{(content.clientFields?.notifyParty) || "—"}</p>
                </div>
              </div>

              {/* Right Column */}
              <div className="divide-y divide-slate-900 flex flex-col justify-between">
                <div className="p-3 bg-slate-50 flex flex-col items-center justify-center text-center space-y-1 border-b border-slate-900">
                  <h4 className="font-bold text-[14px] text-emerald-800 tracking-wider">HOUSE BILL OF LADING</h4>
                  <p className="text-[7px] text-slate-400 uppercase">Non-negotiable unless consigned to order</p>
                </div>
                
                <div className="grid grid-cols-2 divide-x divide-slate-900 border-b border-slate-900">
                  <div className="p-2">
                    <p className="font-bold text-[7px] text-slate-500 uppercase">HBL Number</p>
                    <p className="font-mono font-bold text-slate-900 text-[10px]">{(content.clientFields?.hblNo) || "—"}</p>
                  </div>
                  <div className="p-2">
                    <p className="font-bold text-[7px] text-slate-500 uppercase">MBL Reference</p>
                    <p className="font-mono text-slate-700 text-[10px]">{(content.clientFields?.mblNo) || "—"}</p>
                  </div>
                </div>
                
                <div className="p-2 border-b border-slate-900">
                  <p className="font-bold text-[7px] text-slate-500 uppercase">Booking / Job Ref</p>
                  <p className="font-mono font-semibold text-slate-700">{(content.clientFields?.shipmentJobNo) || "—"}</p>
                </div>
                
                <div className="p-2 flex-grow space-y-1 bg-slate-50/50">
                  <p className="font-bold text-[6px] text-slate-400 uppercase">Instructions / Remarks</p>
                  <p className="text-[8px] text-slate-500 leading-tight">
                    Received by the Carrier in apparent good order and condition unless otherwise indicated hereon...
                  </p>
                </div>
              </div>
            </div>

            {/* Routing Section */}
            <div className="grid grid-cols-4 border border-slate-900 border-b-0 divide-x divide-slate-900 text-[10px]">
              <div className="p-2">
                <p className="font-bold text-[7px] text-slate-500 uppercase">Pre-Carriage / Place of Receipt</p>
                <p className="font-semibold text-slate-800 text-[9px] mt-0.5">{(content.clientFields?.placeOfReceipt) || "—"}</p>
              </div>
              <div className="p-2">
                <p className="font-bold text-[7px] text-slate-500 uppercase">Vessel & Voyage</p>
                <p className="font-semibold text-slate-800 text-[9px] mt-0.5">{(content.clientFields?.vessel) ? `${content.clientFields.vessel} v.${content.clientFields.voyage}` : "—"}</p>
              </div>
              <div className="p-2">
                <p className="font-bold text-[7px] text-slate-500 uppercase">Port of Loading</p>
                <p className="font-semibold text-slate-800 text-[9px] mt-0.5">{(content.clientFields?.portOfLoading) || "—"}</p>
              </div>
              <div className="p-2">
                <p className="font-bold text-[7px] text-slate-500 uppercase">Port of Discharge</p>
                <p className="font-semibold text-slate-800 text-[9px] mt-0.5">{(content.clientFields?.portOfDischarge) || "—"}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 border border-slate-900 border-b-0 divide-x divide-slate-900 text-[10px]">
              <div className="p-2">
                <p className="font-bold text-[7px] text-slate-500 uppercase">Place of Delivery</p>
                <p className="font-semibold text-slate-800 text-[9px] mt-0.5">{(content.clientFields?.placeOfDelivery) || "—"}</p>
              </div>
              <div className="p-2">
                <p className="font-bold text-[7px] text-slate-500 uppercase">Final Destination</p>
                <p className="font-semibold text-slate-800 text-[9px] mt-0.5">{(content.clientFields?.finalDestination) || "—"}</p>
              </div>
            </div>

            {/* Cargo Table */}
            <table className="w-full border border-slate-900 text-left text-[9px] leading-tight border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-900 font-bold text-[7px] uppercase text-slate-500 divide-x divide-slate-900">
                  <th className="p-2 w-1/4">Container / Seal / Marks</th>
                  <th className="p-2 w-1/6">No of Pkgs</th>
                  <th className="p-2 w-2/5">Description of Packages and Goods</th>
                  <th className="p-2 w-1/6 text-right">Gross Weight</th>
                  <th className="p-2 w-1/6 text-right">Measurement</th>
                </tr>
              </thead>
              <tbody>
                <tr className="divide-x divide-slate-900 align-top cargo-row">
                  <td className="p-2 font-mono text-[8px] space-y-1">
                    <p className="font-semibold text-slate-900">{(content.clientFields?.containerNo) ? `CNTR: ${content.clientFields.containerNo}` : ""}</p>
                    <p className="text-slate-600">{(content.clientFields?.sealNo) ? `SEAL: ${content.clientFields.sealNo}` : ""}</p>
                    <p className="text-slate-500">{(content.clientFields?.marksAndNumbers) || "N/A"}</p>
                  </td>
                  <td className="p-2 font-semibold text-slate-800">{(content.clientFields?.packages) || "—"}</td>
                  <td className="p-2 whitespace-pre-wrap text-slate-800 font-medium">
                    <p>{(content.clientFields?.goodsDescription) || "—"}</p>
                    {(content.clientFields?.hsCode) && <p className="text-[7px] text-slate-400 mt-1">HS Code: {content.clientFields.hsCode}</p>}
                  </td>
                  <td className="p-2 text-right font-mono font-semibold text-slate-900">{(content.clientFields?.grossWeight) || "—"}</td>
                  <td className="p-2 text-right font-mono font-semibold text-slate-900">{(content.clientFields?.measurement) || "—"}</td>
                </tr>
              </tbody>
            </table>

            {/* Lower details */}
            <div className="grid grid-cols-3 border border-slate-900 border-t-0 divide-x divide-slate-900 text-[10px]">
              <div className="p-2 divide-y divide-slate-900">
                <div className="pb-1.5">
                  <p className="font-bold text-[7px] text-slate-500 uppercase">Freight Terms</p>
                  <p className="font-bold text-slate-900 mt-0.5">{(content.clientFields?.freightTerm) || "—"}</p>
                </div>
                <div className="pt-1.5">
                  <p className="font-bold text-[7px] text-slate-500 uppercase">Original B/L Count</p>
                  <p className="font-semibold text-slate-800 mt-0.5">{(content.clientFields?.originalBlCount) || "3"}</p>
                </div>
              </div>

              <div className="p-2 divide-y divide-slate-900 flex flex-col justify-between">
                <div>
                  <p className="font-bold text-[7px] text-slate-500 uppercase">Place & Date of Issue</p>
                  <p className="font-semibold text-slate-800 mt-0.5">
                    {(content.clientFields?.issuePlace) || "—"}
                    {(content.clientFields?.issueDate) ? ` | ${new Date(content.clientFields.issueDate).toLocaleDateString()}` : ""}
                  </p>
                </div>
                {(content.clientFields?.onBoardDate) && (
                  <div className="pt-1.5">
                    <p className="font-bold text-[7px] text-slate-500 uppercase">Laden On Board Date</p>
                    <p className="font-mono text-emerald-800 text-[8px] mt-0.5">{new Date(content.clientFields.onBoardDate).toLocaleDateString()}</p>
                  </div>
                )}
              </div>

              <div className="p-2 flex flex-col justify-between bg-slate-50/50 min-h-[90px]">
                <div>
                  <p className="font-bold text-[6px] text-slate-400 uppercase text-center">Signed on behalf of Carrier</p>
                </div>
                <div className="border-t border-dashed border-slate-400 pt-1 text-center text-slate-400 text-[8px] italic">
                  Authorized Signature
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center text-[10px] text-slate-450 pt-3 border-t mt-4">
              <p>Freight Terms: <span className="font-bold text-slate-700">{(content.clientFields?.freightTerm) || "—"}</span></p>
              <p className="italic">Note: Internal notes, buying costs, and margins are excluded from portal review views for confidentiality.</p>
            </div>
            </div>
          </Card>
        ) : doc.type === "HAWB" ? (
          <Card className="border border-slate-200 bg-white p-8 text-slate-950 text-xs shadow-sm space-y-0 leading-normal select-none print-page">
            <div className="print-content space-y-3 flex-grow">
            {/* Company Branding Header */}
            <div className="flex items-center justify-between border border-slate-900 border-b-0 p-3 bg-slate-50/50">
              {logoUrl ? (
                <Image
                  alt={`${companyName} logo`}
                  className="h-10 w-auto object-contain"
                  height={40}
                  src={logoUrl}
                  unoptimized
                  width={140}
                />
              ) : (
                <div className="text-[11px] font-bold text-slate-850 uppercase tracking-wide">
                  {companyName}
                </div>
              )}
              <div className="text-right text-[7px] text-slate-500 font-medium leading-normal">
                <p className="font-bold text-[8px] text-slate-850 uppercase">{companyLegalName}</p>
                {companyAddress && <p className="max-w-[200px] line-clamp-2">{companyAddress}</p>}
                <p>{[companyEmail, companyPhone].filter(Boolean).join(" | ")}</p>
              </div>
            </div>

            {/* Upper Section */}
            <div className="grid grid-cols-2 border border-slate-900 border-b-0 text-[10px]">
              {/* Left Column */}
              <div className="divide-y divide-slate-900 border-r border-slate-900">
                <div className="p-2 min-h-[70px] space-y-1">
                  <p className="font-bold text-[7px] text-slate-500 uppercase tracking-wider">Shipper</p>
                  <p className="whitespace-pre-line font-medium text-slate-800 text-[9px] leading-tight">{(content.clientFields?.shipper) || "—"}</p>
                </div>
                <div className="p-2 min-h-[70px] space-y-1">
                  <p className="font-bold text-[7px] text-slate-500 uppercase tracking-wider">Consignee</p>
                  <p className="whitespace-pre-line font-medium text-slate-800 text-[9px] leading-tight">{(content.clientFields?.consignee) || "—"}</p>
                </div>
                <div className="p-2 min-h-[70px] space-y-1">
                  <p className="font-bold text-[7px] text-slate-500 uppercase tracking-wider">Notify Party</p>
                  <p className="whitespace-pre-line font-medium text-slate-800 text-[9px] leading-tight">{(content.clientFields?.notifyParty) || "—"}</p>
                </div>
              </div>

              {/* Right Column */}
              <div className="divide-y divide-slate-900 flex flex-col justify-between">
                <div className="p-3 bg-slate-50 flex flex-col items-center justify-center text-center space-y-1 border-b border-slate-900">
                  <h4 className="font-bold text-[14px] text-emerald-800 tracking-wider">HOUSE AIR WAYBILL</h4>
                  <p className="text-[7px] text-slate-400 uppercase">Non-negotiable Air Waybill</p>
                </div>
                
                <div className="grid grid-cols-2 divide-x divide-slate-900 border-b border-slate-900">
                  <div className="p-2">
                    <p className="font-bold text-[7px] text-slate-500 uppercase">HAWB Number</p>
                    <p className="font-mono font-bold text-slate-900 text-[10px]">{(content.clientFields?.hawbNo) || "—"}</p>
                  </div>
                  <div className="p-2">
                    <p className="font-bold text-[7px] text-slate-500 uppercase">MAWB Reference</p>
                    <p className="font-mono text-slate-700 text-[10px]">{(content.clientFields?.mawbNo) || "—"}</p>
                  </div>
                </div>
                
                <div className="p-2 border-b border-slate-900">
                  <p className="font-bold text-[7px] text-slate-500 uppercase">Booking / Job Ref</p>
                  <p className="font-mono font-semibold text-slate-700">{(content.clientFields?.shipmentJobNo) || "—"}</p>
                </div>
                
                <div className="p-2 flex-grow space-y-1 bg-slate-50/50">
                  <p className="font-bold text-[6px] text-slate-400 uppercase">Instructions / Remarks</p>
                  <p className="text-[8px] text-slate-500 leading-tight">
                    It is agreed that the goods described herein are accepted in apparent good order and condition...
                  </p>
                </div>
              </div>
            </div>

            {/* Routing Section */}
            <div className="grid grid-cols-3 border border-slate-900 border-b-0 divide-x divide-slate-900 text-[10px]">
              <div className="p-2">
                <p className="font-bold text-[7px] text-slate-500 uppercase">Airport of Departure</p>
                <p className="font-semibold text-slate-800 text-[9px] mt-0.5">{(content.clientFields?.airportOfDeparture) || "—"}</p>
              </div>
              <div className="p-2">
                <p className="font-bold text-[7px] text-slate-500 uppercase">Airport of Destination</p>
                <p className="font-semibold text-slate-800 text-[9px] mt-0.5">{(content.clientFields?.airportOfDestination) || "—"}</p>
              </div>
              <div className="p-2">
                <p className="font-bold text-[7px] text-slate-500 uppercase">Requested Routing</p>
                <p className="font-semibold text-slate-800 text-[9px] mt-0.5">{(content.clientFields?.requestedRouting) || "—"}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 border border-slate-900 border-b-0 divide-x divide-slate-900 text-[10px]">
              <div className="p-2">
                <p className="font-bold text-[7px] text-slate-500 uppercase">Flight No</p>
                <p className="font-semibold text-slate-800 text-[9px] mt-0.5">{(content.clientFields?.flightNo) || "—"}</p>
              </div>
              <div className="p-2">
                <p className="font-bold text-[7px] text-slate-500 uppercase">Flight Date</p>
                <p className="font-semibold text-slate-800 text-[9px] mt-0.5">
                  {(content.clientFields?.flightDate) ? new Date(content.clientFields.flightDate).toLocaleDateString() : "—"}
                </p>
              </div>
            </div>

            {/* Cargo Table */}
            <table className="w-full border border-slate-900 text-left text-[9px] leading-tight border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-900 font-bold text-[7px] uppercase text-slate-500 divide-x divide-slate-900">
                  <th className="p-2 w-1/12">Pieces</th>
                  <th className="p-2 w-2/12">Gross Weight</th>
                  <th className="p-2 w-2/12">Chargeable Wt</th>
                  <th className="p-2 w-5/12">Nature and Quantity of Goods (incl. Dims)</th>
                  <th className="p-2 w-2/12 text-right">Declared Value</th>
                </tr>
              </thead>
              <tbody>
                <tr className="divide-x divide-slate-900 align-top cargo-row">
                  <td className="p-2 font-semibold text-slate-800">{(content.clientFields?.pieces) || "—"}</td>
                  <td className="p-2 font-mono text-[8px] text-slate-900">{(content.clientFields?.grossWeight) || "—"}</td>
                  <td className="p-2 font-mono text-[8px] text-slate-900">{(content.clientFields?.chargeableWeight) || "—"}</td>
                  <td className="p-2 whitespace-pre-wrap text-slate-800 font-medium">
                    <p>{(content.clientFields?.commodity) || "—"}</p>
                    {(content.clientFields?.dimensions) && <p className="text-[7px] text-slate-400 mt-1">Dims: {content.clientFields.dimensions}</p>}
                    {(content.clientFields?.handlingInformation) && <p className="text-[7px] text-slate-400 mt-1">Handling: {content.clientFields.handlingInformation}</p>}
                  </td>
                  <td className="p-2 text-right font-mono text-slate-900">
                    <p className="text-[7px] text-slate-400">Carriage: {(content.clientFields?.declaredValueForCarriage) || "NVD"}</p>
                    <p className="text-[7px] text-slate-400">Customs: {(content.clientFields?.declaredValueForCustoms) || "NCV"}</p>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Lower details */}
            <div className="grid grid-cols-3 border border-slate-900 border-t-0 divide-x divide-slate-900 text-[10px]">
              <div className="p-2 divide-y divide-slate-900">
                <div className="pb-1.5">
                  <p className="font-bold text-[7px] text-slate-500 uppercase">Freight Terms</p>
                  <p className="font-bold text-slate-900 mt-0.5">{(content.clientFields?.freightTerm) || "—"}</p>
                </div>
              </div>

              <div className="p-2 divide-y divide-slate-900 flex flex-col justify-between">
                <div>
                  <p className="font-bold text-[7px] text-slate-500 uppercase">Place & Date of Issue</p>
                  <p className="font-semibold text-slate-800 mt-0.5">
                    {(content.clientFields?.issuePlace) || "—"}
                    {(content.clientFields?.issueDate) ? ` | ${new Date(content.clientFields.issueDate).toLocaleDateString()}` : ""}
                  </p>
                </div>
              </div>

              <div className="p-2 flex flex-col justify-between bg-slate-50/50 min-h-[70px]">
                <div>
                  <p className="font-bold text-[6px] text-slate-400 uppercase text-center">Signature of Issuing Carrier/Agent</p>
                </div>
                <div className="border-t border-dashed border-slate-400 pt-1 text-center text-slate-400 text-[8px] italic">
                  Authorized Signature
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center text-[10px] text-slate-455 pt-3 border-t mt-4">
              <p>Freight Terms: <span className="font-bold text-slate-700">{(content.clientFields?.freightTerm) || "—"}</span></p>
              <p className="italic">Note: Internal notes, buying costs, and margins are excluded from portal review views for confidentiality.</p>
            </div>
            </div>
          </Card>
        ) : doc.type === "MANIFEST" ? (
          <Card className="border border-slate-200 bg-white p-8 text-slate-950 text-xs shadow-sm space-y-0 leading-normal select-none print-page">
            <div className="print-content space-y-3 flex-grow">
            {/* Company Branding Header */}
            <div className="flex items-center justify-between border border-slate-900 border-b-0 p-3 bg-slate-50/50">
              {logoUrl ? (
                <Image
                  alt={`${companyName} logo`}
                  className="h-10 w-auto object-contain"
                  height={40}
                  src={logoUrl}
                  unoptimized
                  width={140}
                />
              ) : (
                <div className="text-[11px] font-bold text-slate-850 uppercase tracking-wide">
                  {companyName}
                </div>
              )}
              <div className="text-right text-[7px] text-slate-500 font-medium leading-normal">
                <p className="font-bold text-[8px] text-slate-850 uppercase">{companyLegalName}</p>
                {companyAddress && <p className="max-w-[200px] line-clamp-2">{companyAddress}</p>}
                <p>{[companyEmail, companyPhone].filter(Boolean).join(" | ")}</p>
              </div>
            </div>

             {/* Header Title & Disclosures */}
            <div className="flex flex-col items-center justify-center text-center pb-3 pt-3 border-x border-b border-slate-900 border-t-0 space-y-0.5">
              <h4 className="font-bold text-[14px] text-emerald-800 tracking-wider">
                {content.clientFields?.manifestType === "SEA" ? "OCEAN FREIGHT CARGO MANIFEST" : "AIR CARGO MANIFEST"}
              </h4>
              <p className="text-[8px] text-slate-500 font-medium uppercase">
                {content.clientFields?.manifestType === "SEA" ? "Forwarder Ocean Consolidation Manifest" : "Forwarder Consolidation Cargo Manifest"}
              </p>
              <p className="text-[7px] text-slate-400 italic">
                {content.clientFields?.manifestType === "SEA"
                  ? "This software-generated document is a forwarder operational summary, not an official shipping-line document."
                  : "This software-generated document is a forwarder operational summary, not an official airline-issued document."}
              </p>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 border border-slate-900 border-t-0 text-[9px] divide-x divide-slate-900">
              <div className="divide-y divide-slate-900">
                <div className="p-2">
                  <p className="font-bold text-[7px] text-slate-500 uppercase">Manifest Number</p>
                  <p className="font-mono font-bold text-slate-900 text-[10px]">{(content.clientFields?.manifestNo) || "—"}</p>
                </div>
                <div className="p-2">
                  <p className="font-bold text-[7px] text-slate-500 uppercase">Manifest Date</p>
                  <p className="font-medium text-slate-800">{(content.clientFields?.manifestDate) || "—"}</p>
                </div>
                <div className="p-2">
                  <p className="font-bold text-[7px] text-slate-500 uppercase">Shipment Job No</p>
                  <p className="font-mono text-slate-700">{(content.clientFields?.shipmentJobNo) || "—"}</p>
                </div>
              </div>
              <div className="divide-y divide-slate-900">
                {content.clientFields?.manifestType === "SEA" ? (
                  <>
                    <div className="p-2">
                      <p className="font-bold text-[7px] text-slate-500 uppercase">MBL Reference</p>
                      <p className="font-mono text-slate-700 text-[10px]">{(content.clientFields?.mblNo) || "—"}</p>
                    </div>
                    <div className="p-2">
                      <p className="font-bold text-[7px] text-slate-500 uppercase">HBL Reference</p>
                      <p className="font-mono text-slate-700 text-[10px]">{(content.clientFields?.hblNo) || "—"}</p>
                    </div>
                    <div className="p-2">
                      <p className="font-bold text-[7px] text-slate-500 uppercase">Vessel / Voyage</p>
                      <p className="font-semibold text-slate-800">
                        {[(content.clientFields?.vesselName), (content.clientFields?.voyageNo)].filter(Boolean).join(" / ") || "—"}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="p-2">
                      <p className="font-bold text-[7px] text-slate-500 uppercase">MAWB Reference</p>
                      <p className="font-mono text-slate-700 text-[10px]">{(content.clientFields?.mawbNo) || "—"}</p>
                    </div>
                    <div className="p-2">
                      <p className="font-bold text-[7px] text-slate-500 uppercase">HAWB Reference</p>
                      <p className="font-mono text-slate-700 text-[10px]">{(content.clientFields?.hawbNo) || "—"}</p>
                    </div>
                    <div className="p-2">
                      <p className="font-bold text-[7px] text-slate-500 uppercase">Airline / Carrier</p>
                      <p className="font-semibold text-slate-800">{(content.clientFields?.airline) || "—"}</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Routing & Flight Grid */}
            <div className="grid grid-cols-4 border border-slate-900 border-t-0 divide-x divide-slate-900 text-[9px]">
              {content.clientFields?.manifestType === "SEA" ? (
                <>
                  <div className="p-2">
                    <p className="font-bold text-[7px] text-slate-500 uppercase">Vessel</p>
                    <p className="font-semibold text-slate-800">{(content.clientFields?.vesselName) || "—"}</p>
                  </div>
                  <div className="p-2">
                    <p className="font-bold text-[7px] text-slate-500 uppercase">On Board Date</p>
                    <p className="font-semibold text-slate-800">
                      {content.clientFields?.onBoardDate ? new Date(content.clientFields.onBoardDate).toLocaleDateString() : "—"}
                    </p>
                  </div>
                  <div className="p-2">
                    <p className="font-bold text-[7px] text-slate-500 uppercase">Port of Loading</p>
                    <p className="font-semibold text-slate-800">{content.clientFields?.portOfLoading ? `${content.clientFields.portOfLoading} (${content.clientFields.originCountry || ""})` : "—"}</p>
                  </div>
                  <div className="p-2">
                    <p className="font-bold text-[7px] text-slate-500 uppercase">Port of Discharge</p>
                    <p className="font-semibold text-slate-800">{content.clientFields?.portOfDischarge ? `${content.clientFields.portOfDischarge} (${content.clientFields.destinationCountry || ""})` : "—"}</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="p-2">
                    <p className="font-bold text-[7px] text-slate-500 uppercase">Flight No</p>
                    <p className="font-semibold text-slate-800">{(content.clientFields?.flightNo) || "—"}</p>
                  </div>
                  <div className="p-2">
                    <p className="font-bold text-[7px] text-slate-500 uppercase">Flight Date</p>
                    <p className="font-semibold text-slate-800">
                      {content.clientFields?.flightDate ? new Date(content.clientFields.flightDate).toLocaleDateString() : "—"}
                    </p>
                  </div>
                  <div className="p-2">
                    <p className="font-bold text-[7px] text-slate-500 uppercase">Departure Airport</p>
                    <p className="font-semibold text-slate-800">{content.clientFields?.airportOfDeparture ? `${content.clientFields.airportOfDeparture} (${content.clientFields.originCountry || ""})` : "—"}</p>
                  </div>
                  <div className="p-2">
                    <p className="font-bold text-[7px] text-slate-500 uppercase">Destination Airport</p>
                    <p className="font-semibold text-slate-800">{content.clientFields?.airportOfDestination ? `${content.clientFields.airportOfDestination} (${content.clientFields.destinationCountry || ""})` : "—"}</p>
                  </div>
                </>
              )}
            </div>

            {/* Shipper & Consignee */}
            <div className="grid grid-cols-2 border border-slate-900 border-t-0 text-[9px] divide-x divide-slate-900">
              <div className="p-2 min-h-[60px] space-y-1">
                <p className="font-bold text-[7px] text-slate-500 uppercase">Shipper</p>
                <p className="whitespace-pre-line font-medium text-slate-800 leading-tight">{(content.clientFields?.shipper) || "—"}</p>
              </div>
              <div className="p-2 min-h-[60px] space-y-1">
                <p className="font-bold text-[7px] text-slate-500 uppercase">Consignee</p>
                <p className="whitespace-pre-line font-medium text-slate-800 leading-tight">{(content.clientFields?.consignee) || "—"}</p>
              </div>
            </div>

            {/* Cargo Details */}
            <div className="grid grid-cols-4 border border-slate-900 border-t-0 text-[9px] divide-x divide-slate-900">
              <div className="p-2">
                <p className="font-bold text-[7px] text-slate-500 uppercase">Total Pieces</p>
                <p className="font-semibold text-slate-800">{(content.clientFields?.totalPieces) || "—"}</p>
              </div>
              <div className="p-2">
                <p className="font-bold text-[7px] text-slate-500 uppercase">Gross Weight</p>
                <p className="font-mono text-slate-900">{(content.clientFields?.grossWeight) || "—"}</p>
              </div>
              <div className="p-2">
                <p className="font-bold text-[7px] text-slate-500 uppercase">Chargeable Weight</p>
                <p className="font-mono text-slate-900">{(content.clientFields?.chargeableWeight) || "—"}</p>
              </div>
              <div className="p-2">
                <p className="font-bold text-[7px] text-slate-500 uppercase">Dimensions</p>
                <p className="font-mono text-slate-850">{(content.clientFields?.dimensions) || "—"}</p>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="border border-slate-900 border-t-0">
              <div className="bg-slate-50 p-1 font-bold text-[7px] uppercase text-slate-500 border-b border-slate-900 text-center tracking-wider">
                CONSOLIDATION LINE ITEMS
              </div>
              <table className="w-full text-left text-[8px] leading-tight border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-900 font-bold text-[6px] uppercase text-slate-500 divide-x divide-slate-900">
                    <th className="p-2 w-2/12">{content.clientFields?.manifestType === "SEA" ? "HBL No" : "HAWB No"}</th>
                    <th className="p-2 w-3/12">Shipper</th>
                    <th className="p-2 w-3/12">Consignee</th>
                    <th className="p-2 w-1/12 text-center">Pieces</th>
                    <th className="p-2 w-2/12 text-right">Gross Wt</th>
                    <th className="p-2 w-3/12">Commodity</th>
                    <th className="p-2 w-1/12 text-center">{content.clientFields?.manifestType === "SEA" ? "Discharge Port" : "Dest"}</th>
                  </tr>
                </thead>
                <tbody>
                  {((content.clientFields?.lineItems as Array<Record<string, string>>) || []).map((item, idx: number) => (
                    <tr key={idx} className="divide-x divide-slate-900 border-b border-slate-900/10 last:border-b-0 align-top">
                      <td className="p-2 font-mono font-semibold text-slate-950">
                        {content.clientFields?.manifestType === "SEA" ? (item.hblNo || "—") : (item.hawbNo || "—")}
                      </td>
                      <td className="p-2 text-slate-800 font-medium truncate max-w-[90px]">{item.shipper || "—"}</td>
                      <td className="p-2 text-slate-800 font-medium truncate max-w-[90px]">{item.consignee || "—"}</td>
                      <td className="p-2 text-center text-slate-800 font-semibold">{item.pieces || "—"}</td>
                      <td className="p-2 text-right font-mono text-slate-900">{item.grossWeight || "—"}</td>
                      <td className="p-2 text-slate-850 truncate max-w-[120px]">{item.commodity || "—"}</td>
                      <td className="p-2 text-center font-semibold text-slate-800">{item.destination || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Lower Remarks and Special Handling */}
            <div className="grid grid-cols-2 border border-slate-900 border-t-0 text-[9px] divide-x divide-slate-900">
              <div className="p-2 space-y-1">
                <p className="font-bold text-[7px] text-slate-500 uppercase">Special Handling Information</p>
                <p className="text-slate-850 whitespace-pre-wrap">{(content.clientFields?.specialHandlingInformation) || "N/A"}</p>
              </div>
              <div className="p-2 space-y-1">
                <p className="font-bold text-[7px] text-slate-500 uppercase">Remarks</p>
                <p className="text-slate-850 whitespace-pre-wrap">{(content.clientFields?.remarks) || "—"}</p>
              </div>
            </div>

            {/* Signature Box */}
            <div className="grid grid-cols-2 border border-slate-900 border-t-0 text-[9px] divide-x divide-slate-900">
              <div className="p-2">
                <p className="font-bold text-[7px] text-slate-500 uppercase">Prepared By</p>
                <p className="font-semibold text-slate-850 mt-1">Freight Forwarder Backoffice</p>
              </div>
              <div className="p-2 flex flex-col justify-between min-h-[55px] bg-slate-50/50">
                <p className="font-bold text-[6px] text-slate-400 uppercase text-center">Authorized Forwarder Signature</p>
                <div className="border-t border-dashed border-slate-400 pt-1 text-center text-slate-400 text-[7px] italic">
                  Authorized Representative
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center text-[10px] text-slate-455 pt-3 border-t mt-4">
              <p>Status: <span className="font-bold text-slate-700">{doc.status}</span></p>
              <p className="italic">Note: Internal notes, buying costs, and margins are excluded from portal review views for confidentiality.</p>
            </div>
            </div>
          </Card>
        ) : doc.type === "DEBIT_NOTE" ? (
          <Card className="border border-slate-200 bg-white p-8 text-slate-950 text-xs shadow-sm space-y-0 leading-normal select-none print-page">
            <div className="print-content space-y-3 flex-grow">
            {/* Company Name & Document Title */}
            <div className="flex justify-between items-start border-b-2 border-slate-950 pb-3">
              <div className="flex items-center gap-3">
                {logoUrl ? (
                  <Image
                    alt={`${companyName} logo`}
                    className="h-10 w-auto object-contain"
                    height={40}
                    src={logoUrl}
                    unoptimized
                    width={140}
                  />
                ) : (
                  <div>
                    <h4 className="font-bold text-[14px] text-slate-900 tracking-wide uppercase">
                      {companyName || "Freight Logistics Provider"}
                    </h4>
                    <p className="text-[9px] text-slate-500">Professional Cargo Management Services</p>
                  </div>
                )}
                {logoUrl && (
                  <div className="text-[7px] text-slate-500 font-medium leading-tight">
                    <p className="font-bold text-[8px] text-slate-850 uppercase">{companyLegalName}</p>
                    {companyAddress && <p className="max-w-[200px] line-clamp-2">{companyAddress}</p>}
                    <p>{[companyEmail, companyPhone].filter(Boolean).join(" | ")}</p>
                  </div>
                )}
              </div>
              <div className="text-right">
                <h3 className="font-extrabold text-[16px] text-emerald-800 tracking-wider">DEBIT NOTE</h3>
                <p className="font-mono text-slate-800 font-bold text-[10px]">NO: {(content.clientFields?.debitNoteNo) || "—"}</p>
                <p className="text-[8px] text-slate-500">DATE: {(content.clientFields?.debitNoteDate) || "—"}</p>
              </div>
            </div>

            {/* Bill To Customer & Shipment References */}
            <div className="grid grid-cols-2 gap-6 border border-slate-900 border-b-0 divide-x divide-slate-900">
              <div className="p-3 space-y-1">
                <p className="font-bold text-[7px] text-slate-500 uppercase tracking-wider">Bill To Customer</p>
                <p className="font-bold text-slate-900 text-[10px] leading-tight">{(content.clientFields?.customerName) || "—"}</p>
                <p className="text-slate-600 text-[9px] whitespace-pre-line leading-snug">{(content.clientFields?.customerAddress) || "—"}</p>
                {(content.clientFields?.attention) && (
                  <p className="text-slate-700 text-[8px] mt-1.5">
                    <span className="font-semibold">Attention:</span> {(content.clientFields?.attention)}
                  </p>
                )}
              </div>
              <div className="p-3 grid grid-cols-2 gap-2 text-[9px]">
                <div>
                  <p className="font-bold text-[7px] text-slate-400 uppercase">Shipment Job No</p>
                  <p className="font-mono font-semibold text-slate-850">{(content.clientFields?.shipmentJobNo) || "—"}</p>
                </div>
                <div>
                  <p className="font-bold text-[7px] text-slate-400 uppercase">Booking / Ref No</p>
                  <p className="font-mono font-semibold text-slate-850">{(content.clientFields?.referenceNo) || "—"}</p>
                </div>
                <div>
                  <p className="font-bold text-[7px] text-slate-400 uppercase">Quotation No</p>
                  <p className="font-mono font-semibold text-slate-850">{(content.clientFields?.quotationNo) || "—"}</p>
                </div>
                <div>
                  <p className="font-bold text-[7px] text-slate-400 uppercase">Invoice No</p>
                  <p className="font-mono font-semibold text-slate-850">{(content.clientFields?.invoiceNo) || "—"}</p>
                </div>
                <div>
                  <p className="font-bold text-[7px] text-slate-400 uppercase">HBL No</p>
                  <p className="font-mono font-semibold text-slate-850">{(content.clientFields?.hblNo) || "—"}</p>
                </div>
                <div>
                  <p className="font-bold text-[7px] text-slate-400 uppercase">HAWB No</p>
                  <p className="font-mono font-semibold text-slate-850">{(content.clientFields?.hawbNo) || "—"}</p>
                </div>
              </div>
            </div>

            {/* Routing Details */}
            <div className="grid grid-cols-4 border border-slate-900 divide-x divide-slate-900 text-[9px]">
              <div className="p-2">
                <p className="font-bold text-[7px] text-slate-500 uppercase">Origin</p>
                <p className="font-semibold text-slate-850 mt-0.5">{(content.clientFields?.origin) || "—"}</p>
              </div>
              <div className="p-2">
                <p className="font-bold text-[7px] text-slate-500 uppercase">Destination</p>
                <p className="font-semibold text-slate-850 mt-0.5">{(content.clientFields?.destination) || "—"}</p>
              </div>
              <div className="p-2">
                <p className="font-bold text-[7px] text-slate-500 uppercase">Transport Mode</p>
                <p className="font-semibold text-slate-850 mt-0.5">{(content.clientFields?.transportMode) || "—"}</p>
              </div>
              <div className="p-2">
                <p className="font-bold text-[7px] text-slate-500 uppercase">Shipment Type</p>
                <p className="font-semibold text-slate-850 mt-0.5">{(content.clientFields?.shipmentType) || "—"}</p>
              </div>
            </div>

            {/* Charge Table */}
            <table className="w-full border border-slate-900 text-left text-[9px] leading-tight border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-900 font-bold text-[7px] uppercase text-slate-500 divide-x divide-slate-900">
                  <th className="p-2 w-5/12">Charge Name / Description</th>
                  <th className="p-2 w-2/12">Basis</th>
                  <th className="p-2 w-1/12 text-center">Qty</th>
                  <th className="p-2 w-2/12 text-right">Unit Rate</th>
                  <th className="p-2 w-2/12 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {((content.clientFields?.lineItems as Array<Record<string, string>>) || []).map((item, idx: number) => (
                  <tr key={idx} className="divide-x divide-slate-900 border-b border-slate-900/10 last:border-b-0 align-top">
                    <td className="p-2 text-slate-900 font-medium whitespace-pre-wrap">{item.description || "—"}</td>
                    <td className="p-2 text-slate-800">{item.basis || "—"}</td>
                    <td className="p-2 text-center text-slate-800 font-semibold">{item.quantity || "—"}</td>
                    <td className="p-2 text-right font-mono text-slate-900">
                      {item.currency} {Number(item.unitRate || 0).toFixed(2)}
                    </td>
                    <td className="p-2 text-right font-mono font-semibold text-slate-900">
                      {item.currency} {Number(item.amount || 0).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Summary / Totals */}
            <div className="grid grid-cols-2 border border-slate-900 divide-x divide-slate-900">
              {/* Left Column - Payment Instruction */}
              <div className="p-3 space-y-3 text-[8px] text-slate-500">
                {(content.clientFields?.paymentInstruction) && (
                  <div>
                    <p className="font-bold text-[7px] text-slate-400 uppercase">Payment Instruction</p>
                    <p className="whitespace-pre-wrap mt-1">{(content.clientFields?.paymentInstruction)}</p>
                  </div>
                )}
                {(content.clientFields?.remarks) && (
                  <div>
                    <p className="font-bold text-[7px] text-slate-400 uppercase">Remarks</p>
                    <p className="whitespace-pre-wrap mt-1">{(content.clientFields?.remarks)}</p>
                  </div>
                )}
              </div>

              {/* Right Column - Financial Summary */}
              <div className="divide-y divide-slate-900/50 text-[9px]">
                <div className="flex justify-between p-2 font-medium">
                  <span className="text-slate-500 uppercase">Subtotal</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {(content.clientFields?.currency)} {Number(content.clientFields?.subtotal || 0).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between p-2 font-medium">
                  <span className="text-slate-500 uppercase">Tax / VAT Total</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {(content.clientFields?.currency)} {Number(content.clientFields?.taxTotal || 0).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between p-2 font-medium">
                  <span className="text-slate-500 uppercase">Discount</span>
                  <span className="font-mono font-semibold text-red-600">
                    - {(content.clientFields?.currency)} {Number(content.clientFields?.discount || 0).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between p-2 bg-emerald-50 font-bold border-t border-slate-900">
                  <span className="text-emerald-800 uppercase text-[10px]">Grand Total</span>
                  <span className="font-mono text-emerald-950 text-[11px]">
                    {(content.clientFields?.currency)} {Number(content.clientFields?.grandTotal || 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Amount in words */}
            {(content.clientFields?.amountInWords) && (
              <div className="border border-slate-900 border-t-0 p-2 text-[9px] bg-slate-50/50">
                <span className="font-bold text-slate-500 uppercase text-[7px] block">Amount in Words:</span>
                <span className="font-medium italic text-slate-900">{(content.clientFields?.amountInWords)}</span>
              </div>
            )}

            {/* Prepared By and Authorization */}
            <div className="grid grid-cols-2 border border-slate-900 border-t-0 divide-x divide-slate-900 text-[9px]">
              <div className="p-2">
                <p className="font-bold text-[7px] text-slate-500 uppercase">Prepared By</p>
                <p className="font-semibold text-slate-850 mt-1">Freight Forwarder Backoffice</p>
              </div>
              <div className="p-2 flex flex-col justify-between min-h-[55px] bg-slate-50/50">
                <p className="font-bold text-[6px] text-slate-400 uppercase text-center">Authorized Signature</p>
                <div className="border-t border-dashed border-slate-400 pt-1 text-center text-slate-400 text-[7px] italic">
                  Authorized Signature
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center text-[10px] text-slate-455 pt-3 border-t mt-4">
              <p>Status: <span className="font-bold text-slate-700">{doc.status}</span></p>
              <p className="italic">Note: Internal notes, buying costs, and margins are excluded from portal review views for confidentiality.</p>
            </div>
            </div>
          </Card>
        ) : (
          <Card className="border border-slate-200 bg-white p-8 text-slate-950 text-xs shadow-sm space-y-5">
            <div className="flex justify-between border-b pb-4 border-slate-200">
              <div>
                <h2 className="text-lg font-bold text-emerald-800">{doc.type} Draft Details</h2>
                <p className="text-slate-500">Official Document Ref: {doc.documentNo}</p>
              </div>
              <div className="text-right">
                <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold ${
                  doc.status === "LOCKED" ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/10" :
                  doc.status === "APPROVED" ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/10" :
                  doc.status === "UNDER_REVIEW" ? "bg-amber-50 text-amber-700 ring-1 ring-amber-600/10" :
                  "bg-slate-50 text-slate-700 ring-1 ring-slate-600/10"
                }`}>
                  {doc.status}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 border-b pb-4 border-slate-200">
              <div>
                <p className="font-bold uppercase text-[9px] text-slate-400">Shipper</p>
                <p className="font-medium mt-1 text-slate-800">{content.shipper?.name || "-"}</p>
                <p className="text-slate-600">{content.shipper?.address || "-"}</p>
              </div>
              <div>
                <p className="font-bold uppercase text-[9px] text-slate-400">Consignee</p>
                <p className="font-medium mt-1 text-slate-800">{content.consignee?.name || "-"}</p>
                <p className="text-slate-600">{content.consignee?.address || "-"}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 border-b pb-4 border-slate-200">
              <div>
                <p className="font-bold uppercase text-[9px] text-slate-400">Notify Party</p>
                <p className="font-medium mt-1 text-slate-800">{content.notifyParty?.name || "-"}</p>
                <p className="text-slate-600">{content.notifyParty?.address || "-"}</p>
              </div>
              <div>
                <p className="font-bold uppercase text-[9px] text-slate-400">Carrier Details</p>
                <p className="mt-1 text-slate-700">Carrier: {content.carrier || "-"}</p>
                {(doc.type as string) === "HAWB" ? (
                  <p className="text-slate-700">Flight Number: {content.flightNo || "-"}</p>
                ) : (
                  <p className="text-slate-700">Vessel: {content.vessel || "-"} | Voyage: {content.voyage || "-"}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4 border-b pb-4 border-slate-200 text-slate-700">
              <div>
                <p className="font-bold uppercase text-[8px] text-slate-400">Place of Receipt</p>
                <p className="font-medium mt-1">{content.placeOfReceipt || "-"}</p>
              </div>
              <div>
                <p className="font-bold uppercase text-[8px] text-slate-400">Port of Loading</p>
                <p className="font-medium mt-1">{content.portOfLoading || "-"}</p>
              </div>
              <div>
                <p className="font-bold uppercase text-[8px] text-slate-400">Port of Discharge</p>
                <p className="font-medium mt-1">{content.portOfDischarge || "-"}</p>
              </div>
              <div>
                <p className="font-bold uppercase text-[8px] text-slate-400">Place of Delivery</p>
                <p className="font-medium mt-1">{content.placeOfDelivery || "-"}</p>
              </div>
            </div>

            <div className="grid grid-cols-12 gap-4 border-b pb-4 border-slate-200 text-slate-700">
              <div className="col-span-3">
                <p className="font-bold uppercase text-[8px] text-slate-400">Marks & Numbers</p>
                <p className="mt-1 font-mono text-slate-600">{content.marksAndNumbers || "N/A"}</p>
              </div>
              <div className="col-span-6">
                <p className="font-bold uppercase text-[8px] text-slate-400">Description of Packages & Goods</p>
                <p className="mt-1 whitespace-pre-wrap text-slate-800 font-medium">{content.cargoDescription || "-"}</p>
                <p className="mt-2 text-slate-500 italic text-[10px]">Total: {content.packageCount} {content.packageType}</p>
              </div>
              <div className="col-span-3 text-right space-y-2">
                <div>
                  <p className="font-bold uppercase text-[8px] text-slate-400">Gross Weight</p>
                  <p className="mt-1 font-mono font-medium">{Number(content.grossWeight || 0).toFixed(2)} KG</p>
                </div>
                <div>
                  <p className="font-bold uppercase text-[8px] text-slate-400">Volume</p>
                  <p className="mt-1 font-mono font-medium">{Number(content.cbm || 0).toFixed(3)} CBM</p>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center text-[10px] text-slate-400 pt-2">
              <p>Freight Terms: <span className="font-bold text-slate-700">{content.freightTerms}</span></p>
              <p className="italic">Note: Internal notes, buying costs, and margins are excluded from portal review views for confidentiality.</p>
            </div>

            {doc.filePath && (
              <div className="flex justify-end pt-4 border-t border-slate-200 mt-4">
                <Button asChild className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  <a
                    href={`/api/portal/${companySlug}/documents/${doc.id}/download`}
                    download
                  >
                    Download Attachment
                  </a>
                </Button>
              </div>
            )}
          </Card>
        )}
      </div>
    </main>
  );
}
