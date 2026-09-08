"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Folder,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  Search,
  FileText,
  Download,
  ExternalLink,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface FreightDoc {
  id: string;
  documentNo: string;
  type: string;
  status: string;
  createdAt: string | Date;
  filePath: string | null;
}

interface Shipment {
  id: string;
  jobNo: string;
  shipmentType: string;
  transportMode: string;
  originCountry: string;
  destinationCountry: string;
  currentStatus: string | null;
  freightDocuments: FreightDoc[];
}

export function PortalDocumentsClient({
  shipments,
  companySlug,
}: {
  shipments: Shipment[];
  companySlug: string;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>(() => {
    // Open the first folder by default if there are any shipments
    if (shipments.length > 0) {
      return { [shipments[0].id]: true };
    }
    return {};
  });

  const toggleFolder = (id: string) => {
    setOpenFolders((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Filter shipments based on search query (matches job number or any document number inside it)
  const filteredShipments = shipments.filter((shipment) => {
    const matchesJob = shipment.jobNo
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesDoc = shipment.freightDocuments.some((doc) =>
      doc.documentNo.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return matchesJob || matchesDoc;
  });

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      {/* Search Input */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search by Job No or Document No..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-10 w-full rounded-md border border-slate-200 bg-white pl-10 pr-4 text-sm shadow-sm focus:border-cyan-500 focus:outline-none"
        />
      </div>

      {/* Shipment Folders List */}
      <div className="space-y-4">
        {filteredShipments.map((shipment) => {
          const isOpen = !!openFolders[shipment.id];
          const docCount = shipment.freightDocuments.length;

          return (
            <Card key={shipment.id} className="overflow-hidden border-slate-200 shadow-sm">
              {/* Folder Row Header */}
              <div
                onClick={() => toggleFolder(shipment.id)}
                className="flex cursor-pointer items-center justify-between bg-white p-5 hover:bg-slate-50 transition select-none border-b border-slate-100"
              >
                <div className="flex items-center gap-4">
                  {isOpen ? (
                    <FolderOpen className="h-8 w-8 text-cyan-600 shrink-0" />
                  ) : (
                    <Folder className="h-8 w-8 text-cyan-600 shrink-0" />
                  )}
                  <div>
                    <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                      {shipment.jobNo}
                      <span className="text-xs font-normal text-slate-500">
                        ({shipment.shipmentType} / {shipment.transportMode})
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {shipment.originCountry} to {shipment.destinationCountry}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="text-xs font-medium">
                    {docCount} {docCount === 1 ? "Document" : "Documents"}
                  </Badge>
                  {shipment.currentStatus && (
                    <Badge variant="secondary" className="text-xs">
                      {shipment.currentStatus}
                    </Badge>
                  )}
                  {isOpen ? (
                    <ChevronDown className="h-5 w-5 text-slate-400" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-slate-400" />
                  )}
                </div>
              </div>

              {/* Folder Documents Content */}
              {isOpen && (
                <CardContent className="p-0 bg-slate-50/50">
                  {docCount > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            <th className="px-5 py-3">Document Number</th>
                            <th className="px-5 py-3">Type</th>
                            <th className="px-5 py-3">Created Date</th>
                            <th className="px-5 py-3">Status</th>
                            <th className="px-5 py-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {shipment.freightDocuments.map((doc) => (
                            <tr key={doc.id} className="hover:bg-slate-50/40">
                              <td className="px-5 py-3 font-medium text-slate-900">
                                <Link
                                  href={`/portal/${companySlug}/shipments/${shipment.id}/freight-documents/${doc.id}`}
                                  className="flex items-center gap-1.5 text-cyan-700 hover:underline"
                                >
                                  <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                                  {doc.documentNo}
                                </Link>
                              </td>
                              <td className="px-5 py-3 text-slate-600">
                                {doc.type}
                              </td>
                              <td className="px-5 py-3 text-slate-500">
                                {formatDate(doc.createdAt)}
                              </td>
                              <td className="px-5 py-3">
                                <Badge
                                  className="text-[11px] font-medium"
                                  variant={
                                    doc.status === "APPROVED"
                                      ? "success"
                                      : doc.status === "UNDER_REVIEW"
                                      ? "warning"
                                      : "secondary"
                                  }
                                >
                                  {doc.status}
                                </Badge>
                              </td>
                              <td className="px-5 py-3 text-right">
                                <div className="flex justify-end gap-2">
                                  <Button asChild size="sm" variant="outline" className="h-8 text-xs">
                                    <Link
                                      href={`/portal/${companySlug}/shipments/${shipment.id}/freight-documents/${doc.id}`}
                                    >
                                      <ExternalLink className="mr-1 h-3 w-3" />
                                      {doc.status === "UNDER_REVIEW" ? "Review & Action" : "View"}
                                    </Link>
                                  </Button>
                                  {doc.filePath && (
                                    <Button asChild size="sm" variant="outline" className="h-8 text-xs bg-slate-50 hover:bg-slate-100">
                                      <a
                                        href={`/api/portal/${companySlug}/documents/${doc.id}/download`}
                                        download
                                      >
                                        <Download className="mr-1 h-3 w-3" />
                                        Download
                                      </a>
                                    </Button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-8 text-center text-sm text-slate-500">
                      No freight forwarder documents generated for this shipment.
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}

        {filteredShipments.length === 0 && (
          <div className="rounded-md border border-dashed border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
            No matching shipments or documents found.
          </div>
        )}
      </div>
    </div>
  );
}
