"use client";

import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { createShareOutbox } from "@/lib/actions/share";

export function ShareButton({
  resourceType,
  resourceId,
  whatsappUrl,
  emailUrl,
  internalLink,
  downloadUrl,
  printUrl,
  canCreateOutbox,
}: {
  resourceType: string;
  resourceId: string;
  whatsappUrl: string;
  emailUrl: string;
  internalLink: string;
  downloadUrl?: string | null;
  printUrl?: string | null;
  canCreateOutbox: boolean;
}) {
  const hydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const [open, setOpen] = useState(false);
  return <div className="relative">
    <Button type="button" variant="outline" disabled={!hydrated} onClick={() => setOpen((value) => !value)}>Share</Button>
    {open ? <div className="absolute right-0 z-20 mt-2 w-80 space-y-3 rounded-lg border bg-white p-4 shadow-lg">
      <p className="font-semibold">Share client-safe copy</p>
      <div className="grid gap-2">
        <Button asChild variant="outline"><a href={whatsappUrl} rel="noreferrer" target="_blank">WhatsApp</a></Button>
        <Button asChild variant="outline"><a href={emailUrl}>Email</a></Button>
        <Button type="button" variant="outline" onClick={() => navigator.clipboard.writeText(internalLink)}>Copy Link</Button>
        {printUrl ? <Button asChild variant="outline"><a href={printUrl} target="_blank">Print</a></Button> : null}
        {downloadUrl ? <Button asChild variant="outline"><a download href={downloadUrl}>Download PDF</a></Button> : <p className="rounded-md bg-slate-50 p-2 text-center text-xs text-slate-500">Download not available yet.</p>}
      </div>
      {canCreateOutbox ? <div className="grid grid-cols-2 gap-2 border-t pt-3">
        {(["EMAIL", "WHATSAPP"] as const).map((channel) => <form action={createShareOutbox} key={channel}><input name="resourceType" type="hidden" value={resourceType} /><input name="resourceId" type="hidden" value={resourceId} /><input name="channel" type="hidden" value={channel} /><Button className="w-full" size="sm" type="submit">Queue {channel === "EMAIL" ? "Email" : "WhatsApp"}</Button></form>)}
      </div> : null}
      <p className="text-xs text-slate-500">WhatsApp and email redirects only prefill content. You must press Send in the destination app.</p>
    </div> : null}
  </div>;
}
