/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Eye, EyeOff, Lock, Unlock, FileText, CheckCircle2, AlertCircle, Trash2, Printer, XCircle } from "lucide-react";
import type { ActionState } from "@/lib/actions/helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import Image from "next/image";

type FormAction = (
  state: ActionState,
  formData: FormData,
) => Promise<ActionState>;

const initialState: ActionState = {};

function Alert({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return (
    <p className={state.ok ? "text-xs text-emerald-700 font-medium" : "text-xs text-red-600 font-medium"}>
      {state.message}
    </p>
  );
}

// Generate New Document Form (HBL, HAWB, MANIFEST, DEBIT_NOTE)
export function GenerateFreightDocumentForm({
  action,
  shipmentJobId,
}: {
  action: FormAction;
  shipmentJobId: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <input type="hidden" name="shipmentJobId" value={shipmentJobId} />
      <div className="flex flex-col gap-1.5 shrink-0">
        <Label htmlFor="docType" className="text-sm font-medium text-slate-700">Freight Document Type</Label>
        <select
          id="docType"
          name="type"
          required
          className="h-9 w-64 rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus:border-emerald-500 focus:outline-none"
        >
          <option value="HBL">House Bill of Lading (HBL)</option>
          <option value="HAWB">House Air Waybill (HAWB)</option>
          <option value="MANIFEST">Sea/Air Cargo Manifest</option>
          <option value="DEBIT_NOTE">Debit Note</option>
          <option value="SHIPPING_INSTRUCTION">Shipping Instruction (SI)</option>
          <option value="ARRIVAL_NOTICE">Arrival Notice (AN)</option>
        </select>
      </div>
      <div className="space-y-1.5">
        <Button type="submit" disabled={pending} className="bg-emerald-600 hover:bg-emerald-700 text-white h-9">
          <FileText className="h-4 w-4 mr-2" />
          Generate Draft
        </Button>
      </div>
      <div className="w-full mt-1">
        <Alert state={state} />
      </div>
    </form>
  );
}

// Client visibility Toggle Form
export function ToggleVisibilityForm({
  action,
  documentId,
  isClientVisible,
}: {
  action: (formData: FormData) => Promise<void>;
  documentId: string;
  isClientVisible: boolean;
}) {
  const [visible, setVisible] = useState(isClientVisible);
  const router = useRouter();
  return (
    <form
      action={async (formData) => {
        await action(formData);
        setVisible(!visible);
        router.refresh();
      }}
      className="flex items-center gap-2"
    >
      <input type="hidden" name="documentId" value={documentId} />
      <input type="hidden" name="isClientVisible" value={(!visible).toString()} />
      <Button
        type="submit"
        variant="outline"
        size="sm"
        className="h-8 text-xs gap-1.5"
      >
        {visible ? (
          <>
            <EyeOff className="h-3.5 w-3.5 text-slate-500" />
            Hide from Portal
          </>
        ) : (
          <>
            <Eye className="h-3.5 w-3.5 text-emerald-600" />
            Publish to Portal
          </>
        )}
      </Button>
    </form>
  );
}

export function DeleteDraftFreightDocumentForm({
  action,
  documentId,
}: {
  action: FormAction;
  documentId: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const router = useRouter();

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [router, state.ok]);

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="documentId" value={documentId} />
      <Button
        type="submit"
        variant="destructive"
        size="icon"
        className="h-8 w-8"
        disabled={pending}
        title="Delete Draft"
        onClick={(event) => {
          const confirmed = window.confirm(
            "Delete draft document?\n\nThis will remove the unused draft from this shipment. Locked or published documents cannot be deleted.",
          );
          if (!confirmed) event.preventDefault();
        }}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
      <Alert state={state} />
    </form>
  );
}

