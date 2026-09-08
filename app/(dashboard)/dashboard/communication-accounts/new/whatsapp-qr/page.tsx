import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { canStartQrSession } from "@/lib/communications/providers/whatsapp-web-qr";
import { requirePermission } from "@/lib/permissions/rbac";

export default async function WhatsAppQrPage() {
  await requirePermission("communicationAccounts:connect");
  const enabled = canStartQrSession();
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 lg:p-6">
      <div><Badge variant="warning">Experimental</Badge><h1 className="mt-3 text-2xl font-semibold">WhatsApp QR Connection</h1></div>
      {!enabled ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="font-semibold">QR connector disabled</h2>
          <p className="mt-2 text-sm text-slate-600">Set WHATSAPP_WEB_QR_ENABLED=true to expose the experimental adapter. WhatsApp Cloud API remains the recommended production option.</p>
        </div>
      ) : (
        <div className="space-y-4 rounded-lg border border-amber-200 bg-amber-50 p-6">
          <h2 className="font-semibold text-amber-900">Experimental QR connector placeholder</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-amber-900">
            <li>Not recommended for production.</li>
            <li>Linked-device sessions may disconnect.</li>
            <li>No unofficial WhatsApp Web library is installed.</li>
            <li>No raw session secret is stored.</li>
          </ul>
          <div className="flex h-48 items-center justify-center rounded-md border border-dashed border-amber-400 bg-white text-sm text-slate-500">QR session adapter not connected</div>
          <Button disabled type="button">Start QR session</Button>
        </div>
      )}
    </main>
  );
}
