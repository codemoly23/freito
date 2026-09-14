"use client";

/* eslint-disable @typescript-eslint/no-explicit-any -- `document` and its version `content` mirror the
   Prisma Json-backed, per-template shape handled the same way in freight-document-forms.tsx. */
import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Printer, Share2, ArrowLeft, Lock, FileClock, Eye, EyeOff } from "lucide-react";
import { toggleClientVisibility } from "@/lib/actions/freight-documents";

export function FreightDocumentView({
  document,
  amendAction,
  isAdminOrManager,
}: {
  document: any;
  amendAction: (formData: FormData) => Promise<void>;
  isAdminOrManager: boolean;
}) {
  const [isClientVisible, setIsClientVisible] = useState(document.isClientVisible);
  const [isPending, startTransition] = useTransition();

  const handleToggleVisibility = () => {
    startTransition(async () => {
      const formData = new FormData();
      formData.append("documentId", document.id);
      formData.append("isClientVisible", String(!isClientVisible));
      await toggleClientVisibility(formData);
      setIsClientVisible(!isClientVisible);
    });
  };

  const latestVersion = document.versions[0];
  const isHbl = document.type === "HBL";
  const isHawb = document.type === "HAWB";
  const isDebitNote = document.type === "DEBIT_NOTE";
  
  const rawContent = latestVersion?.content as any;
  const content = (isHbl || isHawb || isDebitNote) ? (rawContent?.clientFields || {}) : (rawContent || {});

  const companyName = document.company.name;
  const companyLegalName = document.company.legalName || companyName;
  const companyAddress = document.company.address;
  const companyEmail = document.company.email;
  const companyPhone = document.company.phone;
  const logoUrl = document.company.logoPath 
    ? `/api/company/branding/logo?v=${document.company.logoUpdatedAt?.getTime().toString() || ""}`
    : null;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Premium Toolbar */}
      <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="sm" className="h-9">
            <a href={`/dashboard/shipments/${document.shipmentJobId}#freight-documents`}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </a>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-md font-bold text-slate-900">{document.documentNo}</h2>
              <Badge variant={document.status === "LOCKED" ? "success" : "secondary"}>
                {document.status}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Version v{latestVersion?.versionNumber || 1} • {document.type} Document
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
          {/* Print/Save PDF */}
          <Button asChild size="sm" variant="outline" className="h-9">
            <a 
              href={`/dashboard/shipments/${document.shipmentJobId}/freight-documents/${document.id}/print`} 
              target="_blank" 
              rel="noopener noreferrer"
            >
              <Printer className="h-4 w-4 mr-2" /> Print / Save PDF
            </a>
          </Button>

          {/* Share/Publish to Portal Toggle */}
          <Button
            size="sm"
            variant={isClientVisible ? "default" : "outline"}
            onClick={handleToggleVisibility}
            disabled={isPending}
            className="h-9"
          >
            {isClientVisible ? (
              <>
                <EyeOff className="h-4 w-4 mr-2" /> Hide from Portal
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 mr-2" /> Publish to Portal
              </>
            )}
          </Button>

          {/* Create Amendment (if locked) */}
          {document.status === "LOCKED" && isAdminOrManager && (
            <form action={amendAction}>
              <input type="hidden" name="documentId" value={document.id} />
              <Button type="submit" size="sm" variant="destructive" className="h-9">
                <FileClock className="h-4 w-4 mr-2" /> Amend Document
              </Button>
            </form>
          )}
        </div>
      </div>

      {/* Main Document Content */}
      <Card className="bg-white border border-slate-200 p-8 shadow-sm overflow-x-auto">
        {isHbl ? (
          <div className="rounded border border-slate-900 bg-white p-6 font-sans text-[10px] space-y-0 leading-normal select-none w-[750px] mx-auto">
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

            {/* Upper Section */}
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

            {/* Routing Section */}
            <div className="grid grid-cols-4 border border-slate-900 border-b-0 divide-x divide-slate-900">
              <div className="p-1.5">
                <p className="font-bold text-[6px] text-slate-500 uppercase">Pre-Carriage / Receipt Place</p>
                <p className="font-semibold text-slate-800 text-[8px] mt-0.5">{content.placeOfReceipt || "—"}</p>
              </div>
              <div className="p-1.5">
                <p className="font-bold text-[6px] text-slate-500 uppercase">Vessel & Voyage</p>
                <p className="font-semibold text-slate-800 text-[8px] mt-0.5">{content.vessel ? `${content.vessel} v.${content.voyage}` : "—"}</p>
              </div>
              <div className="p-1.5">
                <p className="font-bold text-[6px] text-slate-500 uppercase">Port of Loading</p>
                <p className="font-semibold text-slate-800 text-[8px] mt-0.5">{content.portOfLoading || "—"}</p>
              </div>
              <div className="p-1.5">
                <p className="font-bold text-[6px] text-slate-500 uppercase">Port of Discharge</p>
                <p className="font-semibold text-slate-800 text-[8px] mt-0.5">{content.portOfDischarge || "—"}</p>
              </div>
            </div>

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

            {/* Cargo Table */}
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
                <tr className="divide-x divide-slate-900 align-top">
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

            {/* Lower details */}
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

            <div className="flex justify-between items-center text-[6px] text-slate-400 pt-1.5">
              <p>Status: <span className="font-bold text-slate-600">{document.status}</span></p>
              <p className="italic">This is a system generated House Bill of Lading copy.</p>
            </div>
          </div>
        ) : isHawb ? (
          <div className="rounded border border-slate-900 bg-white p-6 font-sans text-[10px] space-y-0 leading-normal select-none w-[750px] mx-auto">
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

            {/* Upper Section */}
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

            {/* Routing Section */}
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

            {/* Cargo Table */}
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
                <tr className="divide-x divide-slate-900 align-top">
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

            {/* Prepared By and Authorization */}
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

            <div className="flex justify-between items-center text-[6px] text-slate-400 pt-1">
              <p>Status: <span className="font-bold text-slate-600">{document.status}</span></p>
              <p className="italic">This is a system generated House Air Waybill copy.</p>
            </div>
          </div>
        ) : isDebitNote ? (
          <div className="rounded border border-slate-900 bg-white p-6 font-sans text-[10px] space-y-0 leading-normal select-none w-[750px] mx-auto">
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

            {/* Debit Note Metadata */}
            <div className="grid grid-cols-2 border border-slate-900 border-b-0 divide-x divide-slate-900">
              <div className="p-2 space-y-1">
                <p className="font-bold text-[6px] text-slate-500 uppercase">Billed To</p>
                <p className="font-bold text-slate-800 text-[10px]">{content.billedToName || "—"}</p>
                <p className="whitespace-pre-wrap text-slate-600 leading-tight text-[8px]">{content.billedToAddress || "—"}</p>
              </div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 p-2 bg-slate-50/40 text-[8px]">
                <div>
                  <p className="font-bold text-[6px] text-slate-400 uppercase">Document Ref No</p>
                  <p className="font-mono font-bold text-slate-900 text-[9px]">{document.documentNo}</p>
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

            {/* Routing Details */}
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

            {/* Charge Table */}
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

            {/* Summary / Totals */}
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

            {/* Amount in words */}
            {content.amountInWords && (
              <div className="border border-slate-900 border-t-0 p-1.5 text-[8px] bg-slate-50/50">
                <span className="font-bold text-slate-500 uppercase text-[6px] block">Amount in Words:</span>
                <span className="font-medium italic text-slate-900">{content.amountInWords}</span>
              </div>
            )}

            {/* Prepared By and Authorization */}
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

            <div className="flex justify-between items-center text-[6px] text-slate-400 pt-1">
              <p>Status: <span className="font-bold text-slate-600">{document.status}</span></p>
              <p className="italic">This is a system generated Customer Debit Note document.</p>
            </div>
          </div>
        ) : (
          <div className="rounded border border-slate-700 bg-white p-6 text-slate-950 font-sans text-xs space-y-4">
            <div className="flex justify-between border-b pb-3 border-slate-300">
              <div className="font-bold text-lg text-emerald-800">{document.type}</div>
              <div className="text-right">
                <p className="font-semibold">Doc No: {document.documentNo}</p>
                <p className="text-slate-500">Status: {document.status}</p>
              </div>
            </div>
            <div className="whitespace-pre-wrap text-slate-700 bg-slate-50 p-4 rounded border">
              {JSON.stringify(content, null, 2)}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