// Document Editor Form
export function FreightDocumentEditForm({
  updateAction,
  submitAction,
  approveAction,
  lockAction,
  amendAction,
  rejectAction,
  document,
  siblingDocs = [],
  isAdminOrManager,
}: {
  updateAction: FormAction;
  submitAction: (formData: FormData) => Promise<ActionState | void>;
  approveAction: (formData: FormData) => Promise<void>;
  lockAction: (formData: FormData) => Promise<void>;
  amendAction: (formData: FormData) => Promise<void>;
  rejectAction: (formData: FormData) => Promise<void>;
  document: any;
  siblingDocs?: Array<{ id: string; type: string; documentNo: string; status: string; versions: Array<{ content: any }> }>;
  isAdminOrManager: boolean;
}) {
  const isHbl = document.type === "HBL";
  const isHawb = document.type === "HAWB";
  const isManifest = document.type === "MANIFEST";
  const isDebitNote = document.type === "DEBIT_NOTE";
  const version = document.versions[0];
  const initialContent = version?.content || {};
  const initialClientFields = (isHbl || isHawb || isManifest || isDebitNote) ? (initialContent.clientFields || {}) : {};

  const hasLogo = Boolean(document.company?.logoPath);
  const logoUrl = hasLogo ? `/api/company/branding/logo?v=${document.company?.logoUpdatedAt ? new Date(document.company.logoUpdatedAt).getTime() : ""}` : null;
  const companyName = document.company?.name || "";
  const companyLegalName = document.company?.legalName || companyName;
  const companyAddress = document.company?.address || "";
  const companyEmail = document.company?.email || "";
  const companyPhone = document.company?.phone || "";

  // Form local state matching default content
  const [content, setContent] = useState<any>(
    isHbl
      ? {
          hblNo: initialClientFields.hblNo || document.documentNo || "",
          mblNo: initialClientFields.mblNo || "",
          shipmentJobNo: initialClientFields.shipmentJobNo || "",
          shipper: initialClientFields.shipper || "",
          consignee: initialClientFields.consignee || "",
          notifyParty: initialClientFields.notifyParty || "",
          placeOfReceipt: initialClientFields.placeOfReceipt || "",
          portOfLoading: initialClientFields.portOfLoading || "",
          portOfDischarge: initialClientFields.portOfDischarge || "",
          placeOfDelivery: initialClientFields.placeOfDelivery || "",
          finalDestination: initialClientFields.finalDestination || "",
          vessel: initialClientFields.vessel || "",
          voyage: initialClientFields.voyage || "",
          preCarriageBy: initialClientFields.preCarriageBy || "",
          transshipmentPort: initialClientFields.transshipmentPort || "",
          isTransshipment: initialClientFields.isTransshipment || "no",
          transshipmentLegs: initialClientFields.transshipmentLegs || [],
          containerNo: initialClientFields.containerNo || "",
          sealNo: initialClientFields.sealNo || "",
          marksAndNumbers: initialClientFields.marksAndNumbers || "",
          packages: initialClientFields.packages || "",
          goodsDescription: initialClientFields.goodsDescription || "",
          hsCode: initialClientFields.hsCode || "",
          grossWeight: initialClientFields.grossWeight || "",
          measurement: initialClientFields.measurement || "",
          freightTerm: initialClientFields.freightTerm || "PREPAID",
          originalBlCount: initialClientFields.originalBlCount || "3",
          onBoardDate: initialClientFields.onBoardDate || "",
          issuePlace: initialClientFields.issuePlace || "",
          issueDate: initialClientFields.issueDate || "",
        }
      : isHawb
      ? {
          hawbNo: initialClientFields.hawbNo || document.documentNo || "",
          mawbNo: initialClientFields.mawbNo || "",
          shipmentJobNo: initialClientFields.shipmentJobNo || "",
          shipper: initialClientFields.shipper || "",
          consignee: initialClientFields.consignee || "",
          notifyParty: initialClientFields.notifyParty || "",
          airportOfDeparture: initialClientFields.airportOfDeparture || "",
          airportOfDestination: initialClientFields.airportOfDestination || "",
          requestedRouting: initialClientFields.requestedRouting || "",
          flightNo: initialClientFields.flightNo || "",
          flightDate: initialClientFields.flightDate || "",
          pieces: initialClientFields.pieces || "",
          grossWeight: initialClientFields.grossWeight || "",
          chargeableWeight: initialClientFields.chargeableWeight || "",
          dimensions: initialClientFields.dimensions || "",
          commodity: initialClientFields.commodity || "",
          handlingInformation: initialClientFields.handlingInformation || "",
          declaredValueForCarriage: initialClientFields.declaredValueForCarriage || "NVD",
          declaredValueForCustoms: initialClientFields.declaredValueForCustoms || "NCV",
          freightTerm: initialClientFields.freightTerm || "PREPAID",
          issuePlace: initialClientFields.issuePlace || "",
          issueDate: initialClientFields.issueDate || "",
        }
      : isManifest
      ? {
          manifestType: initialClientFields.manifestType || (document.shipmentJob?.transportMode === "SEA" ? "SEA" : "AIR"),
          manifestNo: initialClientFields.manifestNo || document.documentNo || "",
          manifestDate: initialClientFields.manifestDate || new Date().toISOString().split("T")[0],
          shipmentJobNo: initialClientFields.shipmentJobNo || "",
          // Air fields
          mawbNo: initialClientFields.mawbNo || "",
          hawbNo: initialClientFields.hawbNo || "",
          airline: initialClientFields.airline || "",
          flightNo: initialClientFields.flightNo || "",
          flightDate: initialClientFields.flightDate || "",
          airportOfDeparture: initialClientFields.airportOfDeparture || "",
          airportOfDestination: initialClientFields.airportOfDestination || "",
          // Sea fields
          mblNo: initialClientFields.mblNo || "",
          hblNo: initialClientFields.hblNo || "",
          vesselName: initialClientFields.vesselName || "",
          voyageNo: initialClientFields.voyageNo || "",
          onBoardDate: initialClientFields.onBoardDate || "",
          portOfLoading: initialClientFields.portOfLoading || "",
          portOfDischarge: initialClientFields.portOfDischarge || "",
          // Shared fields
          originCountry: initialClientFields.originCountry || "",
          destinationCountry: initialClientFields.destinationCountry || "",
          shipper: initialClientFields.shipper || "",
          consignee: initialClientFields.consignee || "",
          notifyParty: initialClientFields.notifyParty || "",
          totalPieces: initialClientFields.totalPieces || "",
          grossWeight: initialClientFields.grossWeight || "",
          chargeableWeight: initialClientFields.chargeableWeight || "",
          dimensions: initialClientFields.dimensions || "",
          commodity: initialClientFields.commodity || "",
          hsCode: initialClientFields.hsCode || "",
          marksAndNumbers: initialClientFields.marksAndNumbers || "",
          specialHandlingInformation: initialClientFields.specialHandlingInformation || "",
          remarks: initialClientFields.remarks || "",
          lineItems: initialClientFields.lineItems || [
            {
              hawbNo: "",
              shipper: "",
              consignee: "",
              pieces: "",
              grossWeight: "",
              chargeableWeight: "",
              commodity: "",
              destination: ""
            }
          ]
        }
      : isDebitNote
      ? {
          debitNoteNo: initialClientFields.debitNoteNo || document.documentNo || "",
          debitNoteDate: initialClientFields.debitNoteDate || new Date().toISOString().split("T")[0],
          shipmentJobNo: initialClientFields.shipmentJobNo || "",
          customerName: initialClientFields.customerName || "",
          customerAddress: initialClientFields.customerAddress || "",
          attention: initialClientFields.attention || "",
          referenceNo: initialClientFields.referenceNo || "",
          quotationNo: initialClientFields.quotationNo || "",
          invoiceNo: initialClientFields.invoiceNo || "",
          hblNo: initialClientFields.hblNo || "",
          hawbNo: initialClientFields.hawbNo || "",
          manifestNo: initialClientFields.manifestNo || "",
          origin: initialClientFields.origin || "",
          destination: initialClientFields.destination || "",
          transportMode: initialClientFields.transportMode || "",
          shipmentType: initialClientFields.shipmentType || "",
          currency: initialClientFields.currency || "USD",
          paymentTerms: initialClientFields.paymentTerms || "Net 30",
          dueDate: initialClientFields.dueDate || "",
          lineItems: initialClientFields.lineItems || [
            {
              description: "",
              basis: "",
              quantity: "",
              unitRate: "",
              amount: "",
              currency: "USD",
              tax: "",
              total: ""
            }
          ],
          subtotal: initialClientFields.subtotal || "0",
          taxTotal: initialClientFields.taxTotal || "0",
          discount: initialClientFields.discount || "0",
          grandTotal: initialClientFields.grandTotal || "0",
          amountInWords: initialClientFields.amountInWords || "",
          remarks: initialClientFields.remarks || "",
          paymentInstruction: initialClientFields.paymentInstruction || ""
        }
      : {
          shipper: { name: "", address: "", ...initialContent.shipper },
          consignee: { name: "", address: "", ...initialContent.consignee },
          notifyParty: { name: "", address: "", ...initialContent.notifyParty },
          vessel: initialContent.vessel || "",
          voyage: initialContent.voyage || "",
          preCarriageBy: initialContent.preCarriageBy || "",
          transshipmentPort: initialContent.transshipmentPort || "",
          isTransshipment: initialContent.isTransshipment || "no",
          transshipmentLegs: initialContent.transshipmentLegs || [],
          flightNo: initialContent.flightNo || "",
          carrier: initialContent.carrier || "",
          placeOfReceipt: initialContent.placeOfReceipt || "",
          portOfLoading: initialContent.portOfLoading || "",
          portOfDischarge: initialContent.portOfDischarge || "",
          placeOfDelivery: initialContent.placeOfDelivery || "",
          marksAndNumbers: initialContent.marksAndNumbers || "",
          cargoDescription: initialContent.cargoDescription || "",
          packageCount: initialContent.packageCount || 0,
          packageType: initialContent.packageType || "",
          grossWeight: initialContent.grossWeight || 0,
          netWeight: initialContent.netWeight || 0,
          cbm: initialContent.cbm || 0,
          freightTerms: initialContent.freightTerms || "PREPAID",
          ...initialContent,
        }
  );

  const [remarks, setRemarks] = useState("");
  const [state, formAction, pending] = useActionState(updateAction, initialState);

  const isLocked = document.status === "LOCKED" || document.status === "AMENDED";

  // Handle nested object change
  const handleNestedChange = (parent: string, field: string, val: string) => {
    setContent((prev: any) => ({
      ...prev,
      [parent]: {
        ...prev[parent],
        [field]: val,
      },
    }));
  };

  // Handle root level change
  const handleRootChange = (field: string, val: any) => {
    setContent((prev: any) => ({
      ...prev,
      [field]: val,
    }));
  };

  const handleLineItemChange = (index: number, field: string, val: string) => {
    setContent((prev: any) => {
      const updatedLineItems = [...(prev.lineItems || [])];
      if (!updatedLineItems[index]) {
        updatedLineItems[index] = {
          hawbNo: "",
          shipper: "",
          consignee: "",
          pieces: "",
          grossWeight: "",
          chargeableWeight: "",
          commodity: "",
          destination: ""
        };
      }
      updatedLineItems[index] = {
        ...updatedLineItems[index],
        [field]: val
      };
      return {
        ...prev,
        lineItems: updatedLineItems
      };
    });
  };

  const handleDebitNoteLineItemChange = (index: number, field: string, val: string) => {
    setContent((prev: any) => {
      const updatedLineItems = [...(prev.lineItems || [])];
      if (!updatedLineItems[index]) {
        updatedLineItems[index] = {
          description: "",
          basis: "",
          quantity: "",
          unitRate: "",
          amount: "",
          currency: prev.currency || "USD",
          tax: "",
          total: ""
        };
      }
      updatedLineItems[index] = {
        ...updatedLineItems[index],
        [field]: val
      };

      if (field === "quantity" || field === "unitRate" || field === "amount" || field === "tax") {
        const qty = Number(updatedLineItems[index].quantity) || 0;
        const rate = Number(updatedLineItems[index].unitRate) || 0;
        
        let amt = Number(updatedLineItems[index].amount) || 0;
        if (field === "quantity" || field === "unitRate") {
          amt = qty * rate;
          updatedLineItems[index].amount = String(amt);
        }
        
        const tax = Number(updatedLineItems[index].tax) || 0;
        const rowTotal = amt + tax;
        updatedLineItems[index].total = String(rowTotal);
      }

      let sub = 0;
      let taxTot = 0;
      updatedLineItems.forEach((li: any) => {
        sub += Number(li.amount) || 0;
        taxTot += Number(li.tax) || 0;
      });

      const disc = Number(prev.discount) || 0;
      const grand = sub + taxTot - disc;

      return {
        ...prev,
        lineItems: updatedLineItems,
        subtotal: String(sub),
        taxTotal: String(taxTot),
        grandTotal: String(grand)
      };
    });
  };

  const addDebitNoteLineItem = () => {
    setContent((prev: any) => {
      const updatedLineItems = [...(prev.lineItems || [])];
      updatedLineItems.push({
        description: "",
        basis: "",
        quantity: "1",
        unitRate: "0",
        amount: "0",
        currency: prev.currency || "USD",
        tax: "0",
        total: "0"
      });
      return {
        ...prev,
        lineItems: updatedLineItems
      };
    });
  };

  const deleteDebitNoteLineItem = (index: number) => {
    setContent((prev: any) => {
      const updatedLineItems = (prev.lineItems || []).filter((_: any, idx: number) => idx !== index);
      if (updatedLineItems.length === 0) {
        updatedLineItems.push({
          description: "",
          basis: "",
          quantity: "",
          unitRate: "",
          amount: "",
          currency: prev.currency || "USD",
          tax: "",
          total: ""
        });
      }

      let sub = 0;
      let taxTot = 0;
      updatedLineItems.forEach((li: any) => {
        sub += Number(li.amount) || 0;
        taxTot += Number(li.tax) || 0;
      });

      const disc = Number(prev.discount) || 0;
      const grand = sub + taxTot - disc;

      return {
        ...prev,
        lineItems: updatedLineItems,
        subtotal: String(sub),
        taxTotal: String(taxTot),
        grandTotal: String(grand)
      };
    });
  };

  const handleDebitNoteDiscountChange = (discVal: string) => {
    setContent((prev: any) => {
      const disc = Number(discVal) || 0;
      const sub = Number(prev.subtotal) || 0;
      const taxTot = Number(prev.taxTotal) || 0;
      const grand = sub + taxTot - disc;
      return {
        ...prev,
        discount: discVal,
        grandTotal: String(grand)
      };
    });
  };

  const contentPayload = (isHbl || isHawb || isManifest || isDebitNote) ? {
    documentType: document.type === "MANIFEST" ? "AIR_CARGO_MANIFEST" : document.type === "DEBIT_NOTE" ? "CUSTOMER_DEBIT_NOTE" : document.type,
    responsibility: document.responsibility || "FORWARDER_GENERATED",
    handlingMode: document.handlingMode || "GENERATE_IN_SYSTEM",
    visibility: document.visibility || "CLIENT_SAFE",
    clientFields: content,
    internalFields: initialContent.internalFields || {
      generatedFromShipmentId: document.shipmentJobId,
      sourceSnapshotAt: new Date().toISOString()
    }
  } : content;


  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-900">{document.documentNo}</h2>
            <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${
              document.status === "LOCKED" ? "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/10" :
              document.status === "APPROVED" ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/10" :
              document.status === "UNDER_REVIEW" ? "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/10" :
              "bg-slate-50 text-slate-700 ring-1 ring-inset ring-slate-600/10"
            }`}>
              {document.status}
            </span>
            <span className="text-sm text-slate-500 font-medium">v{version?.versionNumber || 1}</span>
          </div>
          <p className="text-xs text-slate-400">Linked to Shipment: {document.shipmentJob?.jobNo}</p>
          <p className="text-xs text-slate-500">
            Once locked, document fields stay read-only until an amendment is started. Portal-visible freight documents can be shared with the client, while internal records remain backoffice-only.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {!isLocked && (
            <form action={formAction} className="inline-flex gap-2">
              <input type="hidden" name="documentId" value={document.id} />
              <input type="hidden" name="content" value={JSON.stringify(contentPayload)} />
              <input type="hidden" name="remarks" value={remarks} />
              <Button type="submit" disabled={pending} className="bg-emerald-600 hover:bg-emerald-700 text-white h-9">
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            </form>
          )}

          {document.status === "DRAFT" && (
            <form
              action={async (formData) => {
                await submitAction(formData);
              }}
              className="inline-block"
            >
              <input type="hidden" name="documentId" value={document.id} />
              <Button type="submit" variant="outline" className="h-9">
                Submit for Review
              </Button>
            </form>
          )}

          {(document.status === "UNDER_REVIEW" || document.status === "APPROVED") && (
            <div className="inline-flex gap-2">
              {document.status === "UNDER_REVIEW" && isAdminOrManager && (
                <form
                  action={async (formData) => {
                    await approveAction(formData);
                  }}
                  className="inline-block"
                >
                  <input type="hidden" name="documentId" value={document.id} />
                  <input type="hidden" name="remarks" value="Approved internally" />
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white h-9">
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Approve Draft
                  </Button>
                </form>
              )}

              <form
                action={async (formData) => {
                  const confirmed = window.confirm("Reject document and return it to DRAFT state?");
                  if (confirmed) {
                    await rejectAction(formData);
                  }
                }}
                className="inline-block"
              >
                <input type="hidden" name="documentId" value={document.id} />
                <input type="hidden" name="remarks" value="Returned to draft" />
                <Button type="submit" variant="destructive" className="h-9">
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject & Revert to Draft
                </Button>
              </form>
            </div>
          )}

          {(document.status === "APPROVED" || document.status === "UNDER_REVIEW" || document.status === "DRAFT") && isAdminOrManager && (
            <form
              action={async (formData) => {
                await lockAction(formData);
              }}
              className="inline-block"
            >
              <input type="hidden" name="documentId" value={document.id} />
              <Button type="submit" className="bg-red-600 hover:bg-red-700 text-white h-9">
                <Lock className="h-4 w-4 mr-2" />
                Final Lock Document
              </Button>
            </form>
          )}

          {document.status === "LOCKED" && (
            <form
              action={async (formData) => {
                await amendAction(formData);
              }}
              className="inline-block"
            >
              <input type="hidden" name="documentId" value={document.id} />
              <input type="hidden" name="remarks" value="Created amendment version" />
              <Button type="submit" variant="outline" className="h-9 gap-1.5 border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800">
                <Unlock className="h-4 w-4" />
                Trigger Amendment
              </Button>
            </form>
          )}
        </div>
      </div>

      <Alert state={state} />

      {/* Editor Body */}
      <div className="grid gap-6 xl:grid-cols-2">
        {/* Input Forms */}
        {isHbl ? (
          <Card className="p-5 space-y-5 bg-white border border-slate-200">
            <div className="flex justify-between items-center border-b pb-3 border-slate-100">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">House Bill of Lading inputs</h3>
              <span className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                System Generated
              </span>
            </div>

            {/* Document Numbers */}
            <div className="grid gap-4 md:grid-cols-3 rounded-lg border border-slate-100 bg-slate-50/50 p-4">
              <div className="space-y-1">
                <Label htmlFor="hblNo">HBL No</Label>
                <Input
                  id="hblNo"
                  value={content.hblNo}
                  onChange={(e) => handleRootChange("hblNo", e.target.value)}
                  disabled={true}
                  className="h-9 text-xs bg-slate-100 font-mono font-semibold"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="mblNo">MBL No Reference</Label>
                <Input
                  id="mblNo"
                  value={content.mblNo}
                  onChange={(e) => handleRootChange("mblNo", e.target.value)}
                  disabled={isLocked}
                  className="h-9 text-xs bg-white"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="shipmentJobNo">Shipment Job No</Label>
                <Input
                  id="shipmentJobNo"
                  value={content.shipmentJobNo}
                  onChange={(e) => handleRootChange("shipmentJobNo", e.target.value)}
                  disabled={isLocked}
                  className="h-9 text-xs bg-white"
                />
              </div>
            </div>

            {/* Key Parties */}
            <div className="space-y-4 rounded-lg border border-slate-100 bg-slate-50/50 p-4">
              <h4 className="font-semibold text-slate-800 text-sm">Key Parties</h4>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="shipper">Shipper (Name & Address)</Label>
                  <textarea
                    id="shipper"
                    value={content.shipper}
                    onChange={(e) => handleRootChange("shipper", e.target.value)}
                    disabled={isLocked}
                    rows={3}
                    className="w-full rounded-md border border-slate-200 bg-white p-2 text-xs focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="consignee">Consignee (Name & Address)</Label>
                  <textarea
                    id="consignee"
                    value={content.consignee}
                    onChange={(e) => handleRootChange("consignee", e.target.value)}
                    disabled={isLocked}
                    rows={3}
                    className="w-full rounded-md border border-slate-200 bg-white p-2 text-xs focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="notifyParty">Notify Party (Name & Address)</Label>
                  <textarea
                    id="notifyParty"
                    value={content.notifyParty}
                    onChange={(e) => handleRootChange("notifyParty", e.target.value)}
                    disabled={isLocked}
                    rows={3}
                    className="w-full rounded-md border border-slate-200 bg-white p-2 text-xs focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Carrier & Routing */}
            <div className="space-y-4 rounded-lg border border-slate-100 bg-slate-50/50 p-4">
              <h4 className="font-semibold text-slate-800 text-sm">Carrier & Routing</h4>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2 space-y-2 border-b border-slate-100 pb-3">
                  <Label className="text-xs font-semibold text-slate-700">Does this shipment require Transshipment (Indirect routing)?</Label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium">
                      <input
                        type="radio"
                        name="hblIsTransshipment"
                        value="yes"
                        checked={content.isTransshipment === "yes"}
                        onChange={() => handleRootChange("isTransshipment", "yes")}
                        disabled={isLocked}
                        className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-slate-300"
                      />
                      Yes
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium">
                      <input
                        type="radio"
                        name="hblIsTransshipment"
                        value="no"
                        checked={content.isTransshipment !== "yes"}
                        onChange={() => handleRootChange("isTransshipment", "no")}
                        disabled={isLocked}
                        className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-slate-300"
                      />
                      No
                    </label>
                  </div>
                </div>

                {content.isTransshipment === "yes" && (
                  <div className="md:col-span-2 space-y-3 rounded-lg border border-slate-200 bg-white p-3">
                    <div className="flex items-center justify-between border-b pb-2">
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Transshipment Legs</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isLocked}
                        className="h-7 text-xs border-emerald-500 text-emerald-600 hover:bg-emerald-50"
                        onClick={() => {
                          const newLegs = [...(content.transshipmentLegs || []), { vessel: "", voyage: "", viaPort: "" }];
                          setContent((prev: any) => ({ ...prev, transshipmentLegs: newLegs }));
                        }}
                      >
                        + Add Transit Leg
                      </Button>
                    </div>

                    {(!content.transshipmentLegs || content.transshipmentLegs.length === 0) ? (
                      <p className="text-xs text-slate-400 italic py-2">No transit legs added. Click 'Add Transit Leg' to specify routing details.</p>
                    ) : (
                      <div className="space-y-3 divide-y divide-slate-100">
                        {content.transshipmentLegs.map((leg: any, index: number) => (
                          <div key={index} className={`grid gap-3 pt-3 first:pt-0 ${index > 0 ? "border-t border-slate-100" : ""}`}>
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-500">Leg #{index + 1}</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={isLocked}
                                className="h-6 px-2 text-[10px] text-red-500 hover:bg-red-50"
                                onClick={() => {
                                  const newLegs = content.transshipmentLegs.filter((_: any, idx: number) => idx !== index);
                                  setContent((prev: any) => ({ ...prev, transshipmentLegs: newLegs }));
                                }}
                              >
                                Remove
                              </Button>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-3">
                              <div className="space-y-1">
                                <Label className="text-[10px]">Vessel Name</Label>
                                <Input
                                  value={leg.vessel || ""}
                                  disabled={isLocked}
                                  className="h-8 text-xs bg-white"
                                  placeholder="e.g. MV HR RHEA"
                                  onChange={(e) => {
                                    const newLegs = [...content.transshipmentLegs];
                                    newLegs[index] = { ...newLegs[index], vessel: e.target.value };
                                    setContent((prev: any) => ({ ...prev, transshipmentLegs: newLegs }));
                                  }}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px]">Voyage No</Label>
                                <Input
                                  value={leg.voyage || ""}
                                  disabled={isLocked}
                                  className="h-8 text-xs bg-white"
                                  placeholder="e.g. 045E"
                                  onChange={(e) => {
                                    const newLegs = [...content.transshipmentLegs];
                                    newLegs[index] = { ...newLegs[index], voyage: e.target.value };
                                    setContent((prev: any) => ({ ...prev, transshipmentLegs: newLegs }));
                                  }}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px]">Transshipment Port (Via)</Label>
                                <Input
                                  value={leg.viaPort || ""}
                                  disabled={isLocked}
                                  className="h-8 text-xs bg-white"
                                  placeholder="e.g. Singapore"
                                  onChange={(e) => {
                                    const newLegs = [...content.transshipmentLegs];
                                    newLegs[index] = { ...newLegs[index], viaPort: e.target.value };
                                    setContent((prev: any) => ({ ...prev, transshipmentLegs: newLegs }));
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div className="space-y-1">
                  <Label htmlFor="vessel">Vessel Name</Label>
                  <Input
                    id="vessel"
                    value={content.vessel}
                    onChange={(e) => handleRootChange("vessel", e.target.value)}
                    disabled={isLocked}
                    className="h-9 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="voyage">Voyage No</Label>
                  <Input
                    id="voyage"
                    value={content.voyage}
                    onChange={(e) => handleRootChange("voyage", e.target.value)}
                    disabled={isLocked}
                    className="h-9 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="placeOfReceipt">Place of Receipt</Label>
                  <Input
                    id="placeOfReceipt"
                    value={content.placeOfReceipt}
                    onChange={(e) => handleRootChange("placeOfReceipt", e.target.value)}
                    disabled={isLocked}
                    className="h-9 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="portOfLoading">Port of Loading</Label>
                  <Input
                    id="portOfLoading"
                    value={content.portOfLoading}
                    onChange={(e) => handleRootChange("portOfLoading", e.target.value)}
                    disabled={isLocked}
                    className="h-9 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="portOfDischarge">Port of Discharge</Label>
                  <Input
                    id="portOfDischarge"
                    value={content.portOfDischarge}
                    onChange={(e) => handleRootChange("portOfDischarge", e.target.value)}
                    disabled={isLocked}
                    className="h-9 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="placeOfDelivery">Place of Delivery</Label>
                  <Input
                    id="placeOfDelivery"
                    value={content.placeOfDelivery}
                    onChange={(e) => handleRootChange("placeOfDelivery", e.target.value)}
                    disabled={isLocked}
                    className="h-9 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label htmlFor="finalDestination">Final Destination</Label>
                  <Input
                    id="finalDestination"
                    value={content.finalDestination}
                    onChange={(e) => handleRootChange("finalDestination", e.target.value)}
                    disabled={isLocked}
                    className="h-9 text-xs bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Cargo Details */}
            <div className="space-y-4 rounded-lg border border-slate-100 bg-slate-50/50 p-4">
              <h4 className="font-semibold text-slate-800 text-sm">Cargo & Container Details</h4>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="containerNo">Container Numbers</Label>
                  <Input
                    id="containerNo"
                    value={content.containerNo}
                    onChange={(e) => handleRootChange("containerNo", e.target.value)}
                    disabled={isLocked}
                    className="h-9 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="sealNo">Seal Numbers</Label>
                  <Input
                    id="sealNo"
                    value={content.sealNo}
                    onChange={(e) => handleRootChange("sealNo", e.target.value)}
                    disabled={isLocked}
                    className="h-9 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label htmlFor="marksAndNumbers">Marks & Numbers</Label>
                  <Input
                    id="marksAndNumbers"
                    value={content.marksAndNumbers}
                    onChange={(e) => handleRootChange("marksAndNumbers", e.target.value)}
                    disabled={isLocked}
                    className="h-9 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label htmlFor="packages">Number & Kind of Packages</Label>
                  <Input
                    id="packages"
                    value={content.packages}
                    onChange={(e) => handleRootChange("packages", e.target.value)}
                    disabled={isLocked}
                    className="h-9 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label htmlFor="goodsDescription">Description of Goods</Label>
                  <textarea
                    id="goodsDescription"
                    value={content.goodsDescription}
                    onChange={(e) => handleRootChange("goodsDescription", e.target.value)}
                    disabled={isLocked}
                    rows={4}
                    className="w-full rounded-md border border-slate-200 bg-white p-2 text-xs focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="hsCode">HS Code</Label>
                  <Input
                    id="hsCode"
                    value={content.hsCode}
                    onChange={(e) => handleRootChange("hsCode", e.target.value)}
                    disabled={isLocked}
                    className="h-9 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="grossWeight">Gross Weight</Label>
                  <Input
                    id="grossWeight"
                    value={content.grossWeight}
                    onChange={(e) => handleRootChange("grossWeight", e.target.value)}
                    disabled={isLocked}
                    className="h-9 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="measurement">Measurement (Volume)</Label>
                  <Input
                    id="measurement"
                    value={content.measurement}
                    onChange={(e) => handleRootChange("measurement", e.target.value)}
                    disabled={isLocked}
                    className="h-9 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="freightTerm">Freight Term</Label>
                  <select
                    id="freightTerm"
                    value={content.freightTerm}
                    onChange={(e) => handleRootChange("freightTerm", e.target.value)}
                    disabled={isLocked}
                    className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs"
                  >
                    <option value="PREPAID">PREPAID</option>
                    <option value="COLLECT">COLLECT</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Footer details */}
            <div className="space-y-4 rounded-lg border border-slate-100 bg-slate-50/50 p-4">
              <h4 className="font-semibold text-slate-800 text-sm">Issue & Release Details</h4>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="originalBlCount">Number of Original BLs</Label>
                  <Input
                    id="originalBlCount"
                    value={content.originalBlCount}
                    onChange={(e) => handleRootChange("originalBlCount", e.target.value)}
                    disabled={isLocked}
                    className="h-9 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="onBoardDate">On Board Date</Label>
                  <Input
                    id="onBoardDate"
                    type="date"
                    value={content.onBoardDate}
                    onChange={(e) => handleRootChange("onBoardDate", e.target.value)}
                    disabled={isLocked}
                    className="h-9 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="issuePlace">Place of Issue</Label>
                  <Input
                    id="issuePlace"
                    value={content.issuePlace}
                    onChange={(e) => handleRootChange("issuePlace", e.target.value)}
                    disabled={isLocked}
                    className="h-9 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="issueDate">Date of Issue</Label>
                  <Input
                    id="issueDate"
                    type="date"
                    value={content.issueDate}
                    onChange={(e) => handleRootChange("issueDate", e.target.value)}
                    disabled={isLocked}
                    className="h-9 text-xs bg-white"
                  />
                </div>
              </div>
            </div>

            {!isLocked && (
              <div className="space-y-1">
                <Label htmlFor="changeRemarks">Change Version Remarks (optional)</Label>
                <Input
                  id="changeRemarks"
                  placeholder="Enter version change description..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            )}
          </Card>
        ) : isHawb ? (
          <Card className="p-5 space-y-5 bg-white border border-slate-200">
            <div className="flex justify-between items-center border-b pb-3 border-slate-100">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">House Air Waybill inputs</h3>
              <span className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                System Generated
              </span>
            </div>

            {/* Document Numbers */}
            <div className="grid gap-4 md:grid-cols-3 rounded-lg border border-slate-100 bg-slate-50/50 p-4">
              <div className="space-y-1">
                <Label htmlFor="hawbNo">HAWB No</Label>
                <Input
                  id="hawbNo"
                  value={content.hawbNo}
                  onChange={(e) => handleRootChange("hawbNo", e.target.value)}
                  disabled={true}
                  className="h-9 text-xs bg-slate-100 font-mono font-semibold"
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="mawbNo">MAWB No Reference</Label>
                  <span className="text-[9px] text-slate-400 font-medium">Read-only MAWB</span>
                </div>
                <Input
                  id="mawbNo"
                  placeholder="e.g. 020-12345678"
                  value={content.mawbNo}
                  onChange={(e) => handleRootChange("mawbNo", e.target.value)}
                  disabled={isLocked}
                  className="h-9 text-xs bg-white"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="shipmentJobNo">Shipment Job No</Label>
                <Input
                  id="shipmentJobNo"
                  value={content.shipmentJobNo}
                  onChange={(e) => handleRootChange("shipmentJobNo", e.target.value)}
                  disabled={isLocked}
                  className="h-9 text-xs bg-white"
                />
              </div>
            </div>

            {/* Key Parties */}
            <div className="space-y-4 rounded-lg border border-slate-100 bg-slate-50/50 p-4">
              <h4 className="font-semibold text-slate-800 text-sm">Key Parties</h4>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="shipper">Shipper (Name & Address)</Label>
                  <textarea
                    id="shipper"
                    value={content.shipper}
                    onChange={(e) => handleRootChange("shipper", e.target.value)}
                    disabled={isLocked}
                    rows={3}
                    className="w-full rounded-md border border-slate-200 bg-white p-2 text-xs focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="consignee">Consignee (Name & Address)</Label>
                  <textarea
                    id="consignee"
                    value={content.consignee}
                    onChange={(e) => handleRootChange("consignee", e.target.value)}
                    disabled={isLocked}
                    rows={3}
                    className="w-full rounded-md border border-slate-200 bg-white p-2 text-xs focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="notifyParty">Notify Party (Name & Address)</Label>
                  <textarea
                    id="notifyParty"
                    value={content.notifyParty}
                    onChange={(e) => handleRootChange("notifyParty", e.target.value)}
                    disabled={isLocked}
                    rows={3}
                    className="w-full rounded-md border border-slate-200 bg-white p-2 text-xs focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Airline & Routing */}
            <div className="space-y-4 rounded-lg border border-slate-100 bg-slate-50/50 p-4">
              <h4 className="font-semibold text-slate-800 text-sm">Airline & Routing</h4>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="airportOfDeparture">Airport of Departure</Label>
                  <Input
                    id="airportOfDeparture"
                    value={content.airportOfDeparture}
                    onChange={(e) => handleRootChange("airportOfDeparture", e.target.value)}
                    disabled={isLocked}
                    className="h-9 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="airportOfDestination">Airport of Destination</Label>
                  <Input
                    id="airportOfDestination"
                    value={content.airportOfDestination}
                    onChange={(e) => handleRootChange("airportOfDestination", e.target.value)}
                    disabled={isLocked}
                    className="h-9 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="requestedRouting">Requested Routing</Label>
                  <Input
                    id="requestedRouting"
                    value={content.requestedRouting}
                    onChange={(e) => handleRootChange("requestedRouting", e.target.value)}
                    disabled={isLocked}
                    className="h-9 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="flightNo">Flight No</Label>
                  <Input
                    id="flightNo"
                    value={content.flightNo}
                    onChange={(e) => handleRootChange("flightNo", e.target.value)}
                    disabled={isLocked}
                    className="h-9 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="flightDate">Flight Date</Label>
                  <Input
                    id="flightDate"
                    type="date"
                    value={content.flightDate}
                    onChange={(e) => handleRootChange("flightDate", e.target.value)}
                    disabled={isLocked}
                    className="h-9 text-xs bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Cargo Details */}
            <div className="space-y-4 rounded-lg border border-slate-100 bg-slate-50/50 p-4">
              <h4 className="font-semibold text-slate-800 text-sm">Cargo details</h4>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="pieces">No. of Pieces</Label>
                  <Input
                    id="pieces"
                    value={content.pieces}
                    onChange={(e) => handleRootChange("pieces", e.target.value)}
                    disabled={isLocked}
                    className="h-9 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="grossWeight">Gross Weight</Label>
                  <Input
                    id="grossWeight"
                    value={content.grossWeight}
                    onChange={(e) => handleRootChange("grossWeight", e.target.value)}
                    disabled={isLocked}
                    className="h-9 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="chargeableWeight">Chargeable Weight</Label>
                  <Input
                    id="chargeableWeight"
                    value={content.chargeableWeight}
                    onChange={(e) => handleRootChange("chargeableWeight", e.target.value)}
                    disabled={isLocked}
                    className="h-9 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="dimensions">Dimensions</Label>
                  <Input
                    id="dimensions"
                    value={content.dimensions}
                    onChange={(e) => handleRootChange("dimensions", e.target.value)}
                    disabled={isLocked}
                    className="h-9 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label htmlFor="commodity">Commodity / Nature of Goods</Label>
                  <textarea
                    id="commodity"
                    value={content.commodity}
                    onChange={(e) => handleRootChange("commodity", e.target.value)}
                    disabled={isLocked}
                    rows={3}
                    className="w-full rounded-md border border-slate-200 bg-white p-2 text-xs focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label htmlFor="handlingInformation">Handling Information</Label>
                  <textarea
                    id="handlingInformation"
                    value={content.handlingInformation}
                    onChange={(e) => handleRootChange("handlingInformation", e.target.value)}
                    disabled={isLocked}
                    rows={2}
                    className="w-full rounded-md border border-slate-200 bg-white p-2 text-xs focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="declaredValueForCarriage">Declared Value for Carriage</Label>
                  <Input
                    id="declaredValueForCarriage"
                    value={content.declaredValueForCarriage}
                    onChange={(e) => handleRootChange("declaredValueForCarriage", e.target.value)}
                    disabled={isLocked}
                    className="h-9 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="declaredValueForCustoms">Declared Value for Customs</Label>
                  <Input
                    id="declaredValueForCustoms"
                    value={content.declaredValueForCustoms}
                    onChange={(e) => handleRootChange("declaredValueForCustoms", e.target.value)}
                    disabled={isLocked}
                    className="h-9 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="freightTerm">Freight Term</Label>
                  <select
                    id="freightTerm"
                    value={content.freightTerm}
                    onChange={(e) => handleRootChange("freightTerm", e.target.value)}
                    disabled={isLocked}
                    className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs"
                  >
                    <option value="PREPAID">PREPAID</option>
                    <option value="COLLECT">COLLECT</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Issue Details */}
            <div className="space-y-4 rounded-lg border border-slate-100 bg-slate-50/50 p-4">
              <h4 className="font-semibold text-slate-800 text-sm">Issue details</h4>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="issuePlace">Place of Issue</Label>
                  <Input
                    id="issuePlace"
                    value={content.issuePlace}
                    onChange={(e) => handleRootChange("issuePlace", e.target.value)}
                    disabled={isLocked}
                    className="h-9 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="issueDate">Date of Issue</Label>
                  <Input
                    id="issueDate"
                    type="date"
                    value={content.issueDate}
                    onChange={(e) => handleRootChange("issueDate", e.target.value)}
                    disabled={isLocked}
                    className="h-9 text-xs bg-white"
                  />
                </div>
              </div>
            </div>

            {!isLocked && (
              <div className="space-y-1">
                <Label htmlFor="changeRemarks">Change Version Remarks (optional)</Label>
                <Input
                  id="changeRemarks"
                  placeholder="Enter version change description..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            )}
          </Card>
        ) : isManifest ? (
          <Card className="p-5 space-y-5 bg-white border border-slate-200">
            <div className="flex justify-between items-center border-b pb-3 border-slate-100">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">
                {content.manifestType === "SEA" ? "Sea Cargo Manifest inputs" : "Air Cargo Manifest inputs"}
              </h3>
              <span className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                System Generated
              </span>
            </div>

            {/* Manifest Type Selection Choice List */}
            <div className="grid gap-4 md:grid-cols-2 rounded-lg border border-slate-100 bg-slate-50/50 p-4">
              <div className="space-y-1">
                <Label htmlFor="manifestType" className="font-semibold text-emerald-800">Manifest Transport Mode Type</Label>
                <select
                  id="manifestType"
                  value={content.manifestType || "AIR"}
                  onChange={(e) => handleRootChange("manifestType", e.target.value)}
                  disabled={isLocked}
                  className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-800 focus:border-emerald-500 focus:outline-none"
                >
                  <option value="AIR">Air Cargo Manifest</option>
                  <option value="SEA">Sea Cargo Manifest</option>
                </select>
              </div>
            </div>

            {/* Document Numbers / Header */}
            <div className="grid gap-4 md:grid-cols-3 rounded-lg border border-slate-100 bg-slate-50/50 p-4">
              <div className="space-y-1">
                <Label htmlFor="manifestNo">Manifest No</Label>
                <Input
                  id="manifestNo"
                  value={content.manifestNo}
                  onChange={(e) => handleRootChange("manifestNo", e.target.value)}
                  disabled={true}
                  className="h-9 text-xs bg-slate-100 font-mono font-semibold"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="manifestDate">Manifest Date</Label>
                <Input
                  id="manifestDate"
                  type="date"
                  value={content.manifestDate}
                  onChange={(e) => handleRootChange("manifestDate", e.target.value)}
                  disabled={isLocked}
                  className="h-9 text-xs bg-white"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="shipmentJobNo">Shipment Job No</Label>
                <Input
                  id="shipmentJobNo"
                  value={content.shipmentJobNo}
                  onChange={(e) => handleRootChange("shipmentJobNo", e.target.value)}
                  disabled={isLocked}
                  className="h-9 text-xs bg-white"
                />
              </div>
              {content.manifestType === "SEA" ? (
                <>
                  <div className="space-y-1">
                    <Label htmlFor="mblNo">MBL No Reference</Label>
                    <Input
                      id="mblNo"
                      placeholder="e.g. MSK123456789"
                      value={content.mblNo}
                      onChange={(e) => handleRootChange("mblNo", e.target.value)}
                      disabled={isLocked}
                      className="h-9 text-xs bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="hblNo">HBL No Reference</Label>
                    <Input
                      id="hblNo"
                      placeholder="e.g. HBL12345"
                      value={content.hblNo}
                      onChange={(e) => handleRootChange("hblNo", e.target.value)}
                      disabled={isLocked}
                      className="h-9 text-xs bg-white"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1">
                    <Label htmlFor="mawbNo">MAWB No Reference</Label>
                    <Input
                      id="mawbNo"
                      placeholder="e.g. 020-12345678"
                      value={content.mawbNo}
                      onChange={(e) => handleRootChange("mawbNo", e.target.value)}
                      disabled={isLocked}
                      className="h-9 text-xs bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="hawbNo">HAWB No Reference</Label>
                    <Input
                      id="hawbNo"
                      value={content.hawbNo}
                      onChange={(e) => handleRootChange("hawbNo", e.target.value)}
                      disabled={isLocked}
                      className="h-9 text-xs bg-white"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Key Parties */}
            <div className="space-y-4 rounded-lg border border-slate-100 bg-slate-50/50 p-4">
              <h4 className="font-semibold text-slate-800 text-sm">Key Parties</h4>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="shipper">Shipper (Name & Address)</Label>
                  <textarea
                    id="shipper"
                    value={content.shipper}
                    onChange={(e) => handleRootChange("shipper", e.target.value)}
                    disabled={isLocked}
                    rows={3}
                    className="w-full rounded-md border border-slate-200 bg-white p-2 text-xs focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="consignee">Consignee (Name & Address)</Label>
                  <textarea
                    id="consignee"
                    value={content.consignee}
                    onChange={(e) => handleRootChange("consignee", e.target.value)}
                    disabled={isLocked}
                    rows={3}
                    className="w-full rounded-md border border-slate-200 bg-white p-2 text-xs focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="notifyParty">Notify Party (Name & Address)</Label>
                  <textarea
                    id="notifyParty"
                    value={content.notifyParty}
                    onChange={(e) => handleRootChange("notifyParty", e.target.value)}
                    disabled={isLocked}
                    rows={3}
                    className="w-full rounded-md border border-slate-200 bg-white p-2 text-xs focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Carrier & Routing */}
            {content.manifestType === "SEA" ? (
              <div className="space-y-4 rounded-lg border border-slate-100 bg-slate-50/50 p-4">
                <h4 className="font-semibold text-slate-800 text-sm">Vessel & Routing (Ocean Freight)</h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="vesselName">Vessel Name</Label>
                    <Input
                      id="vesselName"
                      value={content.vesselName}
                      onChange={(e) => handleRootChange("vesselName", e.target.value)}
                      disabled={isLocked}
                      className="h-9 text-xs bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="voyageNo">Voyage No</Label>
                    <Input
                      id="voyageNo"
                      value={content.voyageNo}
                      onChange={(e) => handleRootChange("voyageNo", e.target.value)}
                      disabled={isLocked}
                      className="h-9 text-xs bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="onBoardDate">Laden On Board Date</Label>
                    <Input
                      id="onBoardDate"
                      type="date"
                      value={content.onBoardDate}
                      onChange={(e) => handleRootChange("onBoardDate", e.target.value)}
                      disabled={isLocked}
                      className="h-9 text-xs bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="portOfLoading">Port of Loading</Label>
                    <Input
                      id="portOfLoading"
                      value={content.portOfLoading}
                      onChange={(e) => handleRootChange("portOfLoading", e.target.value)}
                      disabled={isLocked}
                      className="h-9 text-xs bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="portOfDischarge">Port of Discharge</Label>
                    <Input
                      id="portOfDischarge"
                      value={content.portOfDischarge}
                      onChange={(e) => handleRootChange("portOfDischarge", e.target.value)}
                      disabled={isLocked}
                      className="h-9 text-xs bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="originCountry">Origin Country</Label>
                    <Input
                      id="originCountry"
                      value={content.originCountry}
                      onChange={(e) => handleRootChange("originCountry", e.target.value)}
                      disabled={isLocked}
                      className="h-9 text-xs bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="destinationCountry">Destination Country</Label>
                    <Input
                      id="destinationCountry"
                      value={content.destinationCountry}
                      onChange={(e) => handleRootChange("destinationCountry", e.target.value)}
                      disabled={isLocked}
                      className="h-9 text-xs bg-white"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 rounded-lg border border-slate-100 bg-slate-50/50 p-4">
                <h4 className="font-semibold text-slate-800 text-sm">Airline & Routing (Air Freight)</h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="airline">Airline / Carrier</Label>
                    <Input
                      id="airline"
                      value={content.airline}
                      onChange={(e) => handleRootChange("airline", e.target.value)}
                      disabled={isLocked}
                      className="h-9 text-xs bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="flightNo">Flight No</Label>
                    <Input
                      id="flightNo"
                      value={content.flightNo}
                      onChange={(e) => handleRootChange("flightNo", e.target.value)}
                      disabled={isLocked}
                      className="h-9 text-xs bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="flightDate">Flight Date</Label>
                    <Input
                      id="flightDate"
                      type="date"
                      value={content.flightDate}
                      onChange={(e) => handleRootChange("flightDate", e.target.value)}
                      disabled={isLocked}
                      className="h-9 text-xs bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="airportOfDeparture">Airport of Departure</Label>
                    <Input
                      id="airportOfDeparture"
                      value={content.airportOfDeparture}
                      onChange={(e) => handleRootChange("airportOfDeparture", e.target.value)}
                      disabled={isLocked}
                      className="h-9 text-xs bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="airportOfDestination">Airport of Destination</Label>
                    <Input
                      id="airportOfDestination"
                      value={content.airportOfDestination}
                      onChange={(e) => handleRootChange("airportOfDestination", e.target.value)}
                      disabled={isLocked}
                      className="h-9 text-xs bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="originCountry">Origin Country</Label>
                    <Input
                      id="originCountry"
                      value={content.originCountry}
                      onChange={(e) => handleRootChange("originCountry", e.target.value)}
                      disabled={isLocked}
                      className="h-9 text-xs bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="destinationCountry">Destination Country</Label>
                    <Input
                      id="destinationCountry"
                      value={content.destinationCountry}
                      onChange={(e) => handleRootChange("destinationCountry", e.target.value)}
                      disabled={isLocked}
                      className="h-9 text-xs bg-white"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Cargo details */}
            <div className="space-y-4 rounded-lg border border-slate-100 bg-slate-50/50 p-4">
              <h4 className="font-semibold text-slate-800 text-sm">Cargo Summary</h4>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="totalPieces">Total Pieces</Label>
                  <Input
                    id="totalPieces"
                    value={content.totalPieces}
                    onChange={(e) => handleRootChange("totalPieces", e.target.value)}
                    disabled={isLocked}
                    className="h-9 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="grossWeight">Gross Weight</Label>
                  <Input
                    id="grossWeight"
                    value={content.grossWeight}
                    onChange={(e) => handleRootChange("grossWeight", e.target.value)}
                    disabled={isLocked}
                    className="h-9 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="chargeableWeight">Chargeable Weight</Label>
                  <Input
                    id="chargeableWeight"
                    value={content.chargeableWeight}
                    onChange={(e) => handleRootChange("chargeableWeight", e.target.value)}
                    disabled={isLocked}
                    className="h-9 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="dimensions">Dimensions</Label>
                  <Input
                    id="dimensions"
                    value={content.dimensions}
                    onChange={(e) => handleRootChange("dimensions", e.target.value)}
                    disabled={isLocked}
                    className="h-9 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label htmlFor="commodity">Commodity / Nature of Goods</Label>
                  <textarea
                    id="commodity"
                    value={content.commodity}
                    onChange={(e) => handleRootChange("commodity", e.target.value)}
                    disabled={isLocked}
                    rows={2}
                    className="w-full rounded-md border border-slate-200 bg-white p-2 text-xs focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="hsCode">HS Code</Label>
                  <Input
                    id="hsCode"
                    value={content.hsCode}
                    onChange={(e) => handleRootChange("hsCode", e.target.value)}
                    disabled={isLocked}
                    className="h-9 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label htmlFor="marksAndNumbers">Marks & Numbers</Label>
                  <textarea
                    id="marksAndNumbers"
                    value={content.marksAndNumbers}
                    onChange={(e) => handleRootChange("marksAndNumbers", e.target.value)}
                    disabled={isLocked}
                    rows={2}
                    className="w-full rounded-md border border-slate-200 bg-white p-2 text-xs focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label htmlFor="specialHandlingInformation">Special Handling Information</Label>
                  <textarea
                    id="specialHandlingInformation"
                    value={content.specialHandlingInformation}
                    onChange={(e) => handleRootChange("specialHandlingInformation", e.target.value)}
                    disabled={isLocked}
                    rows={2}
                    className="w-full rounded-md border border-slate-200 bg-white p-2 text-xs focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label htmlFor="remarks">Remarks</Label>
                  <textarea
                    id="remarks"
                    value={content.remarks}
                    onChange={(e) => handleRootChange("remarks", e.target.value)}
                    disabled={isLocked}
                    rows={2}
                    className="w-full rounded-md border border-slate-200 bg-white p-2 text-xs focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Line Items Section */}
            <div className="space-y-4 rounded-lg border border-slate-100 bg-slate-50/50 p-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-slate-800 text-sm">Manifest Line Items (Consolidation)</h4>
                {!isLocked && siblingDocs.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const isSea = content.manifestType === "SEA";
                      const relevantDocs = siblingDocs.filter((d) =>
                        isSea ? d.type === "HBL" : d.type === "HAWB"
                      );
                      if (relevantDocs.length === 0) return;
                      // Rebuild line items from current sibling docs
                      const newLineItems = relevantDocs.map((d) => {
                        const cf = (d.versions?.[0]?.content as any)?.clientFields || {};
                        const piecesValue = cf.pieces || cf.packages || "";
                        const commodityValue = cf.goodsDescription || cf.commodity || "";
                        return {
                          hawbNo: isSea ? "" : d.documentNo,
                          hblNo: isSea ? d.documentNo : "",
                          shipper: cf.shipper ? cf.shipper.split("\n")[0] : "",
                          consignee: cf.consignee ? cf.consignee.split("\n")[0] : "",
                          pieces: piecesValue,
                          grossWeight: cf.grossWeight || "",
                          chargeableWeight: cf.chargeableWeight || "",
                          commodity: commodityValue,
                          destination: isSea
                            ? (cf.portOfDischarge || "")
                            : (cf.airportOfDestination || "")
                        };
                      });
                      // Also update the primary reference number in header
                      const primaryRef = relevantDocs[0]?.documentNo || "";
                      setContent((prev: any) => ({
                        ...prev,
                        hblNo: isSea ? primaryRef : prev.hblNo,
                        hawbNo: isSea ? prev.hawbNo : primaryRef,
                        lineItems: newLineItems
                      }));
                    }}
                    className="flex items-center gap-1.5 rounded-md bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                    </svg>
                    Sync from {content.manifestType === "SEA" ? "HBL" : "HAWB"} docs ({siblingDocs.filter(d => content.manifestType === "SEA" ? d.type === "HBL" : d.type === "HAWB").length} found)
                  </button>
                )}
              </div>
              {siblingDocs.length > 0 && (
                <div className="text-xs text-slate-500 flex flex-wrap gap-1.5">
                  <span className="font-medium text-slate-600">Available:</span>
                  {siblingDocs
                    .filter(d => content.manifestType === "SEA" ? d.type === "HBL" : d.type === "HAWB")
                    .map((d) => (
                      <span key={d.id} className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-mono font-semibold ${
                        d.status === "LOCKED" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                        d.status === "VERIFIED" ? "bg-blue-50 text-blue-700 border border-blue-200" :
                        "bg-amber-50 text-amber-700 border border-amber-200"
                      }`}>
                        {d.documentNo}
                        <span className="text-[9px] font-normal opacity-70">({d.status})</span>
                      </span>
                    ))
                  }
                </div>
              )}
              <div className="space-y-4 border-l-2 border-emerald-500 pl-3">
                <div className="text-xs font-bold text-slate-500 uppercase">
                  {content.manifestType === "SEA" ? "Shipment/HBL Line 1" : "Shipment/HAWB Line 1"}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    {content.manifestType === "SEA" ? (
                      <>
                        <Label htmlFor="li-hblNo">HBL No</Label>
                        <Input
                          id="li-hblNo"
                          value={content.lineItems?.[0]?.hblNo || ""}
                          onChange={(e) => handleLineItemChange(0, "hblNo", e.target.value)}
                          disabled={isLocked}
                          className="h-9 text-xs bg-white"
                        />
                      </>
                    ) : (
                      <>
                        <Label htmlFor="li-hawbNo">HAWB No</Label>
                        <Input
                          id="li-hawbNo"
                          value={content.lineItems?.[0]?.hawbNo || ""}
                          onChange={(e) => handleLineItemChange(0, "hawbNo", e.target.value)}
                          disabled={isLocked}
                          className="h-9 text-xs bg-white"
                        />
                      </>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="li-destination">
                      {content.manifestType === "SEA" ? "Port of Discharge" : "Destination Airport"}
                    </Label>
                    <Input
                      id="li-destination"
                      value={content.lineItems?.[0]?.destination || ""}
                      onChange={(e) => handleLineItemChange(0, "destination", e.target.value)}
                      disabled={isLocked}
                      className="h-9 text-xs bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="li-shipper">Shipper (Name)</Label>
                    <Input
                      id="li-shipper"
                      value={content.lineItems?.[0]?.shipper || ""}
                      onChange={(e) => handleLineItemChange(0, "shipper", e.target.value)}
                      disabled={isLocked}
                      className="h-9 text-xs bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="li-consignee">Consignee (Name)</Label>
                    <Input
                      id="li-consignee"
                      value={content.lineItems?.[0]?.consignee || ""}
                      onChange={(e) => handleLineItemChange(0, "consignee", e.target.value)}
                      disabled={isLocked}
                      className="h-9 text-xs bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="li-pieces">Pieces</Label>
                    <Input
                      id="li-pieces"
                      value={content.lineItems?.[0]?.pieces || ""}
                      onChange={(e) => handleLineItemChange(0, "pieces", e.target.value)}
                      disabled={isLocked}
                      className="h-9 text-xs bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="li-grossWeight">Gross Weight</Label>
                    <Input
                      id="li-grossWeight"
                      value={content.lineItems?.[0]?.grossWeight || ""}
                      onChange={(e) => handleLineItemChange(0, "grossWeight", e.target.value)}
                      disabled={isLocked}
                      className="h-9 text-xs bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="li-chargeableWeight">Chargeable Weight</Label>
                    <Input
                      id="li-chargeableWeight"
                      value={content.lineItems?.[0]?.chargeableWeight || ""}
                      onChange={(e) => handleLineItemChange(0, "chargeableWeight", e.target.value)}
                      disabled={isLocked}
                      className="h-9 text-xs bg-white"
                    />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <Label htmlFor="li-commodity">Commodity Description</Label>
                    <textarea
                      id="li-commodity"
                      value={content.lineItems?.[0]?.commodity || ""}
                      onChange={(e) => handleLineItemChange(0, "commodity", e.target.value)}
                      disabled={isLocked}
                      rows={2}
                      className="w-full rounded-md border border-slate-200 bg-white p-2 text-xs focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {!isLocked && (
              <div className="space-y-1">
                <Label htmlFor="changeRemarks">Change Version Remarks (optional)</Label>
                <Input
                  id="changeRemarks"
                  placeholder="Enter version change description..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            )}
          </Card>
        ) : isDebitNote ? (
          <Card className="p-5 space-y-5 bg-white border border-slate-200">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Debit Note Inputs</h3>

            {/* Header Section */}
            <div className="space-y-4 rounded-lg border border-slate-100 bg-slate-50/50 p-4">
              <h4 className="font-semibold text-slate-800 text-sm font-medium">Header details</h4>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="debitNoteNo">Debit Note No</Label>
                  <Input
                    id="debitNoteNo"
                    value={content.debitNoteNo}
                    disabled
                    className="h-9 text-xs bg-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="debitNoteDate">Debit Note Date</Label>
                  <Input
                    id="debitNoteDate"
                    type="date"
                    value={content.debitNoteDate}
                    onChange={(e) => handleRootChange("debitNoteDate", e.target.value)}
                    disabled={isLocked}
                    className="h-9 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="customerName">Customer / Bill To</Label>
                  <Input
                    id="customerName"
                    value={content.customerName}
                    onChange={(e) => handleRootChange("customerName", e.target.value)}
                    disabled={isLocked}
                    className="h-9 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="customerAddress">Customer Address</Label>
                  <Input
                    id="customerAddress"
                    value={content.customerAddress}
                    onChange={(e) => handleRootChange("customerAddress", e.target.value)}
                    disabled={isLocked}
                    className="h-9 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="attention">Attention / Contact</Label>
                  <Input
                    id="attention"
                    value={content.attention}
                    onChange={(e) => handleRootChange("attention", e.target.value)}
                    disabled={isLocked}
                    className="h-9 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="referenceNo">Reference No</Label>
                  <Input
                    id="referenceNo"
                    value={content.referenceNo}
                    onChange={(e) => handleRootChange("referenceNo", e.target.value)}
                    disabled={isLocked}
                    className="h-9 text-xs bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Routing & References Section */}
            <div className="space-y-4 rounded-lg border border-slate-100 bg-slate-50/50 p-4">
              <h4 className="font-semibold text-slate-800 text-sm font-medium">References & Routing</h4>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="shipmentJobNo">Shipment Job No</Label>
                  <Input
                    id="shipmentJobNo"
                    value={content.shipmentJobNo}
                    onChange={(e) => handleRootChange("shipmentJobNo", e.target.value)}
                    disabled={isLocked}
                    className="h-9 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="quotationNo">Quotation No</Label>
                  <Input
                    id="quotationNo"
                    value={content.quotationNo}
                    onChange={(e) => handleRootChange("quotationNo", e.target.value)}
                    disabled={isLocked}
                    className="h-9 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="invoiceNo">Invoice No</Label>
                  <Input
                    id="invoiceNo"
                    value={content.invoiceNo}
                    onChange={(e) => handleRootChange("invoiceNo", e.target.value)}
                    disabled={isLocked}
                    className="h-9 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="hblNo">HBL No</Label>
                  <Input
                    id="hblNo"
                    value={content.hblNo}
                    onChange={(e) => handleRootChange("hblNo", e.target.value)}
                    disabled={isLocked}
                    className="h-9 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="hawbNo">HAWB No</Label>
                  <Input
                    id="hawbNo"
                    value={content.hawbNo}
                    onChange={(e) => handleRootChange("hawbNo", e.target.value)}
                    disabled={isLocked}
                    className="h-9 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="manifestNo">Manifest No</Label>
                  <Input
                    id="manifestNo"
                    value={content.manifestNo}
                    onChange={(e) => handleRootChange("manifestNo", e.target.value)}
                    disabled={isLocked}
                    className="h-9 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="origin">Origin</Label>
                  <Input
                    id="origin"
                    value={content.origin}
                    onChange={(e) => handleRootChange("origin", e.target.value)}
                    disabled={isLocked}
                    className="h-9 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="destination">Destination</Label>
                  <Input
                    id="destination"
                    value={content.destination}
                    onChange={(e) => handleRootChange("destination", e.target.value)}
                    disabled={isLocked}
                    className="h-9 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="transportMode">Transport Mode</Label>
                  <Input
                    id="transportMode"
                    value={content.transportMode}
                    onChange={(e) => handleRootChange("transportMode", e.target.value)}
                    disabled={isLocked}
                    className="h-9 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="shipmentType">Shipment Type</Label>
                  <Input
                    id="shipmentType"
                    value={content.shipmentType}
                    onChange={(e) => handleRootChange("shipmentType", e.target.value)}
                    disabled={isLocked}
                    className="h-9 text-xs bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Terms Section */}
            <div className="space-y-4 rounded-lg border border-slate-100 bg-slate-50/50 p-4">
              <h4 className="font-semibold text-slate-800 text-sm font-medium">Payment & Currency</h4>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1">
                  <Label htmlFor="currency">Currency</Label>
                  <Input
                    id="currency"
                    value={content.currency}
                    onChange={(e) => handleRootChange("currency", e.target.value)}
                    disabled={isLocked}
                    className="h-9 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="paymentTerms">Payment Terms</Label>
                  <Input
                    id="paymentTerms"
                    value={content.paymentTerms}
                    onChange={(e) => handleRootChange("paymentTerms", e.target.value)}
                    disabled={isLocked}
                    className="h-9 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="dueDate">Due Date</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={content.dueDate}
                    onChange={(e) => handleRootChange("dueDate", e.target.value)}
                    disabled={isLocked}
                    className="h-9 text-xs bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Line Items Section */}
            <div className="space-y-4 rounded-lg border border-slate-100 bg-slate-50/50 p-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-slate-800 text-sm font-medium">Charge Items</h4>
                {!isLocked && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addDebitNoteLineItem}
                    className="h-7 text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  >
                    + Add Charge Line
                  </Button>
                )}
              </div>

              <div className="space-y-4">
                {(content.lineItems || []).map((item: any, idx: number) => (
                  <div key={idx} className="relative rounded border border-slate-200 bg-white p-3 space-y-3 shadow-xs">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                      <span className="text-xs font-semibold text-slate-500">Item #{idx + 1}</span>
                      {!isLocked && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteDebitNoteLineItem(idx)}
                          className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          ✕
                        </Button>
                      )}
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1 md:col-span-2">
                        <Label htmlFor={`li-desc-${idx}`}>Description / Charge Name</Label>
                        <Input
                          id={`li-desc-${idx}`}
                          value={item.description || ""}
                          onChange={(e) => handleDebitNoteLineItemChange(idx, "description", e.target.value)}
                          disabled={isLocked}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`li-basis-${idx}`}>Basis</Label>
                        <Input
                          id={`li-basis-${idx}`}
                          value={item.basis || ""}
                          onChange={(e) => handleDebitNoteLineItemChange(idx, "basis", e.target.value)}
                          disabled={isLocked}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`li-currency-${idx}`}>Currency</Label>
                        <Input
                          id={`li-currency-${idx}`}
                          value={item.currency || ""}
                          onChange={(e) => handleDebitNoteLineItemChange(idx, "currency", e.target.value)}
                          disabled={isLocked}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`li-qty-${idx}`}>Quantity</Label>
                        <Input
                          id={`li-qty-${idx}`}
                          type="number"
                          step="any"
                          value={item.quantity || ""}
                          onChange={(e) => handleDebitNoteLineItemChange(idx, "quantity", e.target.value)}
                          disabled={isLocked}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`li-rate-${idx}`}>Unit Rate</Label>
                        <Input
                          id={`li-rate-${idx}`}
                          type="number"
                          step="any"
                          value={item.unitRate || ""}
                          onChange={(e) => handleDebitNoteLineItemChange(idx, "unitRate", e.target.value)}
                          disabled={isLocked}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`li-amount-${idx}`}>Amount</Label>
                        <Input
                          id={`li-amount-${idx}`}
                          type="number"
                          step="any"
                          value={item.amount || ""}
                          onChange={(e) => handleDebitNoteLineItemChange(idx, "amount", e.target.value)}
                          disabled={isLocked}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`li-tax-${idx}`}>Tax / VAT</Label>
                        <Input
                          id={`li-tax-${idx}`}
                          type="number"
                          step="any"
                          value={item.tax || ""}
                          onChange={(e) => handleDebitNoteLineItemChange(idx, "tax", e.target.value)}
                          disabled={isLocked}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-1 md:col-span-2">
                        <div className="flex justify-between items-center text-xs font-semibold text-slate-700 bg-slate-50 p-2 rounded border border-slate-100">
                          <span>Row Total:</span>
                          <span>{item.currency || "USD"} {item.total || "0"}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals Section */}
            <div className="space-y-4 rounded-lg border border-slate-100 bg-slate-50/50 p-4">
              <h4 className="font-semibold text-slate-800 text-sm font-medium">Financial Summary</h4>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="subtotal">Subtotal</Label>
                  <Input
                    id="subtotal"
                    value={content.subtotal}
                    disabled
                    className="h-9 text-xs bg-slate-100 font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="taxTotal">Tax / VAT Total</Label>
                  <Input
                    id="taxTotal"
                    value={content.taxTotal}
                    disabled
                    className="h-9 text-xs bg-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="discount">Discount</Label>
                  <Input
                    id="discount"
                    type="number"
                    step="any"
                    value={content.discount}
                    onChange={(e) => handleDebitNoteDiscountChange(e.target.value)}
                    disabled={isLocked}
                    className="h-9 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="grandTotal">Grand Total</Label>
                  <Input
                    id="grandTotal"
                    value={content.grandTotal}
                    disabled
                    className="h-9 text-xs bg-emerald-50 text-emerald-800 font-bold border-emerald-200"
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label htmlFor="amountInWords">Amount in Words</Label>
                  <Input
                    id="amountInWords"
                    value={content.amountInWords}
                    onChange={(e) => handleRootChange("amountInWords", e.target.value)}
                    disabled={isLocked}
                    className="h-9 text-xs bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Remarks & Instructions */}
            <div className="space-y-4 rounded-lg border border-slate-100 bg-slate-50/50 p-4">
              <h4 className="font-semibold text-slate-800 text-sm font-medium">Remarks & Bank Instructions</h4>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="remarks">Remarks</Label>
                  <textarea
                    id="remarks"
                    value={content.remarks}
                    onChange={(e) => handleRootChange("remarks", e.target.value)}
                    disabled={isLocked}
                    rows={2}
                    className="w-full rounded-md border border-slate-200 bg-white p-2 text-xs focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="paymentInstruction">Bank / Payment Instructions</Label>
                  <textarea
                    id="paymentInstruction"
                    value={content.paymentInstruction}
                    onChange={(e) => handleRootChange("paymentInstruction", e.target.value)}
                    disabled={isLocked}
                    rows={3}
                    className="w-full rounded-md border border-slate-200 bg-white p-2 text-xs focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {!isLocked && (
              <div className="space-y-1">
                <Label htmlFor="changeRemarks">Change Version Remarks (optional)</Label>
                <Input
                  id="changeRemarks"
                  placeholder="Enter version change description..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            )}
          </Card>
        ) : (
          <Card className="p-5 space-y-5 bg-white border border-slate-200">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Document Data Inputs</h3>
            
            {/* Parties Section */}
            <div className="space-y-4 rounded-lg border border-slate-100 bg-slate-50/50 p-4">
              <h4 className="font-semibold text-slate-800 text-sm">Key Parties</h4>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="shipperName">Shipper Name</Label>
                  <Input
                    id="shipperName"
                    value={content.shipper.name}
                    onChange={(e) => handleNestedChange("shipper", "name", e.target.value)}
                    disabled={isLocked}
                    className="h-9 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="shipperAddress">Shipper Address</Label>
                  <Input
                    id="shipperAddress"
                    value={content.shipper.address}
                    onChange={(e) => handleNestedChange("shipper", "address", e.target.value)}
                    disabled={isLocked}
                    className="h-9 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="consigneeName">Consignee Name</Label>
                  <Input
                    id="consigneeName"
                    value={content.consignee.name}
                    onChange={(e) => handleNestedChange("consignee", "name", e.target.value)}
                    disabled={isLocked}
                    className="h-9 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="consigneeAddress">Consignee Address</Label>
                  <Input
                    id="consigneeAddress"
                    value={content.consignee.address}
                    onChange={(e) => handleNestedChange("consignee", "address", e.target.value)}
                    disabled={isLocked}
                    className="h-9 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label htmlFor="notifyName">Notify Party Name</Label>
                  <Input
                    id="notifyName"
                    value={content.notifyParty.name}
                    onChange={(e) => handleNestedChange("notifyParty", "name", e.target.value)}
                    disabled={isLocked}
                    className="h-9 text-xs bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Carrier & Route Section */}
            <div className="space-y-4 rounded-lg border border-slate-100 bg-slate-50/50 p-4">
              <h4 className="font-semibold text-slate-800 text-sm">Carrier & Routing</h4>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="carrier">Carrier Line / Airline</Label>
                  <Input
                    id="carrier"
                    value={content.carrier}
                    onChange={(e) => handleRootChange("carrier", e.target.value)}
                    disabled={isLocked}
                    className="h-9 text-xs bg-white"
                  />
                </div>
                {document.type === "HAWB" ? (
                  <div className="space-y-1">
                    <Label htmlFor="flightNo">Flight No</Label>
                    <Input
                      id="flightNo"
                      value={content.flightNo}
                      onChange={(e) => handleRootChange("flightNo", e.target.value)}
                      disabled={isLocked}
                      className="h-9 text-xs bg-white"
                    />
                  </div>
                ) : (
                  <>
                    <div className="md:col-span-2 space-y-2 border-b border-slate-100 pb-3">
                      <Label className="text-xs font-semibold text-slate-700">Does this shipment require Transshipment (Indirect routing)?</Label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium">
                          <input
                            type="radio"
                            name="dnIsTransshipment"
                            value="yes"
                            checked={content.isTransshipment === "yes"}
                            onChange={() => handleRootChange("isTransshipment", "yes")}
                            disabled={isLocked}
                            className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-slate-300"
                          />
                          Yes
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium">
                          <input
                            type="radio"
                            name="dnIsTransshipment"
                            value="no"
                            checked={content.isTransshipment !== "yes"}
                            onChange={() => handleRootChange("isTransshipment", "no")}
                            disabled={isLocked}
                            className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-slate-300"
                          />
                          No
                        </label>
                      </div>
                    </div>

                    {content.isTransshipment === "yes" && (
                      <div className="md:col-span-2 space-y-3 rounded-lg border border-slate-200 bg-white p-3">
                        <div className="flex items-center justify-between border-b pb-2">
                          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Transshipment Legs</span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={isLocked}
                            className="h-7 text-xs border-emerald-500 text-emerald-600 hover:bg-emerald-50"
                            onClick={() => {
                              const newLegs = [...(content.transshipmentLegs || []), { vessel: "", voyage: "", viaPort: "" }];
                              setContent((prev: any) => ({ ...prev, transshipmentLegs: newLegs }));
                            }}
                          >
                            + Add Transit Leg
                          </Button>
                        </div>

                        {(!content.transshipmentLegs || content.transshipmentLegs.length === 0) ? (
                          <p className="text-xs text-slate-400 italic py-2">No transit legs added. Click 'Add Transit Leg' to specify routing details.</p>
                        ) : (
                          <div className="space-y-3 divide-y divide-slate-100">
                            {content.transshipmentLegs.map((leg: any, index: number) => (
                              <div key={index} className={`grid gap-3 pt-3 first:pt-0 ${index > 0 ? "border-t border-slate-100" : ""}`}>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold text-slate-500">Leg #{index + 1}</span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    disabled={isLocked}
                                    className="h-6 px-2 text-[10px] text-red-500 hover:bg-red-50"
                                    onClick={() => {
                                      const newLegs = content.transshipmentLegs.filter((_: any, idx: number) => idx !== index);
                                      setContent((prev: any) => ({ ...prev, transshipmentLegs: newLegs }));
                                    }}
                                  >
                                    Remove
                                  </Button>
                                </div>
                                <div className="grid gap-3 sm:grid-cols-3">
                                  <div className="space-y-1">
                                    <Label className="text-[10px]">Vessel Name</Label>
                                    <Input
                                      value={leg.vessel || ""}
                                      disabled={isLocked}
                                      className="h-8 text-xs bg-white"
                                      placeholder="e.g. MV HR RHEA"
                                      onChange={(e) => {
                                        const newLegs = [...content.transshipmentLegs];
                                        newLegs[index] = { ...newLegs[index], vessel: e.target.value };
                                        setContent((prev: any) => ({ ...prev, transshipmentLegs: newLegs }));
                                      }}
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-[10px]">Voyage No</Label>
                                    <Input
                                      value={leg.voyage || ""}
                                      disabled={isLocked}
                                      className="h-8 text-xs bg-white"
                                      placeholder="e.g. 045E"
                                      onChange={(e) => {
                                        const newLegs = [...content.transshipmentLegs];
                                        newLegs[index] = { ...newLegs[index], voyage: e.target.value };
                                        setContent((prev: any) => ({ ...prev, transshipmentLegs: newLegs }));
                                      }}
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-[10px]">Transshipment Port (Via)</Label>
                                    <Input
                                      value={leg.viaPort || ""}
                                      disabled={isLocked}
                                      className="h-8 text-xs bg-white"
                                      placeholder="e.g. Singapore"
                                      onChange={(e) => {
                                        const newLegs = [...content.transshipmentLegs];
                                        newLegs[index] = { ...newLegs[index], viaPort: e.target.value };
                                        setContent((prev: any) => ({ ...prev, transshipmentLegs: newLegs }));
                                      }}
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="space-y-1">
                      <Label htmlFor="vessel">Vessel Name</Label>
                      <Input
                        id="vessel"
                        value={content.vessel}
                        onChange={(e) => handleRootChange("vessel", e.target.value)}
                        disabled={isLocked}
                        className="h-9 text-xs bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="voyage">Voyage No</Label>
                      <Input
                        id="voyage"
                        value={content.voyage}
                        onChange={(e) => handleRootChange("voyage", e.target.value)}
                        disabled={isLocked}
                        className="h-9 text-xs bg-white"
                      />
                    </div>
                  </>
                )}
                <div className="space-y-1">
                  <Label htmlFor="pol">Port of Loading / Departure</Label>
                  <Input
                    id="pol"
                    value={content.portOfLoading}
                    onChange={(e) => handleRootChange("portOfLoading", e.target.value)}
                    disabled={isLocked}
                    className="h-9 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="pod">Port of Discharge / Destination</Label>
                  <Input
                    id="pod"
                    value={content.portOfDischarge}
                    onChange={(e) => handleRootChange("portOfDischarge", e.target.value)}
                    disabled={isLocked}
                    className="h-9 text-xs bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Cargo Section */}
            <div className="space-y-4 rounded-lg border border-slate-100 bg-slate-50/50 p-4">
              <h4 className="font-semibold text-slate-800 text-sm">Cargo details</h4>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1">
                  <Label htmlFor="packageCount">Package Count</Label>
                  <Input
                    id="packageCount"
                    type="number"
                    value={content.packageCount}
                    onChange={(e) => handleRootChange("packageCount", Number(e.target.value))}
                    disabled={isLocked}
                    className="h-9 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="packageType">Package Type</Label>
                  <Input
                    id="packageType"
                    value={content.packageType}
                    onChange={(e) => handleRootChange("packageType", e.target.value)}
                    disabled={isLocked}
                    className="h-9 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="terms">Freight Term</Label>
                  <select
                    id="terms"
                    value={content.freightTerms}
                    onChange={(e) => handleRootChange("freightTerms", e.target.value)}
                    disabled={isLocked}
                    className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs"
                  >
                    <option value="PREPAID">Prepaid</option>
                    <option value="COLLECT">Collect</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="grossWeight">Gross Weight (KG)</Label>
                  <Input
                    id="grossWeight"
                    type="number"
                    step="any"
                    value={content.grossWeight}
                    onChange={(e) => handleRootChange("grossWeight", Number(e.target.value))}
                    disabled={isLocked}
                    className="h-9 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="netWeight">Net Weight (KG)</Label>
                  <Input
                    id="netWeight"
                    type="number"
                    step="any"
                    value={content.netWeight}
                    onChange={(e) => handleRootChange("netWeight", Number(e.target.value))}
                    disabled={isLocked}
                    className="h-9 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="cbm">Measurement (CBM)</Label>
                  <Input
                    id="cbm"
                    type="number"
                    step="any"
                    value={content.cbm}
                    onChange={(e) => handleRootChange("cbm", Number(e.target.value))}
                    disabled={isLocked}
                    className="h-9 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1 md:col-span-3">
                  <Label htmlFor="cargoDescription">Description of Cargo</Label>
                  <textarea
                    id="cargoDescription"
                    value={content.cargoDescription}
                    onChange={(e) => handleRootChange("cargoDescription", e.target.value)}
                    disabled={isLocked}
                    rows={3}
                    className="w-full rounded-md border border-slate-200 bg-white p-2 text-xs focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {!isLocked && (
              <div className="space-y-1">
                <Label htmlFor="changeRemarks">Change Version Remarks (optional)</Label>
                <Input
                  id="changeRemarks"
                  placeholder="Enter version change description..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            )}
          </Card>
        )}

        {/* HTML Print Draft Preview Wrapper */}
        <div className="xl:sticky xl:top-[90px] xl:max-h-[calc(100vh-120px)] xl:overflow-y-auto self-start w-full pr-1">
          <Card className="p-5 space-y-4 bg-slate-900 border border-slate-800 text-slate-100 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Document Draft Preview</h3>
              <Button asChild size="sm" variant="outline" className="bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200 hover:text-white h-8 text-xs">
                <a href={`/dashboard/shipments/${document.shipmentJobId}/freight-documents/${document.id}/print`} target="_blank" rel="noopener noreferrer">
                  <Printer className="h-3.5 w-3.5 mr-1.5" /> Print / Save / Download
                </a>
              </Button>
            </div>
            
            <div className="overflow-x-auto w-full">
              <div className="min-w-[768px] pr-1 pb-2">
                {isHbl ? (
              <div className="mt-4 rounded border border-slate-300 bg-white p-6 text-slate-950 font-sans shadow-md text-[9px] space-y-0 leading-normal select-none">
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
                {(() => {
                  const legs = content.transshipmentLegs || [];
                  const isTrans = content.isTransshipment === "yes";
                  const computedPreCarriage = (isTrans && legs.length > 0)
                    ? legs.map((l: any) => l.vessel ? `${l.vessel}${l.voyage ? ` v.${l.voyage}` : ""}` : "").filter(Boolean).join(" / ")
                    : (content.preCarriageBy || "");
                  const computedVia = (isTrans && legs.length > 0)
                    ? legs.map((l: any) => l.viaPort).filter(Boolean).join(" via ")
                    : (content.transshipmentPort || "");

                  return (
                    <div className="grid grid-cols-4 border border-slate-900 border-b-0 divide-x divide-slate-900">
                      <div className="p-1.5">
                        <p className="font-bold text-[6px] text-slate-500 uppercase">Pre-Carriage / Receipt Place</p>
                        <p className="font-semibold text-slate-800 text-[8px] mt-0.5 whitespace-pre-line leading-tight">
                          {computedPreCarriage ? `${computedPreCarriage}\n` : ""}
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
                          {computedVia ? `\nvia ${computedVia}` : ""}
                        </p>
                      </div>
                      <div className="p-1.5">
                        <p className="font-bold text-[6px] text-slate-500 uppercase">Port of Discharge</p>
                        <p className="font-semibold text-slate-800 text-[8px] mt-0.5">{content.portOfDischarge || "—"}</p>
                      </div>
                    </div>
                  );
                })()}

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
              <div className="mt-4 rounded border border-slate-300 bg-white p-6 text-slate-950 font-sans shadow-md text-[9px] space-y-0 leading-normal select-none">
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
                      <th className="p-1.5 w-1/12">Pieces</th>
                      <th className="p-1.5 w-2/12">Gross Weight</th>
                      <th className="p-1.5 w-2/12">Chargeable Wt</th>
                      <th className="p-1.5 w-5/12">Nature and Quantity of Goods (incl. Dimensions)</th>
                      <th className="p-1.5 w-2/12 text-right">Declared Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="divide-x divide-slate-900 align-top">
                      <td className="p-1.5 font-semibold text-slate-800">{content.pieces || "—"}</td>
                      <td className="p-1.5 font-mono text-[7px] text-slate-900">{content.grossWeight || "—"}</td>
                      <td className="p-1.5 font-mono text-[7px] text-slate-900">{content.chargeableWeight || "—"}</td>
                      <td className="p-1.5 whitespace-pre-wrap text-slate-800">
                        <p className="font-medium">{content.commodity || "—"}</p>
                        {content.dimensions && <p className="text-[6px] text-slate-400 mt-1">Dims: {content.dimensions}</p>}
                        {content.handlingInformation && <p className="text-[6px] text-slate-400 mt-1">Handling: {content.handlingInformation}</p>}
                      </td>
                      <td className="p-1.5 text-right font-mono text-slate-900 font-medium">
                        <p className="text-[6px] text-slate-400">Carriage: {content.declaredValueForCarriage || "NVD"}</p>
                        <p className="text-[6px] text-slate-400">Customs: {content.declaredValueForCustoms || "NCV"}</p>
                      </td>
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
                  </div>

                  <div className="p-1.5 divide-y divide-slate-900 flex flex-col justify-between">
                    <div>
                      <p className="font-bold text-[6px] text-slate-500 uppercase">Place & Date of Issue</p>
                      <p className="font-semibold text-slate-800 mt-0.5">
                        {content.issuePlace || "—"}
                        {content.issueDate ? ` | ${new Date(content.issueDate).toLocaleDateString()}` : ""}
                      </p>
                    </div>
                  </div>

                  <div className="p-1.5 flex flex-col justify-between bg-slate-50/50 min-h-[50px]">
                    <div>
                      <p className="font-bold text-[5px] text-slate-400 uppercase text-center">Signature of Issuing Carrier/Agent</p>
                    </div>
                    <div className="border-t border-dashed border-slate-400 pt-0.5 text-center text-slate-400 text-[7px] italic">
                      Authorized Signature
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center text-[6px] text-slate-400 pt-1.5">
                  <p>Status: <span className="font-bold text-slate-600">{document.status}</span></p>
                  <p className="italic">This is a system generated House Air Waybill copy.</p>
                </div>
              </div>
            ) : isManifest ? (
              <div className="mt-4 rounded border border-slate-300 bg-white p-6 text-slate-950 font-sans shadow-md text-[9px] space-y-0 leading-normal select-none">
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
                  <h4 className="font-bold text-[12px] text-emerald-800 tracking-wider">
                    {content.manifestType === "SEA" ? "OCEAN FREIGHT CARGO MANIFEST" : "AIR CARGO MANIFEST"}
                  </h4>
                  <p className="text-[7px] text-slate-500 font-medium uppercase">
                    {content.manifestType === "SEA" ? "Forwarder Ocean Consolidation Manifest" : "Forwarder Consolidation Cargo Manifest"}
                  </p>
                  <p className="text-[6px] text-slate-400 italic">
                    {content.manifestType === "SEA" 
                      ? "This software-generated document is a forwarder operational summary, not an official shipping-line document." 
                      : "This software-generated document is a forwarder operational summary, not an official airline-issued document."}
                  </p>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-2 border border-slate-900 border-t-0 text-[8px] divide-x divide-slate-900">
                  <div className="divide-y divide-slate-900">
                    <div className="p-1.5">
                      <p className="font-bold text-[6px] text-slate-500 uppercase">Manifest Number</p>
                      <p className="font-mono font-bold text-slate-900 text-[9px]">{content.manifestNo || "DRAFT"}</p>
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
                          <p className="font-semibold text-slate-800">
                            {[content.vesselName, content.voyageNo].filter(Boolean).join(" / ") || "—"}
                          </p>
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

                {/* Routing & Transport Grid */}
                <div className="grid grid-cols-4 border border-slate-900 border-t-0 divide-x divide-slate-900 text-[8px]">
                  {content.manifestType === "SEA" ? (
                    <>
                      <div className="p-1.5">
                        <p className="font-bold text-[6px] text-slate-500 uppercase">Vessel</p>
                        <p className="font-semibold text-slate-800">{content.vesselName || "—"}</p>
                      </div>
                      <div className="p-1.5">
                        <p className="font-bold text-[6px] text-slate-500 uppercase">On Board Date</p>
                        <p className="font-semibold text-slate-800">
                          {content.onBoardDate ? new Date(content.onBoardDate).toLocaleDateString() : "—"}
                        </p>
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
                        <p className="font-semibold text-slate-800">
                          {content.flightDate ? new Date(content.flightDate).toLocaleDateString() : "—"}
                        </p>
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

                {/* Shipper & Consignee */}
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

                {/* Cargo Details */}
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
                    <p className="font-mono text-slate-800">{content.dimensions || "—"}</p>
                  </div>
                </div>

                {/* Line Items Table */}
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
                        <th className="p-1.5 w-1/12 text-center">Pieces</th>
                        <th className="p-1.5 w-2/12 text-right">Gross Wt</th>
                        <th className="p-1.5 w-3/12">Commodity</th>
                        <th className="p-1.5 w-1/12 text-center">{content.manifestType === "SEA" ? "Discharge Port" : "Dest"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(content.lineItems || []).map((item: any, idx: number) => (
                        <tr key={idx} className="divide-x divide-slate-900 border-b border-slate-900/10 last:border-b-0 align-top">
                          <td className="p-1.5 font-mono font-semibold text-slate-955">
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

                {/* Lower Remarks and Special Handling */}
                <div className="grid grid-cols-2 border border-slate-900 border-t-0 text-[8px] divide-x divide-slate-900">
                  <div className="p-1.5 space-y-0.5">
                    <p className="font-bold text-[6px] text-slate-500 uppercase">Special Handling Information</p>
                    <p className="text-slate-800 whitespace-pre-wrap">{content.specialHandlingInformation || "N/A"}</p>
                  </div>
                  <div className="p-1.5 space-y-0.5">
                    <p className="font-bold text-[6px] text-slate-500 uppercase">Remarks</p>
                    <p className="text-slate-800 whitespace-pre-wrap">{content.remarks || "—"}</p>
                  </div>
                </div>

                {/* Signature Box */}
                <div className="grid grid-cols-2 border border-slate-900 border-t-0 text-[8px] divide-x divide-slate-900">
                  <div className="p-1.5">
                    <p className="font-bold text-[6px] text-slate-500 uppercase">Prepared By</p>
                    <p className="font-semibold text-slate-800 mt-1">{document.createdBy?.name || "Freight Controller System"}</p>
                  </div>
                  <div className="p-1.5 flex flex-col justify-between min-h-[45px] bg-slate-50/50">
                    <p className="font-bold text-[5px] text-slate-400 uppercase text-center">Authorized Forwarder Signature</p>
                    <div className="border-t border-dashed border-slate-400 pt-0.5 text-center text-slate-400 text-[6px] italic">
                      Authorized Representative
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center text-[6px] text-slate-400 pt-1.5">
                  <p>Status: <span className="font-bold text-slate-600">{document.status}</span></p>
                  <p className="italic">This copy contains forwarder cargo manifest details only.</p>
                </div>
              </div>
            ) : isDebitNote ? (
              <div className="mt-4 rounded border border-slate-300 bg-white p-6 text-slate-950 font-sans shadow-md text-[9px] space-y-3 leading-normal select-none">
                {/* Company Name & Document Title */}
                <div className="flex justify-between items-start border-b-2 border-slate-950 pb-2">
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
                        <h4 className="font-bold text-[12px] text-slate-900 tracking-wide uppercase">
                          {companyName || "FREIGHT FORWARDER CO."}
                        </h4>
                        <p className="text-[7px] text-slate-500">Professional Freight Logistics & Forwarding Services</p>
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
                    <h3 className="font-extrabold text-[14px] text-emerald-800 tracking-wider">DEBIT NOTE</h3>
                    <p className="font-mono text-slate-800 font-bold text-[9px]">NO: {content.debitNoteNo || "DRAFT"}</p>
                    <p className="text-[7px] text-slate-500">DATE: {content.debitNoteDate || "—"}</p>
                  </div>
                </div>

                {/* Bill To Customer & Shipment References */}
                <div className="grid grid-cols-2 gap-4 border border-slate-900 border-b-0 divide-x divide-slate-900">
                  <div className="p-2 space-y-1">
                    <p className="font-bold text-[6px] text-slate-500 uppercase tracking-wider">Bill To Customer</p>
                    <p className="font-bold text-slate-900 text-[9px] leading-tight">{content.customerName || "—"}</p>
                    <p className="text-slate-600 text-[8px] whitespace-pre-line leading-snug">{content.customerAddress || "—"}</p>
                    {content.attention && (
                      <p className="text-slate-700 text-[7px] mt-1">
                        <span className="font-semibold">Attention:</span> {content.attention}
                      </p>
                    )}
                  </div>
                  <div className="p-2 grid grid-cols-2 gap-1.5 text-[8px]">
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
                    <div>
                      <p className="font-bold text-[6px] text-slate-400 uppercase">HBL No</p>
                      <p className="font-mono font-semibold text-slate-800">{content.hblNo || "—"}</p>
                    </div>
                    <div>
                      <p className="font-bold text-[6px] text-slate-400 uppercase">HAWB No</p>
                      <p className="font-mono font-semibold text-slate-800">{content.hawbNo || "—"}</p>
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
                    <p className="font-semibold text-slate-800 mt-1">{document.createdBy?.name || "System Generated"}</p>
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
              <div className="mt-4 rounded border border-slate-700 bg-white p-6 text-slate-950 font-sans shadow-md text-[10px] space-y-4">
                <div className="flex justify-between border-b pb-3 border-slate-300">
                  <div className="font-bold text-lg text-emerald-800">{document.type} DRAFT</div>
                  <div className="text-right">
                    <p className="font-semibold text-xs">Doc No: {document.documentNo}</p>
                    <p className="text-slate-500">Status: {document.status}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 border-b pb-3 border-slate-300">
                  <div>
                    <p className="font-bold uppercase text-[8px] text-slate-500">Shipper</p>
                    <p className="font-medium mt-0.5">{content.shipper.name || "-"}</p>
                    <p className="text-slate-600">{content.shipper.address || "-"}</p>
                  </div>
                  <div>
                    <p className="font-bold uppercase text-[8px] text-slate-500">Consignee</p>
                    <p className="font-medium mt-0.5">{content.consignee.name || "-"}</p>
                    <p className="text-slate-600">{content.consignee.address || "-"}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 border-b pb-3 border-slate-300">
                  <div>
                    <p className="font-bold uppercase text-[8px] text-slate-500">Notify Party</p>
                    <p className="font-medium mt-0.5">{content.notifyParty.name || "-"}</p>
                    <p className="text-slate-600">{content.notifyParty.address || "-"}</p>
                  </div>
                  <div>
                    <p className="font-bold uppercase text-[8px] text-slate-500">Carrier Details</p>
                    <p className="mt-0.5">Carrier: {content.carrier || "-"}</p>
                    {document.type === "HAWB" ? (
                      <p>Flight No: {content.flightNo || "-"}</p>
                    ) : (
                      <div>
                        <p>Vessel: {content.vessel || "-"} | Voyage: {content.voyage || "-"}</p>
                        {(() => {
                          const legs = content.transshipmentLegs || [];
                          const isTrans = content.isTransshipment === "yes";
                          if (isTrans && legs.length > 0) {
                            return (
                              <div className="mt-1 space-y-0.5 border-t pt-1 border-slate-100">
                                <p className="text-[7px] font-bold uppercase text-slate-400">Transshipment Routing:</p>
                                {legs.map((leg: any, idx: number) => (
                                  <p key={idx} className="text-[9px] text-slate-500 leading-tight">
                                    Leg #{idx+1}: {leg.vessel || "-"}{leg.voyage ? ` v.${leg.voyage}` : ""} via {leg.viaPort || "-"}
                                  </p>
                                ))}
                              </div>
                            );
                          }
                          return (
                            <>
                              {content.preCarriageBy && <p className="text-[9px] text-slate-500">Pre-carriage: {content.preCarriageBy}</p>}
                              {content.transshipmentPort && <p className="text-[9px] text-slate-500">Via: {content.transshipmentPort}</p>}
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 border-b pb-3 border-slate-300">
                  <div>
                    <p className="font-bold uppercase text-[7px] text-slate-500">Receipt Place</p>
                    <p className="font-medium mt-0.5">{content.placeOfReceipt || "-"}</p>
                  </div>
                  <div>
                    <p className="font-bold uppercase text-[7px] text-slate-500">Loading Port</p>
                    <p className="font-medium mt-0.5">{content.portOfLoading || "-"}</p>
                  </div>
                  <div>
                    <p className="font-bold uppercase text-[7px] text-slate-500">Discharge Port</p>
                    <p className="font-medium mt-0.5">{content.portOfDischarge || "-"}</p>
                  </div>
                  <div>
                    <p className="font-bold uppercase text-[7px] text-slate-500">Delivery Place</p>
                    <p className="font-medium mt-0.5">{content.placeOfDelivery || "-"}</p>
                  </div>
                </div>

                <div className="grid grid-cols-12 gap-3 border-b pb-3 border-slate-300">
                  <div className="col-span-3">
                    <p className="font-bold uppercase text-[7px] text-slate-500">Marks & Nos</p>
                    <p className="mt-1 font-mono text-[9px]">{content.marksAndNumbers || "N/A"}</p>
                  </div>
                  <div className="col-span-5">
                    <p className="font-bold uppercase text-[7px] text-slate-500">Description of Packages & Goods</p>
                    <p className="mt-1 whitespace-pre-wrap">{content.cargoDescription || "-"}</p>
                    <p className="mt-2 text-slate-500 italic">Total Packages: {content.packageCount} {content.packageType}</p>
                  </div>
                  <div className="col-span-2 text-right">
                    <p className="font-bold uppercase text-[7px] text-slate-500">Gross Wt</p>
                    <p className="mt-1 font-mono">{content.grossWeight.toFixed(2)} KG</p>
                    <p className="text-[7px] text-slate-500 uppercase mt-2">Net Wt</p>
                    <p className="font-mono">{content.netWeight.toFixed(2)} KG</p>
                  </div>
                  <div className="col-span-2 text-right">
                    <p className="font-bold uppercase text-[7px] text-slate-500">Volume</p>
                    <p className="mt-1 font-mono">{content.cbm.toFixed(3)} CBM</p>
                  </div>
                </div>

                <div className="flex justify-between items-center text-[8px] text-slate-500">
                  <p>Freight Terms: <span className="font-bold text-slate-900">{content.freightTerms}</span></p>
                  <p className="italic">This is a draft version of the document and is not legally binding.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

          {/* Version logs */}
          <div className="border-t border-slate-800 pt-4 mt-4 space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Document Approvals & Version History</h4>
            <div className="max-h-[120px] overflow-y-auto space-y-1.5 text-[11px]">
              {document.approvals?.map((app: any) => (
                <div key={app.id} className="flex justify-between items-start text-slate-300 bg-slate-800/40 p-2 rounded">
                  <div>
                    <span className={`inline-block w-2.5 h-2.5 rounded-full mr-2 ${app.status === "APPROVED" ? "bg-emerald-500" : "bg-red-500"}`} />
                    <span className="font-medium">{app.approverType === "INTERNAL_USER" ? "Internal" : "Customer"} Approval (v{app.versionNumber}): </span>
                    <span className="text-slate-400 italic">&quot;{app.remarks || "-"}&quot;</span>
                  </div>
                  <span className="text-slate-500 text-[10px]">{new Date(app.createdAt).toLocaleDateString()}</span>
                </div>
              ))}
              {document.versions?.map((v: any) => (
                <div key={v.id} className="flex justify-between items-start text-slate-400 p-2 border-b border-slate-800/50">
                  <span>Version v{v.versionNumber} Created: <span className="text-slate-500 italic">&quot;{v.remarks || "-"}&quot;</span></span>
                  <span className="text-[10px]">{new Date(v.createdAt).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  </div>
  );
}

// Client Portal Approval Form
export function PortalDocumentApprovalForm({
  approveAction,
  rejectAction,
  documentId,
  documentNo,
}: {
  approveAction: FormAction;
  rejectAction: FormAction;
  documentId: string;
  documentNo: string;
}) {
  const [stateApp, formActionApp, pendingApp] = useActionState(approveAction, initialState);
  const [stateRej, formActionRej, pendingRej] = useActionState(rejectAction, initialState);
  const [remarks, setRemarks] = useState("");
  const [requestRevision, setRequestRevision] = useState(false);

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <AlertCircle className="h-5 w-5 text-amber-600" />
        <div>
          <h4 className="font-semibold text-slate-900 text-sm">Customer Approval Required</h4>
          <p className="text-xs text-slate-500">Please review the draft preview for {documentNo} carefully before confirming.</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="portalRemarks">Approval Remarks / Correction Notes</Label>
        <textarea
          id="portalRemarks"
          placeholder={requestRevision ? "Specify the changes you need (required)..." : "Enter optional comments..."}
          required={requestRevision}
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-slate-200 bg-white p-2 text-xs focus:border-emerald-500 focus:outline-none"
        />
      </div>

      <div className="flex gap-2">
        {!requestRevision ? (
          <>
            <form action={formActionApp}>
              <input type="hidden" name="documentId" value={documentId} />
              <input type="hidden" name="remarks" value={remarks} />
              <Button type="submit" disabled={pendingApp} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs py-1.5">
                Approve Document
              </Button>
            </form>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRequestRevision(true)}
              className="text-xs text-red-600 hover:text-red-700 py-1.5 border-red-200"
            >
              Request Changes
            </Button>
          </>
        ) : (
          <>
            <form action={formActionRej}>
              <input type="hidden" name="documentId" value={documentId} />
              <input type="hidden" name="remarks" value={remarks} />
              <Button type="submit" disabled={pendingRej || !remarks} className="bg-red-600 hover:bg-red-700 text-white text-xs py-1.5">
                Submit Change Request
              </Button>
            </form>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRequestRevision(false)}
              className="text-xs py-1.5"
            >
              Cancel
            </Button>
          </>
        )}
      </div>

      <Alert state={stateApp} />
      <Alert state={stateRej} />
    </div>
  );
}

// ─── External Document Tracker Forms ────────────────────────────────────────

const EXTERNAL_DOC_CATEGORIES = [
  {
    label: "Carrier / Airline Documents",
    options: [
      { value: "MBL", label: "Master Bill of Lading (MBL)" },
      { value: "MAWB", label: "Master Air Waybill (MAWB)" },
      { value: "BOOKING_CONFIRMATION", label: "Booking Confirmation" },
      { value: "DELIVERY_ORDER", label: "Delivery Order (DO)" },
      { value: "CARRIER_INVOICE", label: "Carrier Invoice" },
    ],
  },
  {
    label: "Shipper / Customer Documents",
    options: [
      { value: "COMMERCIAL_INVOICE", label: "Commercial Invoice" },
      { value: "PACKING_LIST", label: "Packing List" },
      { value: "CERTIFICATE_OF_ORIGIN", label: "Certificate of Origin" },
      { value: "MSDS_DG_CERTIFICATE", label: "MSDS / DG Certificate" },
      { value: "INSURANCE_CERTIFICATE", label: "Insurance Certificate" },
    ],
  },
  {
    label: "Customs / Regulatory Documents",
    options: [
      { value: "BILL_OF_ENTRY", label: "Bill of Entry" },
      { value: "EXPORT_DECLARATION", label: "Export Declaration" },
      { value: "CUSTOMS_RELEASE", label: "Customs Release Order" },
      { value: "GATE_PASS", label: "Gate Pass" },
    ],
  },
  {
    label: "Delivery / Warehouse Documents",
    options: [
      { value: "POD", label: "Proof of Delivery (POD)" },
      { value: "DELIVERY_CHALLAN", label: "Delivery Challan" },
      { value: "WAREHOUSE_RECEIPT", label: "Warehouse Receipt" },
    ],
  },
  {
    label: "Finance / Vendor Documents",
    options: [
      { value: "VENDOR_DEBIT_NOTE", label: "Vendor Debit Note" },
    ],
  },
];

// Register External Document Form
export function RegisterExternalDocumentForm({
  action,
  shipmentJobId,
}: {
  action: FormAction;
  shipmentJobId: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [expanded, setExpanded] = useState(false);

  if (!expanded) {
    return (
      <div className="flex items-center gap-2">
        <Button
          type="button"
          onClick={() => setExpanded(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white h-9"
        >
          <FileText className="h-4 w-4 mr-2" />
          Register External Document
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 space-y-4">
      <div className="flex justify-between items-center border-b border-blue-100 pb-2">
        <h4 className="text-sm font-semibold text-blue-900">Register External Document</h4>
        <Button type="button" variant="outline" size="sm" onClick={() => setExpanded(false)} className="h-7 text-xs">
          Cancel
        </Button>
      </div>
      <input type="hidden" name="shipmentJobId" value={shipmentJobId} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="extDocType">Document Type *</Label>
          <select
            id="extDocType"
            name="type"
            required
            className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="">Select type…</option>
            {EXTERNAL_DOC_CATEGORIES.map((cat) => (
              <optgroup label={cat.label} key={cat.label}>
                {cat.options.map((opt) => (
                  <option value={opt.value} key={opt.value}>{opt.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="extRefNo">Reference Number</Label>
          <Input id="extRefNo" name="referenceNo" placeholder="e.g. MBL-12345" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="extIssuedBy">Issued By</Label>
          <Input id="extIssuedBy" name="issuedBy" placeholder="e.g. Maersk Line" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="extReceivedFrom">Received From</Label>
          <Input id="extReceivedFrom" name="receivedFrom" placeholder="e.g. Agent name" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="extIssueDate">Issue Date</Label>
          <Input id="extIssueDate" name="issueDate" type="date" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="extExpiryDate">Expiry Date</Label>
          <Input id="extExpiryDate" name="expiryDate" type="date" />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="extRemarks">Remarks</Label>
          <Input id="extRemarks" name="remarks" placeholder="Internal notes" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="extFile">Attach File (optional)</Label>
          <Input id="extFile" name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending} className="bg-blue-600 hover:bg-blue-700 text-white h-9">
          <Save className="h-4 w-4 mr-2" />
          Register Document
        </Button>
        <Alert state={state} />
      </div>
    </form>
  );
}

// External Document Detail/Edit Form (for admin detail page)
export function ExternalDocumentDetailForm({
  document,
  updateAction,
  verifyAction,
  rejectAction,
  uploadFileAction,
  isAdminOrManager,
}: {
  document: any;
  updateAction: FormAction;
  verifyAction: (formData: FormData) => Promise<void>;
  rejectAction: FormAction;
  uploadFileAction: FormAction;
  isAdminOrManager: boolean;
}) {
  const [stateUpdate, formActionUpdate, pendingUpdate] = useActionState(updateAction, initialState);
  const [stateReject, formActionReject, pendingReject] = useActionState(rejectAction, initialState);
  const [stateUpload, formActionUpload, pendingUpload] = useActionState(uploadFileAction, initialState);

  const isLocked = document.status === "LOCKED";
  const isVerified = document.status === "VERIFIED";
  const isEditable = !isLocked && !isVerified;

  const statusColorMap: Record<string, string> = {
    PENDING_RECEIPT: "bg-yellow-100 text-yellow-800",
    RECEIVED: "bg-blue-100 text-blue-800",
    VERIFIED: "bg-emerald-100 text-emerald-800",
    REJECTED: "bg-red-100 text-red-800",
    EXPIRED: "bg-gray-100 text-gray-800",
    NOT_APPLICABLE: "bg-slate-100 text-slate-600",
    LOCKED: "bg-purple-100 text-purple-800",
  };
  const statusColor = statusColorMap[document.status as string] || "bg-slate-100 text-slate-600";

  return (
    <div className="space-y-6">
      {/* Status & Summary Card */}
      <Card className="p-6">
        <div className="flex flex-wrap justify-between items-start gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{document.documentNo}</h2>
            <p className="text-sm text-slate-500">{document.type.replaceAll("_", " ")} — {document.responsibility?.replaceAll("_", " ")}</p>
          </div>
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusColor}`}>
            {document.status?.replaceAll("_", " ")}
          </span>
        </div>

        {document.rejectionReason && document.status === "REJECTED" && (
          <div className="mt-3 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800">
            <strong>Rejection Reason:</strong> {document.rejectionReason}
          </div>
        )}

        {document.originalFileName && (
          <div className="mt-3 text-sm text-slate-600">
            <strong>Attached File:</strong> {document.originalFileName}
            {document.fileSize && ` (${(document.fileSize / 1024).toFixed(1)} KB)`}
            {document.filePath && (
              <a
                href={`/api/freight-documents/${document.id}/download`}
                className="ml-2 text-blue-600 hover:underline"
                download
              >
                Download
              </a>
            )}
          </div>
        )}
      </Card>

      {/* Metadata Edit Form */}
      <Card className="p-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Document Metadata</h3>
        <form action={formActionUpdate} className="space-y-4">
          <input type="hidden" name="documentId" value={document.id} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="editRefNo">Reference Number</Label>
              <Input id="editRefNo" name="referenceNo" defaultValue={document.referenceNo || ""} disabled={!isEditable} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="editIssuedBy">Issued By</Label>
              <Input id="editIssuedBy" name="issuedBy" defaultValue={document.issuedBy || ""} disabled={!isEditable} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="editReceivedFrom">Received From</Label>
              <Input id="editReceivedFrom" name="receivedFrom" defaultValue={document.receivedFrom || ""} disabled={!isEditable} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="editIssueDate">Issue Date</Label>
              <Input id="editIssueDate" name="issueDate" type="date" defaultValue={document.issueDate ? new Date(document.issueDate).toISOString().split("T")[0] : ""} disabled={!isEditable} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="editExpiryDate">Expiry Date</Label>
              <Input id="editExpiryDate" name="expiryDate" type="date" defaultValue={document.expiryDate ? new Date(document.expiryDate).toISOString().split("T")[0] : ""} disabled={!isEditable} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="editRemarks">Remarks</Label>
              <Input id="editRemarks" name="remarks" defaultValue={document.remarks || ""} disabled={!isEditable} />
            </div>
            {isEditable && (
              <div className="space-y-1.5">
                <Label htmlFor="editFile">Replace File</Label>
                <Input id="editFile" name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" />
              </div>
            )}
          </div>
          {isEditable && (
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={pendingUpdate} className="bg-blue-600 hover:bg-blue-700 text-white h-9">
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
              <Alert state={stateUpdate} />
            </div>
          )}
        </form>
      </Card>

      {/* File Upload (standalone) */}
      {isEditable && !document.filePath && (
        <Card className="p-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Upload Document File</h3>
          <form action={formActionUpload} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="documentId" value={document.id} />
            <div className="space-y-1.5">
              <Label htmlFor="uploadFile">File</Label>
              <Input id="uploadFile" name="file" type="file" required accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" />
            </div>
            <Button type="submit" disabled={pendingUpload} className="bg-blue-600 hover:bg-blue-700 text-white h-9">
              Upload
            </Button>
            <Alert state={stateUpload} />
          </form>
        </Card>
      )}

      {/* Verify / Reject Actions (admin/manager only) */}
      {isAdminOrManager && document.status !== "VERIFIED" && document.status !== "LOCKED" && document.status !== "NOT_APPLICABLE" && (
        <Card className="p-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Review Actions</h3>
          <div className="flex flex-wrap gap-3">
            {document.status !== "VERIFIED" && (
              <form action={verifyAction}>
                <input type="hidden" name="documentId" value={document.id} />
                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white h-9">
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Verify Document
                </Button>
              </form>
            )}
            <form action={formActionReject} className="flex items-end gap-2">
              <input type="hidden" name="documentId" value={document.id} />
              <div className="space-y-1.5">
                <Label htmlFor="rejectReason" className="text-xs">Rejection Reason</Label>
                <Input id="rejectReason" name="rejectionReason" placeholder="Reason..." className="h-9 w-48" />
              </div>
              <Button type="submit" disabled={pendingReject} className="bg-red-600 hover:bg-red-700 text-white h-9">
                <AlertCircle className="h-4 w-4 mr-2" />
                Reject
              </Button>
            </form>
            <Alert state={stateReject} />
          </div>
        </Card>
      )}

      {/* Version History */}
      {document.versions?.length > 0 && (
        <Card className="p-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Version History</h3>
          <div className="space-y-2">
            {document.versions.map((v: any) => (
              <div key={v.id} className="flex justify-between items-center rounded-md border p-3 text-sm">
                <div>
                  <span className="font-semibold text-slate-900">v{v.versionNumber}</span>
                  <span className="text-slate-500 ml-2">{v.remarks || ""}</span>
                  {v.createdBy && <span className="text-slate-400 ml-2">by {v.createdBy.name}</span>}
                </div>
                <span className="text-xs text-slate-400">
                  {new Date(v.createdAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
