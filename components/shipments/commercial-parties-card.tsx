"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil, Save, X } from "lucide-react";
import { saveShipmentParties } from "@/lib/actions/shipments";
import type { ActionState } from "@/lib/actions/helpers";

type PartiesData = {
  shipperName: string | null;
  shipperAddress: string | null;
  consigneeName: string | null;
  consigneeAddress: string | null;
  consigneeBin: string | null;
  notifyPartyName: string | null;
  notifyPartyAddress: string | null;
  notifyPartyBin: string | null;
};

type CommercialPartiesCardProps = {
  shipmentId: string;
  initialParties: PartiesData;
};

const initialState: ActionState = {};

export function CommercialPartiesCard({ shipmentId, initialParties }: CommercialPartiesCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [state, formAction, pending] = useActionState(saveShipmentParties, initialState);
  const router = useRouter();

  useEffect(() => {
    if (state.ok) {
      setIsEditing(false);
      router.refresh();
    }
  }, [state.ok, router]);

  if (isEditing) {
    return (
      <Card className="border border-slate-200 bg-white">
        <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <CardTitle className="text-base font-bold text-slate-900">Edit Commercial Parties</CardTitle>
            <CardDescription className="text-xs">Update Shipper, Consignee, and Notify Party details.</CardDescription>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-500 hover:text-slate-900"
            onClick={() => setIsEditing(false)}
            disabled={pending}
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="pt-4">
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="shipmentId" value={shipmentId} />

            {state.message && (
              <div className={`p-3 rounded text-xs font-medium ${state.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                {state.message}
              </div>
            )}

            {/* Shipper Section */}
            <div className="space-y-3 rounded-lg border border-slate-100 bg-slate-50/50 p-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Shipper Details</h4>
              <div className="grid gap-3">
                <div className="space-y-1">
                  <Label htmlFor="shipperName" className="text-xs">Shipper Name</Label>
                  <Input
                    id="shipperName"
                    name="shipperName"
                    defaultValue={initialParties.shipperName || ""}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="shipperAddress" className="text-xs">Shipper Address</Label>
                  <textarea
                    id="shipperAddress"
                    name="shipperAddress"
                    defaultValue={initialParties.shipperAddress || ""}
                    className="min-h-[60px] w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-slate-400"
                  />
                </div>
              </div>
            </div>

            {/* Consignee Section */}
            <div className="space-y-3 rounded-lg border border-slate-100 bg-slate-50/50 p-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Consignee Details</h4>
              <div className="grid gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="consigneeName" className="text-xs">Consignee Name</Label>
                    <Input
                      id="consigneeName"
                      name="consigneeName"
                      defaultValue={initialParties.consigneeName || ""}
                      className="h-9 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="consigneeBin" className="text-xs">Consignee BIN / VAT</Label>
                    <Input
                      id="consigneeBin"
                      name="consigneeBin"
                      defaultValue={initialParties.consigneeBin || ""}
                      className="h-9 text-xs"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="consigneeAddress" className="text-xs">Consignee Address</Label>
                  <textarea
                    id="consigneeAddress"
                    name="consigneeAddress"
                    defaultValue={initialParties.consigneeAddress || ""}
                    className="min-h-[60px] w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-slate-400"
                  />
                </div>
              </div>
            </div>

            {/* Notify Party Section */}
            <div className="space-y-3 rounded-lg border border-slate-100 bg-slate-50/50 p-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Notify Party Details</h4>
              <div className="grid gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="notifyPartyName" className="text-xs">Notify Party Name</Label>
                    <Input
                      id="notifyPartyName"
                      name="notifyPartyName"
                      defaultValue={initialParties.notifyPartyName || ""}
                      className="h-9 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="notifyPartyBin" className="text-xs">Notify Party BIN</Label>
                    <Input
                      id="notifyPartyBin"
                      name="notifyPartyBin"
                      defaultValue={initialParties.notifyPartyBin || ""}
                      className="h-9 text-xs"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="notifyPartyAddress" className="text-xs">Notify Party Address</Label>
                  <textarea
                    id="notifyPartyAddress"
                    name="notifyPartyAddress"
                    defaultValue={initialParties.notifyPartyAddress || ""}
                    className="min-h-[60px] w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-slate-400"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(false)}
                disabled={pending}
                className="h-8"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={pending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white h-8"
              >
                <Save className="mr-1.5 h-3.5 w-3.5" />
                {pending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-slate-200 bg-white">
      <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <CardTitle className="text-base font-bold text-slate-900">Parties</CardTitle>
          <CardDescription className="text-xs">Shipment key commercial parties and contacts.</CardDescription>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5"
          onClick={() => setIsEditing(true)}
        >
          <Pencil className="h-3.5 w-3.5" /> Edit
        </Button>
      </CardHeader>
      <CardContent className="grid gap-4 pt-4 text-sm">
        {/* Shipper Display */}
        <div className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Shipper</span>
          <div className="rounded-lg border border-slate-50 bg-slate-50/30 p-2.5">
            {initialParties.shipperName ? (
              <div>
                <p className="font-semibold text-slate-800 text-xs">{initialParties.shipperName}</p>
                {initialParties.shipperAddress && (
                  <p className="mt-1 text-slate-600 text-xs whitespace-pre-line leading-relaxed">{initialParties.shipperAddress}</p>
                )}
              </div>
            ) : (
              <p className="text-slate-400 text-xs italic">- Not set -</p>
            )}
          </div>
        </div>

        {/* Consignee Display */}
        <div className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Consignee</span>
          <div className="rounded-lg border border-slate-50 bg-slate-50/30 p-2.5">
            {initialParties.consigneeName ? (
              <div>
                <p className="font-semibold text-slate-800 text-xs">{initialParties.consigneeName}</p>
                {initialParties.consigneeAddress && (
                  <p className="mt-1 text-slate-600 text-xs whitespace-pre-line leading-relaxed">{initialParties.consigneeAddress}</p>
                )}
                {initialParties.consigneeBin && (
                  <p className="mt-1.5 text-xs text-slate-500 font-medium">BIN / VAT: {initialParties.consigneeBin}</p>
                )}
              </div>
            ) : (
              <p className="text-slate-400 text-xs italic">- Not set -</p>
            )}
          </div>
        </div>

        {/* Notify Party Display */}
        <div className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Notify Party</span>
          <div className="rounded-lg border border-slate-50 bg-slate-50/30 p-2.5">
            {initialParties.notifyPartyName ? (
              <div>
                <p className="font-semibold text-slate-800 text-xs">{initialParties.notifyPartyName}</p>
                {initialParties.notifyPartyAddress && (
                  <p className="mt-1 text-slate-600 text-xs whitespace-pre-line leading-relaxed">{initialParties.notifyPartyAddress}</p>
                )}
                {initialParties.notifyPartyBin && (
                  <p className="mt-1.5 text-xs text-slate-500 font-medium">BIN: {initialParties.notifyPartyBin}</p>
                )}
              </div>
            ) : (
              <p className="text-slate-400 text-xs italic">- Not set -</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
