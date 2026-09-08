import { Fragment, type ReactNode } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { hasPermission, requirePermission } from "@/lib/permissions/rbac";
import { Printer } from "lucide-react";
import { resolveSectionOrder, type ResolvedDocumentLayout } from "@/lib/document-templates/sections";
import { loadTemplateVersionLayoutForPreview, resolveFreightDocumentTemplateLayout } from "@/lib/pdf/document-template-resolution";
import {
  DEBIT_NOTE_SECTION_KEYS,
  HAWB_SECTION_KEYS,
  HBL_SECTION_KEYS,
  MANIFEST_SECTION_KEYS,
  type DebitNoteSectionKey,
  type DocumentTemplateType,
  type HawbSectionKey,
  type HblSectionKey,
  type ManifestSectionKey,
} from "@/lib/validators/document-templates";

export default async function PrintFreightDocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; docId: string }>;
  searchParams: Promise<{ set?: string; previewTemplateId?: string }>;
}) {
  const currentUser = await requirePermission("documents:view");
  const { id: shipmentJobId, docId } = await params;
  const { set, previewTemplateId } = await searchParams;
  const currentSet = set || "originals";

  const docRaw = await prisma.freightdocument.findFirst({
    where: {
      id: docId,
      shipmentJobId,
      companyId: currentUser.companyId || "",
      deletedAt: null,
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
          hblOriginalsLimit: true,
          hblOfficeLimit: true,
          hblAccountsLimit: true,
          hblOperationsLimit: true,
          hblCustomerLimit: true,
          hblArchiveLimit: true,
          hblPrintWatermarkEnabled: true,
        },
      },
      shipmentjob: { select: { jobNo: true } },
      documentversion: {
        orderBy: { versionNumber: "desc" },
        include: {
          user: { select: { name: true } },
        },
      },
    },
  });

  if (!docRaw) notFound();

  const doc = {
    ...docRaw,
    versions: docRaw.documentversion.map((v) => ({ ...v, createdBy: v.user })),
    shipmentJob: docRaw.shipmentjob,
  };

  const latestVersion = doc.versions[0];
  if (!latestVersion) return <p className="p-8 text-center text-slate-500">No document content has been drafted yet.</p>;

  const isHbl = doc.type === "HBL";
  const isHawb = doc.type === "HAWB";
  const isDebitNote = doc.type === "DEBIT_NOTE";
  const isManifest = doc.type === "MANIFEST";
  const templateDocumentType: DocumentTemplateType | null = isHbl
    ? "HBL"
    : isHawb
      ? "HAWB"
      : isDebitNote
        ? "DEBIT_NOTE"
        : isManifest
          ? "MANIFEST"
          : null;

  // With no active company template for this document type this resolves to
  // `null`, and every section below renders in its original fixed order --
  // i.e. byte-identical to how this page rendered before this feature
  // existed. `previewTemplateId` (settings-side "Preview" link only, and
  // only for a documentTemplates:manage holder) loads a specific saved
  // version directly without requiring it to be active and without
  // stamping anything, so an admin can check an in-progress layout.
  const layout: ResolvedDocumentLayout | null =
    templateDocumentType && previewTemplateId && hasPermission(currentUser, "documentTemplates:manage")
      ? await loadTemplateVersionLayoutForPreview(templateDocumentType, previewTemplateId, currentUser.companyId || "")
      : templateDocumentType
        ? await resolveFreightDocumentTemplateLayout(
            templateDocumentType,
            doc.id,
            currentUser.companyId || "",
            (docRaw as { templateVersionId: string | null }).templateVersionId,
          )
        : null;

  const rawContent = latestVersion.content as any;
  const content = (isHbl || isHawb || isDebitNote || isManifest) ? (rawContent?.clientFields || {}) : (rawContent || {});

  const companyName = doc.company.name;
  const companyLegalName = doc.company.legalName || companyName;
  const companyAddress = doc.company.address;
  const companyEmail = doc.company.email;
  const companyPhone = doc.company.phone;
  const logoUrl = doc.company.logoPath 
    ? `/api/company/branding/logo?v=${doc.company.logoUpdatedAt?.getTime().toString() || ""}`
    : null;

  const hblOriginalsLimit = doc.company.hblOriginalsLimit ?? 3;
  const hblOfficeLimit = doc.company.hblOfficeLimit ?? 1;
  const hblAccountsLimit = doc.company.hblAccountsLimit ?? 1;
  const hblOperationsLimit = doc.company.hblOperationsLimit ?? 1;
  const hblCustomerLimit = doc.company.hblCustomerLimit ?? 1;
  const hblArchiveLimit = doc.company.hblArchiveLimit ?? 1;
  const hblPrintWatermarkEnabled = doc.company.hblPrintWatermarkEnabled ?? true;

  const hblCopies: { type: string; watermark: string; label: string; isOriginal: boolean }[] = [];
  const showOriginals = currentSet === "originals" || currentSet === "full";
  const showOffice = currentSet === "office" || currentSet === "full";
  const showCustomer = currentSet === "customer" || currentSet === "full";

  // 1. Originals
  if (showOriginals) {
    for (let i = 1; i <= hblOriginalsLimit; i++) {
      const ordinalWords = ["ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "TEN"];
      const ordinalWord = ordinalWords[hblOriginalsLimit - 1] || String(hblOriginalsLimit);
      const suffix = hblOriginalsLimit === 1 ? "ORIGINAL" : "ORIGINALS";
      
      let ordinalCurrentWord = ["FIRST", "SECOND", "THIRD", "FOURTH", "FIFTH", "SIXTH", "SEVENTH", "EIGHTH", "NINTH", "TENTH"][i - 1] || String(i);

      hblCopies.push({
        type: "original",
        watermark: `ORIGINAL\n${ordinalCurrentWord} OF ${ordinalWord} ${suffix}`,
        label: `Original ${i} of ${hblOriginalsLimit}`,
        isOriginal: true,
      });
    }
  }

  // 2. Office Copies
  if (showOffice) {
    for (let i = 0; i < hblOfficeLimit; i++) {
      hblCopies.push({
        type: "office",
        watermark: "OFFICE COPY",
        label: "Office Copy",
        isOriginal: false,
      });
    }
    // 3. Accounts Copies
    for (let i = 0; i < hblAccountsLimit; i++) {
      hblCopies.push({
        type: "accounts",
        watermark: "ACCOUNTS COPY",
        label: "Accounts Copy",
        isOriginal: false,
      });
    }
    // 4. Operations Copies
    for (let i = 0; i < hblOperationsLimit; i++) {
      hblCopies.push({
        type: "operations",
        watermark: "OPERATIONS COPY",
        label: "Operations Copy",
        isOriginal: false,
      });
    }
  }

  // 5. Customer Copies
  if (showCustomer) {
    for (let i = 0; i < hblCustomerLimit; i++) {
      hblCopies.push({
        type: "customer",
        watermark: "CUSTOMER COPY",
        label: "Customer Copy",
        isOriginal: false,
      });
    }
  }

  // 6. Archive Copies (only in Full Set)
  if (currentSet === "full") {
    for (let i = 0; i < hblArchiveLimit; i++) {
      hblCopies.push({
        type: "archive",
        watermark: "ARCHIVE COPY",
        label: "Archive Copy",
        isOriginal: false,
      });
    }
  }

  const hblOrder = isHbl ? resolveSectionOrder(HBL_SECTION_KEYS, layout as ResolvedDocumentLayout<HblSectionKey> | null) : [];
  const hblRoutingLegs = content.transshipmentLegs || [];
  const hblIsTransshipment = content.isTransshipment === "yes";
  const hblComputedPreCarriage =
    hblIsTransshipment && hblRoutingLegs.length > 0
      ? hblRoutingLegs.map((l: any) => (l.vessel ? `${l.vessel}${l.voyage ? ` v.${l.voyage}` : ""}` : "")).filter(Boolean).join(" / ")
      : content.preCarriageBy || "";
  const hblComputedVia =
    hblIsTransshipment && hblRoutingLegs.length > 0
      ? hblRoutingLegs.map((l: any) => l.viaPort).filter(Boolean).join(" via ")
      : content.transshipmentPort || "";

  const hblSections: Record<HblSectionKey, ReactNode> = {
    parties: (
      <div className="grid grid-cols-2 border border-slate-900 border-b-0">
        {/* Left Column */}
        <div className="divide-y divide-slate-900 border-r border-slate-900">
          <div className="p-1.5 min-h-[70px] space-y-0.5">
            <p className="font-bold text-[6px] text-slate-500 uppercase tracking-wider">Shipper</p>
            <p className="whitespace-pre-line font-medium text-slate-850 text-[8px] leading-tight">{content.shipper || "—"}</p>
          </div>
          <div className="p-1.5 min-h-[70px] space-y-0.5">
            <p className="font-bold text-[6px] text-slate-500 uppercase tracking-wider">Consignee (or order)</p>
            <p className="whitespace-pre-line font-medium text-slate-850 text-[8px] leading-tight">{content.consignee || "—"}</p>
          </div>
          <div className="p-1.5 min-h-[70px] space-y-0.5">
            <p className="font-bold text-[6px] text-slate-500 uppercase tracking-wider">Notify Party</p>
            <p className="whitespace-pre-line font-medium text-slate-850 text-[8px] leading-tight">{content.notifyParty || "—"}</p>
          </div>
        </div>

        {/* Right Column */}
        <div className="divide-y divide-slate-900 flex flex-col justify-between">
          <div className="p-2 bg-slate-50 flex flex-col items-center justify-center text-center space-y-0.5 border-b border-slate-900">
            <h4 className="font-bold text-[11px] text-emerald-800 tracking-wider">HOUSE BILL OF LADING</h4>
            <p className="text-[6px] text-slate-400 uppercase">Non-negotiable unless consigned to order</p>
          </div>

          <div className="grid grid-cols-2 divide-x divide-slate-900 border-b border-slate-900">
            <div className="p-1.5">
              <p className="font-bold text-[6px] text-slate-500 uppercase">HBL Number</p>
              <p className="font-mono font-bold text-slate-900 text-[9px]">{content.hblNo || "DRAFT"}</p>
            </div>
            <div className="p-1.5">
              <p className="font-bold text-[6px] text-slate-500 uppercase">MBL Reference</p>
              <p className="font-mono text-slate-700 text-[9px]">{content.mblNo || "—"}</p>
            </div>
          </div>

          <div className="p-1.5 border-b border-slate-900">
            <p className="font-bold text-[6px] text-slate-500 uppercase">Booking / Job Ref</p>
            <p className="font-mono font-semibold text-slate-700">{content.shipmentJobNo || "—"}</p>
          </div>

          <div className="p-1.5 flex-grow space-y-0.5 bg-slate-50/50">
            <p className="font-bold text-[5px] text-slate-400 uppercase">Instructions / Remarks</p>
            <p className="text-[7px] text-slate-500 leading-tight">
              Received by the Carrier in apparent good order and condition unless otherwise indicated hereon...
            </p>
          </div>
        </div>
      </div>
    ),
    routing: (
      <div className="grid grid-cols-4 border border-slate-900 border-b-0 divide-x divide-slate-900">
        <div className="p-1.5">
          <p className="font-bold text-[6px] text-slate-500 uppercase">Pre-Carriage / Receipt Place</p>
          <p className="font-semibold text-slate-800 text-[8px] mt-0.5 whitespace-pre-line leading-tight">
            {hblComputedPreCarriage ? `${hblComputedPreCarriage}\n` : ""}
            {content.placeOfReceipt || "—"}
          </p>
        </div>
        <div className="p-1.5">
          <p className="font-bold text-[6px] text-slate-500 uppercase">Vessel & Voyage</p>
          <p className="font-semibold text-slate-800 text-[8px] mt-0.5">{content.vessel ? `${content.vessel} v.${content.voyage}` : "—"}</p>
        </div>
        <div className="p-1.5">
          <p className="font-bold text-[6px] text-slate-500 uppercase">Port of Loading</p>
          <p className="font-semibold text-slate-800 text-[8px] mt-0.5 whitespace-pre-line leading-tight">
            {content.portOfLoading || "—"}
            {hblComputedVia ? `\nvia ${hblComputedVia}` : ""}
          </p>
        </div>
        <div className="p-1.5">
          <p className="font-bold text-[6px] text-slate-500 uppercase">Port of Discharge</p>
          <p className="font-semibold text-slate-800 text-[8px] mt-0.5">{content.portOfDischarge || "—"}</p>
        </div>
      </div>
    ),
    delivery: (
      <div className="grid grid-cols-2 border border-slate-900 border-b-0 divide-x divide-slate-900">
        <div className="p-1.5">
          <p className="font-bold text-[6px] text-slate-500 uppercase">Place of Delivery</p>
          <p className="font-semibold text-slate-800 text-[8px] mt-0.5">{content.placeOfDelivery || "—"}</p>
        </div>
        <div className="p-1.5">
          <p className="font-bold text-[6px] text-slate-500 uppercase">Final Destination</p>
          <p className="font-semibold text-slate-800 text-[8px] mt-0.5">{content.finalDestination || "—"}</p>
        </div>
      </div>
    ),
    cargo: (
      <table className="w-full border border-slate-900 text-left text-[8px] leading-tight border-collapse">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-900 font-bold text-[6px] uppercase text-slate-500 divide-x divide-slate-900">
            <th className="p-1.5 w-1/4">Container / Seal / Marks</th>
            <th className="p-1.5 w-1/6">No of Pkgs</th>
            <th className="p-1.5 w-2/5">Description of Packages and Goods</th>
            <th className="p-1.5 w-1/6 text-right">Gross Weight</th>
            <th className="p-1.5 w-1/6 text-right">Measurement</th>
          </tr>
        </thead>
        <tbody>
          <tr className="divide-x divide-slate-900 align-top cargo-row">
            <td className="p-1.5 font-mono text-[7px] space-y-0.5">
              <p className="font-semibold text-slate-900">{content.containerNo ? `CNTR: ${content.containerNo}` : ""}</p>
              <p className="text-slate-600">{content.sealNo ? `SEAL: ${content.sealNo}` : ""}</p>
              <p className="text-slate-500">{content.marksAndNumbers || "N/A"}</p>
            </td>
            <td className="p-1.5 font-semibold text-slate-800">{content.packages || "—"}</td>
            <td className="p-1.5 whitespace-pre-wrap text-slate-800">
              <p className="font-medium">{content.goodsDescription || "—"}</p>
              {content.hsCode && <p className="text-[6px] text-slate-400 mt-1">HS Code: {content.hsCode}</p>}
            </td>
            <td className="p-1.5 text-right font-mono font-semibold text-slate-900">{content.grossWeight || "—"}</td>
            <td className="p-1.5 text-right font-mono font-semibold text-slate-900">{content.measurement || "—"}</td>
          </tr>
        </tbody>
      </table>
    ),
    terms: (
      <div className="grid grid-cols-3 border border-slate-900 border-t-0 divide-x divide-slate-900">
        <div className="p-1.5 divide-y divide-slate-900">
          <div className="pb-1">
            <p className="font-bold text-[6px] text-slate-500 uppercase">Freight Terms</p>
            <p className="font-bold text-slate-900 mt-0.5">{content.freightTerm}</p>
          </div>
          <div className="pt-1">
            <p className="font-bold text-[6px] text-slate-500 uppercase">Original B/L Count</p>
            <p className="font-semibold text-slate-800 mt-0.5">{content.originalBlCount || "3"}</p>
          </div>
        </div>

        <div className="p-1.5 divide-y divide-slate-900 flex flex-col justify-between">
          <div>
            <p className="font-bold text-[6px] text-slate-500 uppercase">Place & Date of Issue</p>
            <p className="font-semibold text-slate-800 mt-0.5">
              {content.issuePlace || "—"}
              {content.issueDate ? ` | ${new Date(content.issueDate).toLocaleDateString()}` : ""}
            </p>
          </div>
          {content.onBoardDate && (
            <div className="pt-1">
              <p className="font-bold text-[6px] text-slate-500 uppercase">Laden On Board Date</p>
              <p className="font-mono text-emerald-800 text-[7px] mt-0.5">{new Date(content.onBoardDate).toLocaleDateString()}</p>
            </div>
          )}
        </div>

        <div className="p-1.5 flex flex-col justify-between bg-slate-50/50 min-h-[60px]">
          <div>
            <p className="font-bold text-[5px] text-slate-400 uppercase text-center">Signed on behalf of Carrier</p>
          </div>
          <div className="border-t border-dashed border-slate-400 pt-0.5 text-center text-slate-400 text-[7px] italic">
            Authorized Signature
          </div>
        </div>
      </div>
    ),
  };

  const hawbOrder = isHawb ? resolveSectionOrder(HAWB_SECTION_KEYS, layout as ResolvedDocumentLayout<HawbSectionKey> | null) : [];
  const hawbSections: Record<HawbSectionKey, ReactNode> = {
    parties: (
      <div className="grid grid-cols-2 border border-slate-900 border-b-0">
        {/* Left Column */}
        <div className="divide-y divide-slate-900 border-r border-slate-900">
          <div className="p-1.5 min-h-[60px] space-y-0.5">
            <p className="font-bold text-[6px] text-slate-500 uppercase tracking-wider">Shipper</p>
            <p className="whitespace-pre-line font-medium text-slate-850 text-[8px] leading-tight">{content.shipper || "—"}</p>
          </div>
          <div className="p-1.5 min-h-[60px] space-y-0.5">
            <p className="font-bold text-[6px] text-slate-500 uppercase tracking-wider">Consignee</p>
            <p className="whitespace-pre-line font-medium text-slate-850 text-[8px] leading-tight">{content.consignee || "—"}</p>
          </div>
          <div className="p-1.5 min-h-[60px] space-y-0.5">
            <p className="font-bold text-[6px] text-slate-500 uppercase tracking-wider">Notify Party</p>
            <p className="whitespace-pre-line font-medium text-slate-850 text-[8px] leading-tight">{content.notifyParty || "—"}</p>
          </div>
        </div>

        {/* Right Column */}
        <div className="divide-y divide-slate-900 flex flex-col justify-between">
          <div className="p-2 bg-slate-50 flex flex-col items-center justify-center text-center space-y-0.5 border-b border-slate-900">
            <h4 className="font-bold text-[11px] text-emerald-800 tracking-wider">HOUSE AIR WAYBILL</h4>
            <p className="text-[6px] text-slate-400 uppercase">Non-negotiable Air Waybill</p>
          </div>

          <div className="grid grid-cols-2 divide-x divide-slate-900 border-b border-slate-900">
            <div className="p-1.5">
              <p className="font-bold text-[6px] text-slate-500 uppercase">HAWB Number</p>
              <p className="font-mono font-bold text-slate-900 text-[9px]">{content.hawbNo || "DRAFT"}</p>
            </div>
            <div className="p-1.5">
              <p className="font-bold text-[6px] text-slate-500 uppercase">MAWB Reference</p>
              <p className="font-mono text-slate-700 text-[9px]">{content.mawbNo || "—"}</p>
            </div>
          </div>

          <div className="p-1.5 border-b border-slate-900">
            <p className="font-bold text-[6px] text-slate-500 uppercase">Booking / Job Ref</p>
            <p className="font-mono font-semibold text-slate-700">{content.shipmentJobNo || "—"}</p>
          </div>

          <div className="p-1.5 flex-grow space-y-0.5 bg-slate-50/50">
            <p className="font-bold text-[5px] text-slate-400 uppercase">Instructions / Remarks</p>
            <p className="text-[7px] text-slate-500 leading-tight">
              It is agreed that the goods described herein are accepted in apparent good order and condition...
            </p>
          </div>
        </div>
      </div>
    ),
    routing: (
      <div className="grid grid-cols-3 border border-slate-900 border-b-0 divide-x divide-slate-900">
        <div className="p-1.5">
          <p className="font-bold text-[6px] text-slate-500 uppercase">Airport of Departure</p>
          <p className="font-semibold text-slate-800 text-[8px] mt-0.5">{content.airportOfDeparture || "—"}</p>
        </div>
        <div className="p-1.5">
          <p className="font-bold text-[6px] text-slate-500 uppercase">Airport of Destination</p>
          <p className="font-semibold text-slate-800 text-[8px] mt-0.5">{content.airportOfDestination || "—"}</p>
        </div>
        <div className="p-1.5">
          <p className="font-bold text-[6px] text-slate-500 uppercase">Requested Routing</p>
          <p className="font-semibold text-slate-800 text-[8px] mt-0.5">{content.requestedRouting || "—"}</p>
        </div>
      </div>
    ),
    flight: (
      <div className="grid grid-cols-2 border border-slate-900 border-b-0 divide-x divide-slate-900">
        <div className="p-1.5">
          <p className="font-bold text-[6px] text-slate-500 uppercase">Flight No</p>
          <p className="font-semibold text-slate-800 text-[8px] mt-0.5">{content.flightNo || "—"}</p>
        </div>
        <div className="p-1.5">
          <p className="font-bold text-[6px] text-slate-500 uppercase">Flight Date</p>
          <p className="font-semibold text-slate-800 text-[8px] mt-0.5">
            {content.flightDate ? new Date(content.flightDate).toLocaleDateString() : "—"}
          </p>
        </div>
      </div>
    ),
    cargo: (
      <table className="w-full border border-slate-900 text-left text-[8px] leading-tight border-collapse">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-900 font-bold text-[6px] uppercase text-slate-500 divide-x divide-slate-900">
            <th className="p-1.5 w-1/4">Marks & Numbers</th>
            <th className="p-1.5 w-1/6">No of Pkgs</th>
            <th className="p-1.5 w-2/5">Description of Package and Goods</th>
            <th className="p-1.5 w-1/6 text-right">Gross Weight</th>
            <th className="p-1.5 w-1/6 text-right">Measurement</th>
          </tr>
        </thead>
        <tbody>
          <tr className="divide-x divide-slate-900 align-top cargo-row">
            <td className="p-1.5 font-mono text-[7px]">{content.marksAndNumbers || "N/A"}</td>
            <td className="p-1.5 font-semibold text-slate-800">{content.packages || "—"}</td>
            <td className="p-1.5 whitespace-pre-wrap text-slate-800">
              <p className="font-medium">{content.goodsDescription || "—"}</p>
              {content.hsCode && <p className="text-[6px] text-slate-400 mt-1">HS Code: {content.hsCode}</p>}
            </td>
            <td className="p-1.5 text-right font-mono font-semibold text-slate-900">{content.grossWeight || "—"}</td>
            <td className="p-1.5 text-right font-mono font-semibold text-slate-900">{content.measurement || "—"}</td>
          </tr>
        </tbody>
      </table>
    ),
    authorization: (
      <div className="grid grid-cols-3 border border-slate-900 border-t-0 divide-x divide-slate-900 text-[8px]">
        <div className="p-1.5">
          <p className="font-bold text-[6px] text-slate-500 uppercase">Nature of Goods</p>
          <p className="font-semibold text-slate-800 mt-1">{content.natureOfGoods || "—"}</p>
        </div>
        <div className="p-1.5">
          <p className="font-bold text-[6px] text-slate-500 uppercase">Signature of Issuing Carrier</p>
          <p className="font-semibold text-slate-800 mt-1">{content.signatureOfIssuingCarrier || "—"}</p>
        </div>
        <div className="p-1.5 flex flex-col justify-between min-h-[45px] bg-slate-50/50">
          <p className="font-bold text-[5px] text-slate-400 uppercase text-center">Authorized Signature</p>
          <div className="border-t border-dashed border-slate-400 pt-0.5 text-center text-slate-400 text-[6px] italic">
            Authorized Signature
          </div>
        </div>
      </div>
    ),
  };

  const debitNoteOrder = isDebitNote
    ? resolveSectionOrder(DEBIT_NOTE_SECTION_KEYS, layout as ResolvedDocumentLayout<DebitNoteSectionKey> | null)
    : [];
  const debitNoteSections: Record<DebitNoteSectionKey, ReactNode> = {
    "billing-info": (
      <div className="grid grid-cols-2 border border-slate-900 border-b-0 divide-x divide-slate-900">
        <div className="p-2 space-y-1">
          <p className="font-bold text-[6px] text-slate-500 uppercase">Billed To</p>
          <p className="font-bold text-slate-800 text-[10px]">{content.billedToName || "—"}</p>
          <p className="whitespace-pre-wrap text-slate-600 leading-tight text-[8px]">{content.billedToAddress || "—"}</p>
        </div>
        <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 p-2 bg-slate-50/40 text-[8px]">
          <div>
            <p className="font-bold text-[6px] text-slate-400 uppercase">Document Ref No</p>
            <p className="font-mono font-bold text-slate-900 text-[9px]">{doc.documentNo}</p>
          </div>
          <div>
            <p className="font-bold text-[6px] text-slate-400 uppercase">Date of Issue</p>
            <p className="font-semibold text-slate-800">{content.issueDate ? new Date(content.issueDate).toLocaleDateString() : "—"}</p>
          </div>
          <div>
            <p className="font-bold text-[6px] text-slate-400 uppercase">Shipment Job No</p>
            <p className="font-mono font-semibold text-slate-800">{content.shipmentJobNo || "—"}</p>
          </div>
          <div>
            <p className="font-bold text-[6px] text-slate-400 uppercase">Customer Ref / Booking No</p>
            <p className="font-mono font-semibold text-slate-800">{content.referenceNo || "—"}</p>
          </div>
          <div>
            <p className="font-bold text-[6px] text-slate-400 uppercase">Quotation No</p>
            <p className="font-mono font-semibold text-slate-800">{content.quotationNo || "—"}</p>
          </div>
          <div>
            <p className="font-bold text-[6px] text-slate-400 uppercase">Invoice No Reference</p>
            <p className="font-mono font-semibold text-slate-800">{content.invoiceNo || "—"}</p>
          </div>
        </div>
      </div>
    ),
    routing: (
      <div className="grid grid-cols-4 border border-slate-900 divide-x divide-slate-900 text-[8px]">
        <div className="p-1.5">
          <p className="font-bold text-[6px] text-slate-500 uppercase">Origin</p>
          <p className="font-semibold text-slate-800 mt-0.5">{content.origin || "—"}</p>
        </div>
        <div className="p-1.5">
          <p className="font-bold text-[6px] text-slate-500 uppercase">Destination</p>
          <p className="font-semibold text-slate-800 mt-0.5">{content.destination || "—"}</p>
        </div>
        <div className="p-1.5">
          <p className="font-bold text-[6px] text-slate-500 uppercase">Transport Mode</p>
          <p className="font-semibold text-slate-800 mt-0.5">{content.transportMode || "—"}</p>
        </div>
        <div className="p-1.5">
          <p className="font-bold text-[6px] text-slate-500 uppercase">Shipment Type</p>
          <p className="font-semibold text-slate-800 mt-0.5">{content.shipmentType || "—"}</p>
        </div>
      </div>
    ),
    charges: (
      <table className="w-full border border-slate-900 text-left text-[8px] leading-tight border-collapse">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-900 font-bold text-[6px] uppercase text-slate-500 divide-x divide-slate-900">
            <th className="p-1.5 w-5/12">Charge Name / Description</th>
            <th className="p-1.5 w-2/12">Basis</th>
            <th className="p-1.5 w-1/12 text-center">Qty</th>
            <th className="p-1.5 w-2/12 text-right">Unit Rate</th>
            <th className="p-1.5 w-2/12 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {(content.lineItems || []).map((item: any, idx: number) => (
            <tr key={idx} className="divide-x divide-slate-900 border-b border-slate-900/10 last:border-b-0 align-top">
              <td className="p-1.5 text-slate-900 font-medium whitespace-pre-wrap">{item.description || "—"}</td>
              <td className="p-1.5 text-slate-800">{item.basis || "—"}</td>
              <td className="p-1.5 text-center text-slate-800 font-semibold">{item.quantity || "—"}</td>
              <td className="p-1.5 text-right font-mono text-slate-900">
                {item.currency} {Number(item.unitRate || 0).toFixed(2)}
              </td>
              <td className="p-1.5 text-right font-mono font-semibold text-slate-900">
                {item.currency} {Number(item.amount || 0).toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    ),
    totals: (
      <>
        <div className="grid grid-cols-2 border border-slate-900 divide-x divide-slate-900">
          {/* Left Column - Payment Instruction */}
          <div className="p-2 space-y-2 text-[7px] text-slate-500">
            {content.paymentInstruction && (
              <div>
                <p className="font-bold text-[6px] text-slate-400 uppercase">Payment Instruction</p>
                <p className="whitespace-pre-wrap mt-0.5">{content.paymentInstruction}</p>
              </div>
            )}
            {content.remarks && (
              <div>
                <p className="font-bold text-[6px] text-slate-400 uppercase">Remarks</p>
                <p className="whitespace-pre-wrap mt-0.5">{content.remarks}</p>
              </div>
            )}
          </div>

          {/* Right Column - Financial Summary */}
          <div className="divide-y divide-slate-900/50 text-[8px]">
            <div className="flex justify-between p-1.5 font-medium">
              <span className="text-slate-500 uppercase">Subtotal</span>
              <span className="font-mono font-semibold text-slate-900">
                {content.currency} {Number(content.subtotal || 0).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between p-1.5 font-medium">
              <span className="text-slate-500 uppercase">Tax / VAT Total</span>
              <span className="font-mono font-semibold text-slate-900">
                {content.currency} {Number(content.taxTotal || 0).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between p-1.5 font-medium">
              <span className="text-slate-500 uppercase">Discount</span>
              <span className="font-mono font-semibold text-red-600">
                - {content.currency} {Number(content.discount || 0).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between p-1.5 bg-emerald-50 font-bold border-t border-slate-900">
              <span className="text-emerald-800 uppercase text-[9px]">Grand Total</span>
              <span className="font-mono text-emerald-950 text-[10px]">
                {content.currency} {Number(content.grandTotal || 0).toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {content.amountInWords && (
          <div className="border border-slate-900 border-t-0 p-1.5 text-[8px] bg-slate-50/50">
            <span className="font-bold text-slate-500 uppercase text-[6px] block">Amount in Words:</span>
            <span className="font-medium italic text-slate-900">{content.amountInWords}</span>
          </div>
        )}
      </>
    ),
    authorization: (
      <div className="grid grid-cols-2 border border-slate-900 border-t-0 divide-x divide-slate-900 text-[8px]">
        <div className="p-1.5">
          <p className="font-bold text-[6px] text-slate-500 uppercase">Prepared By</p>
          <p className="font-semibold text-slate-800 mt-1">{latestVersion.createdBy?.name || "System Generated"}</p>
        </div>
        <div className="p-1.5 flex flex-col justify-between min-h-[45px] bg-slate-50/50">
          <p className="font-bold text-[5px] text-slate-400 uppercase text-center">Authorized Signature</p>
          <div className="border-t border-dashed border-slate-400 pt-0.5 text-center text-slate-400 text-[6px] italic">
            Authorized Signature
          </div>
        </div>
      </div>
    ),
  };

  const manifestOrder = isManifest
    ? resolveSectionOrder(MANIFEST_SECTION_KEYS, layout as ResolvedDocumentLayout<ManifestSectionKey> | null)
    : [];
  const manifestSections: Record<ManifestSectionKey, ReactNode> = {
    "manifest-info": (
      <div className="grid grid-cols-2 border border-slate-900 border-t-0 text-[8px] divide-x divide-slate-900">
        <div className="divide-y divide-slate-900">
          <div className="p-1.5">
            <p className="font-bold text-[6px] text-slate-500 uppercase">Manifest Number</p>
            <p className="font-mono font-bold text-slate-900 text-[9px]">{content.manifestNo || doc.documentNo || "DRAFT"}</p>
          </div>
          <div className="p-1.5">
            <p className="font-bold text-[6px] text-slate-500 uppercase">Manifest Date</p>
            <p className="font-medium text-slate-800">{content.manifestDate || "—"}</p>
          </div>
          <div className="p-1.5">
            <p className="font-bold text-[6px] text-slate-500 uppercase">Shipment Job No</p>
            <p className="font-mono text-slate-700">{content.shipmentJobNo || "—"}</p>
          </div>
        </div>
        <div className="divide-y divide-slate-900">
          {content.manifestType === "SEA" ? (
            <>
              <div className="p-1.5">
                <p className="font-bold text-[6px] text-slate-500 uppercase">MBL Reference</p>
                <p className="font-mono text-slate-700 text-[9px]">{content.mblNo || "—"}</p>
              </div>
              <div className="p-1.5">
                <p className="font-bold text-[6px] text-slate-500 uppercase">HBL Reference</p>
                <p className="font-mono text-slate-700 text-[9px]">{content.hblNo || "—"}</p>
              </div>
              <div className="p-1.5">
                <p className="font-bold text-[6px] text-slate-500 uppercase">Vessel / Voyage</p>
                <p className="font-semibold text-slate-800">{[content.vesselName, content.voyageNo].filter(Boolean).join(" / ") || "—"}</p>
              </div>
            </>
          ) : (
            <>
              <div className="p-1.5">
                <p className="font-bold text-[6px] text-slate-500 uppercase">MAWB Reference</p>
                <p className="font-mono text-slate-700 text-[9px]">{content.mawbNo || "—"}</p>
              </div>
              <div className="p-1.5">
                <p className="font-bold text-[6px] text-slate-500 uppercase">HAWB Reference</p>
                <p className="font-mono text-slate-700 text-[9px]">{content.hawbNo || "—"}</p>
              </div>
              <div className="p-1.5">
                <p className="font-bold text-[6px] text-slate-500 uppercase">Airline / Carrier</p>
                <p className="font-semibold text-slate-800">{content.airline || "—"}</p>
              </div>
            </>
          )}
        </div>
      </div>
    ),
    routing: (
      <div className="grid grid-cols-4 border border-slate-900 border-t-0 divide-x divide-slate-900 text-[8px]">
        {content.manifestType === "SEA" ? (
          <>
            <div className="p-1.5">
              <p className="font-bold text-[6px] text-slate-500 uppercase">Vessel</p>
              <p className="font-semibold text-slate-800">{content.vesselName || "—"}</p>
            </div>
            <div className="p-1.5">
              <p className="font-bold text-[6px] text-slate-500 uppercase">On Board Date</p>
              <p className="font-semibold text-slate-800">{content.onBoardDate ? new Date(content.onBoardDate).toLocaleDateString() : "—"}</p>
            </div>
            <div className="p-1.5">
              <p className="font-bold text-[6px] text-slate-500 uppercase">Port of Loading</p>
              <p className="font-semibold text-slate-800">{content.portOfLoading ? `${content.portOfLoading} (${content.originCountry || ""})` : "—"}</p>
            </div>
            <div className="p-1.5">
              <p className="font-bold text-[6px] text-slate-500 uppercase">Port of Discharge</p>
              <p className="font-semibold text-slate-800">{content.portOfDischarge ? `${content.portOfDischarge} (${content.destinationCountry || ""})` : "—"}</p>
            </div>
          </>
        ) : (
          <>
            <div className="p-1.5">
              <p className="font-bold text-[6px] text-slate-500 uppercase">Flight No</p>
              <p className="font-semibold text-slate-800">{content.flightNo || "—"}</p>
            </div>
            <div className="p-1.5">
              <p className="font-bold text-[6px] text-slate-500 uppercase">Flight Date</p>
              <p className="font-semibold text-slate-800">{content.flightDate ? new Date(content.flightDate).toLocaleDateString() : "—"}</p>
            </div>
            <div className="p-1.5">
              <p className="font-bold text-[6px] text-slate-500 uppercase">Departure Airport</p>
              <p className="font-semibold text-slate-800">{content.airportOfDeparture ? `${content.airportOfDeparture} (${content.originCountry || ""})` : "—"}</p>
            </div>
            <div className="p-1.5">
              <p className="font-bold text-[6px] text-slate-500 uppercase">Destination Airport</p>
              <p className="font-semibold text-slate-800">{content.airportOfDestination ? `${content.airportOfDestination} (${content.destinationCountry || ""})` : "—"}</p>
            </div>
          </>
        )}
      </div>
    ),
    parties: (
      <div className="grid grid-cols-2 border border-slate-900 border-t-0 text-[8px] divide-x divide-slate-900">
        <div className="p-1.5 min-h-[50px] space-y-0.5">
          <p className="font-bold text-[6px] text-slate-500 uppercase">Shipper</p>
          <p className="whitespace-pre-line font-medium text-slate-800 leading-tight">{content.shipper || "—"}</p>
        </div>
        <div className="p-1.5 min-h-[50px] space-y-0.5">
          <p className="font-bold text-[6px] text-slate-500 uppercase">Consignee</p>
          <p className="whitespace-pre-line font-medium text-slate-800 leading-tight">{content.consignee || "—"}</p>
        </div>
      </div>
    ),
    "cargo-summary": (
      <div className="grid grid-cols-4 border border-slate-900 border-t-0 text-[8px] divide-x divide-slate-900">
        <div className="p-1.5">
          <p className="font-bold text-[6px] text-slate-500 uppercase">Total Pieces</p>
          <p className="font-semibold text-slate-800">{content.totalPieces || "—"}</p>
        </div>
        <div className="p-1.5">
          <p className="font-bold text-[6px] text-slate-500 uppercase">Gross Weight</p>
          <p className="font-mono text-slate-900">{content.grossWeight || "—"}</p>
        </div>
        <div className="p-1.5">
          <p className="font-bold text-[6px] text-slate-500 uppercase">Chargeable Weight</p>
          <p className="font-mono text-slate-900">{content.chargeableWeight || "—"}</p>
        </div>
        <div className="p-1.5">
          <p className="font-bold text-[6px] text-slate-500 uppercase">Dimensions</p>
          <p className="font-mono text-slate-850">{content.dimensions || "—"}</p>
        </div>
      </div>
    ),
    commodity: (
      <div className="grid grid-cols-2 border border-slate-900 border-t-0 text-[8px] divide-x divide-slate-900">
        <div className="p-1.5">
          <p className="font-bold text-[6px] text-slate-500 uppercase">Commodity Description</p>
          <p className="text-slate-800">{content.commodity || "—"}</p>
        </div>
        <div className="p-1.5">
          <p className="font-bold text-[6px] text-slate-500 uppercase">HS Code</p>
          <p className="font-mono text-slate-700">{content.hsCode || "—"}</p>
        </div>
      </div>
    ),
    "line-items": (
      <div className="border border-slate-900 border-t-0">
        <div className="bg-slate-50 p-1 font-bold text-[6px] uppercase text-slate-500 border-b border-slate-900 text-center tracking-wider">
          CONSOLIDATION LINE ITEMS
        </div>
        <table className="w-full text-left text-[7px] leading-tight border-collapse">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-900 font-bold text-[5px] uppercase text-slate-500 divide-x divide-slate-900">
              <th className="p-1.5 w-2/12">{content.manifestType === "SEA" ? "HBL No" : "HAWB No"}</th>
              <th className="p-1.5 w-3/12">Shipper</th>
              <th className="p-1.5 w-3/12">Consignee</th>
              <th className="p-1.5 w-1/12 text-center">Pcs</th>
              <th className="p-1.5 w-2/12 text-right">Gross Wt</th>
              <th className="p-1.5 w-3/12">Commodity</th>
              <th className="p-1.5 w-2/12 text-center">{content.manifestType === "SEA" ? "Discharge Port" : "Dest Airport"}</th>
            </tr>
          </thead>
          <tbody>
            {(content.lineItems || []).map((item: any, idx: number) => (
              <tr key={idx} className="divide-x divide-slate-900 border-b border-slate-900/10 last:border-b-0 align-top">
                <td className="p-1.5 font-mono font-semibold text-slate-950">
                  {content.manifestType === "SEA" ? (item.hblNo || "—") : (item.hawbNo || "—")}
                </td>
                <td className="p-1.5 text-slate-800 font-medium truncate max-w-[80px]">{item.shipper || "—"}</td>
                <td className="p-1.5 text-slate-800 font-medium truncate max-w-[80px]">{item.consignee || "—"}</td>
                <td className="p-1.5 text-center text-slate-800 font-semibold">{item.pieces || "—"}</td>
                <td className="p-1.5 text-right font-mono text-slate-900">{item.grossWeight || "—"}</td>
                <td className="p-1.5 text-slate-850 truncate max-w-[100px]">{item.commodity || "—"}</td>
                <td className="p-1.5 text-center font-semibold text-slate-800">{item.destination || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ),
    remarks: (
      <div className="grid grid-cols-2 border border-slate-900 border-t-0 text-[8px] divide-x divide-slate-900">
        <div className="p-1.5 min-h-[40px]">
          <p className="font-bold text-[6px] text-slate-500 uppercase">Marks & Numbers</p>
          <p className="whitespace-pre-wrap font-mono text-slate-700 mt-0.5">{content.marksAndNumbers || "—"}</p>
        </div>
        <div className="p-1.5 min-h-[40px]">
          <p className="font-bold text-[6px] text-slate-500 uppercase">Special Handling / Remarks</p>
          <p className="whitespace-pre-wrap text-slate-700 mt-0.5">{content.specialHandlingInformation || content.remarks || "—"}</p>
        </div>
      </div>
    ),
    authorization: (
      <div className="grid grid-cols-2 border border-slate-900 border-t-0 divide-x divide-slate-900 text-[8px]">
        <div className="p-1.5">
          <p className="font-bold text-[6px] text-slate-500 uppercase">Prepared By</p>
          <p className="font-semibold text-slate-800 mt-1">{latestVersion.createdBy?.name || "System Generated"}</p>
        </div>
        <div className="p-1.5 flex flex-col justify-between min-h-[45px] bg-slate-50/50">
          <p className="font-bold text-[5px] text-slate-400 uppercase text-center">Authorized Signature</p>
          <div className="border-t border-dashed border-slate-400 pt-0.5 text-center text-slate-400 text-[6px] italic">
            Authorized Signature
          </div>
        </div>
      </div>
    ),
  };

  return (
    <div className="bg-white text-slate-950 font-sans p-6 max-w-4xl mx-auto min-h-screen">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              .page-break {
                page-break-before: always !important;
                break-before: page !important;
              }
              body {
                background-color: white !important;
                color: black !important;
              }
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
                justify-content: start !important;
                box-sizing: border-box !important;
                border-radius: 0 !important;
                padding: 12px !important;
                margin: 0 !important;
                box-shadow: none !important;
              }
              .print-content {
                display: flex !important;
                flex-direction: column !important;
                justify-content: start !important;
                flex-grow: 1 !important;
                height: 100% !important;
              }
              .cargo-row {
                height: 110mm !important;
              }
              /* Optimize and scale text sizes for full-page legibility */
              .print-page p, .print-page td {
                font-size: 9.5px !important;
                line-height: 1.25 !important;
              }
              .print-page th {
                font-size: 7.5px !important;
              }
              .print-page .font-bold.text-\\[6px\\],
              .print-page .font-bold.text-\\[5px\\] {
                font-size: 7px !important; /* Scale labels slightly */
              }
              .print-page .text-\\[11px\\] {
                font-size: 13px !important; /* House Bill of Lading title */
              }
              .print-page .font-mono.text-\\[9px\\] {
                font-size: 11px !important; /* HBL Number / MBL */
              }
            }
          `,
        }}
      />
      {/* Print Controls (hidden on print media) */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 bg-slate-50 border p-4 rounded-lg mb-6 print:hidden print-hidden">
        <div className="space-y-1">
          <h1 className="text-sm font-bold text-slate-800">Print / Save Document</h1>
          <p className="text-xs text-slate-500">Choose a print set before printing or saving to PDF.</p>
          
          {isHbl && (
            <div className="flex flex-wrap gap-2 mt-2">
              <a
                href="?set=originals"
                className={`px-3 py-1 rounded text-xs font-medium border transition-colors ${
                  currentSet === "originals"
                    ? "bg-emerald-50 border-emerald-300 text-emerald-700 font-semibold"
                    : "bg-white border-slate-200 text-slate-650 hover:bg-slate-50"
                }`}
              >
                Originals Only
              </a>
              <a
                href="?set=office"
                className={`px-3 py-1 rounded text-xs font-medium border transition-colors ${
                  currentSet === "office"
                    ? "bg-emerald-50 border-emerald-300 text-emerald-700 font-semibold"
                    : "bg-white border-slate-200 text-slate-650 hover:bg-slate-50"
                }`}
              >
                Office Set
              </a>
              <a
                href="?set=customer"
                className={`px-3 py-1 rounded text-xs font-medium border transition-colors ${
                  currentSet === "customer"
                    ? "bg-emerald-50 border-emerald-300 text-emerald-700 font-semibold"
                    : "bg-white border-slate-200 text-slate-650 hover:bg-slate-50"
                }`}
              >
                Customer Set
              </a>
              <a
                href="?set=full"
                className={`px-3 py-1 rounded text-xs font-medium border transition-colors ${
                  currentSet === "full"
                    ? "bg-emerald-50 border-emerald-300 text-emerald-700 font-semibold"
                    : "bg-white border-slate-200 text-slate-650 hover:bg-slate-50"
                }`}
              >
                Full Set
              </a>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 self-end md:self-center">
          <button
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded text-xs font-semibold shadow-sm transition-colors"
            data-print-trigger
          >
            <Printer className="h-4 w-4" /> Print / Save PDF
          </button>
        </div>
      </div>

      <div id="print-area">
        {isHbl ? (
          <div className="space-y-8 print:space-y-0">
            {hblCopies.map((copy, index) => (
              <div
                key={index}
                className={`relative rounded border border-slate-900 bg-white p-6 font-sans text-[10px] space-y-0 leading-normal select-none print-page ${
                  index > 0 ? "page-break print:mt-0" : ""
                }`}
              >
                {/* Print Metadata label at top right */}
                <div className="absolute top-4 right-6 text-[8px] font-extrabold text-slate-950 uppercase tracking-wider z-20">
                  {copy.label}
                </div>

                {/* Styled CSS Watermark Overlay in the middle background */}
                {hblPrintWatermarkEnabled && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0 opacity-[0.04] overflow-hidden">
                    <div className="text-[55px] font-black tracking-widest text-slate-950 uppercase rotate-[25deg] text-center whitespace-pre-line leading-none">
                      {copy.watermark}
                    </div>
                  </div>
                )}

                <div className="relative z-10 space-y-3 print-content">
            {/* Company Branding Header */}
            <div className="flex items-center justify-between border border-slate-900 border-b-0 p-3 bg-slate-50/50">
              {logoUrl ? (
                <img
                  alt={`${companyName} logo`}
                  className="h-10 w-auto object-contain"
                  height={40}
                  src={logoUrl}
                  width={140}
                />
              ) : (
                <div className="text-[12px] font-bold text-slate-850 uppercase tracking-wide">
                  {companyName}
                </div>
              )}
              <div className="text-right text-[8px] text-slate-500 font-medium leading-normal">
                <p className="font-bold text-[9px] text-slate-850 uppercase">{companyLegalName}</p>
                {companyAddress && <p className="max-w-[250px] line-clamp-2">{companyAddress}</p>}
                <p>{[companyEmail, companyPhone].filter(Boolean).join(" | ")}</p>
              </div>
            </div>

            {hblOrder.map((key) => (
              <Fragment key={key}>{hblSections[key]}</Fragment>
            ))}

            <div className="flex justify-between items-center text-[6px] text-slate-400 pt-1.5">
              <p>Status: <span className="font-bold text-slate-600">{doc.status}</span></p>
              <p className="italic">This is a system generated House Bill of Lading copy.</p>
            </div>
                </div>
              </div>
            ))}
          </div>
        ) : isHawb ? (
          <div className="rounded border border-slate-900 bg-white p-6 font-sans text-[10px] space-y-0 leading-normal select-none print-page">
            <div className="print-content space-y-3 flex-grow">
            {/* Company Branding Header */}
            <div className="flex items-center justify-between border border-slate-900 border-b-0 p-3 bg-slate-50/50">
              {logoUrl ? (
                <img
                  alt={`${companyName} logo`}
                  className="h-10 w-auto object-contain"
                  height={40}
                  src={logoUrl}
                  width={140}
                />
              ) : (
                <div className="text-[12px] font-bold text-slate-850 uppercase tracking-wide">
                  {companyName}
                </div>
              )}
              <div className="text-right text-[8px] text-slate-500 font-medium leading-normal">
                <p className="font-bold text-[9px] text-slate-850 uppercase">{companyLegalName}</p>
                {companyAddress && <p className="max-w-[250px] line-clamp-2">{companyAddress}</p>}
                <p>{[companyEmail, companyPhone].filter(Boolean).join(" | ")}</p>
              </div>
            </div>

            {hawbOrder.map((key) => (
              <Fragment key={key}>{hawbSections[key]}</Fragment>
            ))}

            <div className="flex justify-between items-center text-[6px] text-slate-400 pt-1">
              <p>Status: <span className="font-bold text-slate-600">{doc.status}</span></p>
              <p className="italic">This is a system generated House Air Waybill copy.</p>
            </div>
            </div>
          </div>
        ) : isDebitNote ? (
          <div className="rounded border border-slate-900 bg-white p-6 font-sans text-[10px] space-y-0 leading-normal select-none print-page">
            <div className="print-content space-y-3 flex-grow">
            {/* Company Branding Header */}
            <div className="flex items-center justify-between border border-slate-900 border-b-0 p-3 bg-slate-50/50">
              {logoUrl ? (
                <img
                  alt={`${companyName} logo`}
                  className="h-10 w-auto object-contain"
                  height={40}
                  src={logoUrl}
                  width={140}
                />
              ) : (
                <div className="text-[12px] font-bold text-slate-850 uppercase tracking-wide">
                  {companyName}
                </div>
              )}
              <div className="text-right text-[8px] text-slate-500 font-medium leading-normal">
                <p className="font-bold text-[9px] text-slate-850 uppercase">{companyLegalName}</p>
                {companyAddress && <p className="max-w-[250px] line-clamp-2">{companyAddress}</p>}
                <p>{[companyEmail, companyPhone].filter(Boolean).join(" | ")}</p>
              </div>
            </div>

            {debitNoteOrder.map((key) => (
              <Fragment key={key}>{debitNoteSections[key]}</Fragment>
            ))}

            <div className="flex justify-between items-center text-[6px] text-slate-400 pt-1">
              <p>Status: <span className="font-bold text-slate-600">{doc.status}</span></p>
              <p className="italic">This is a system generated Customer Debit Note document.</p>
            </div>
            </div>
          </div>
        ) : isManifest ? (
          <div className="rounded border border-slate-900 bg-white p-6 font-sans text-[10px] space-y-0 leading-normal select-none print-page">
            <div className="print-content space-y-0 flex-grow">
            {/* Company Branding Header */}
            <div className="flex items-center justify-between border border-slate-900 border-b-0 p-3 bg-slate-50/50">
              {logoUrl ? (
                <img
                  alt={`${companyName} logo`}
                  className="h-10 w-auto object-contain"
                  height={40}
                  src={logoUrl}
                  width={140}
                />
              ) : (
                <div className="text-[12px] font-bold text-slate-850 uppercase tracking-wide">
                  {companyName}
                </div>
              )}
              <div className="text-right text-[8px] text-slate-500 font-medium leading-normal">
                <p className="font-bold text-[9px] text-slate-850 uppercase">{companyLegalName}</p>
                {companyAddress && <p className="max-w-[250px] line-clamp-2">{companyAddress}</p>}
                <p>{[companyEmail, companyPhone].filter(Boolean).join(" | ")}</p>
              </div>
            </div>

            {/* Manifest Title */}
            <div className="flex flex-col items-center justify-center text-center pb-2 pt-2 border-x border-b border-slate-900 border-t-0 space-y-0.5">
              <h4 className="font-bold text-[13px] text-emerald-800 tracking-wider">
                {content.manifestType === "SEA" ? "OCEAN FREIGHT CARGO MANIFEST" : "AIR CARGO MANIFEST"}
              </h4>
              <p className="text-[7px] text-slate-500 font-medium uppercase">
                {content.manifestType === "SEA" ? "Forwarder Ocean Consolidation Manifest" : "Forwarder Consolidation Cargo Manifest"}
              </p>
            </div>

            {manifestOrder.map((key) => (
              <Fragment key={key}>{manifestSections[key]}</Fragment>
            ))}

            <div className="flex justify-between items-center text-[6px] text-slate-400 pt-1">
              <p>Status: <span className="font-bold text-slate-600">{doc.status}</span></p>
              <p className="italic">This is a system generated {content.manifestType === "SEA" ? "Ocean Freight" : "Air"} Cargo Manifest.</p>
            </div>
            </div>
          </div>
        ) : (
          <div className="rounded border border-slate-700 bg-white p-6 text-slate-950 font-sans text-xs space-y-4">
            <div className="flex justify-between border-b pb-3 border-slate-300">
              <div className="font-bold text-lg text-emerald-800">{doc.type}</div>
              <div className="text-right">
                <p className="font-semibold">Doc No: {doc.documentNo}</p>
                <p className="text-slate-500">Status: {doc.status}</p>
              </div>
            </div>
            <div className="whitespace-pre-wrap text-slate-700 bg-slate-50 p-4 rounded border">
              {JSON.stringify(content, null, 2)}
            </div>
          </div>
        )}
      </div>

      {/* Script to trigger browser print on button click */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            window.onload = function() {
              const trigger = document.querySelector('[data-print-trigger]');
              if (trigger) {
                trigger.onclick = function() { window.print(); };
              }
            };
          `,
        }}
      />
    </div>
  );
}
