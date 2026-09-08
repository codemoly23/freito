import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createWhatsAppCloudAccount } from "@/lib/actions/communication-accounts";
import { requirePermission } from "@/lib/permissions/rbac";

export default async function NewWhatsAppCloudAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requirePermission("communicationAccounts:connect");
  const { error } = await searchParams;
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 lg:p-6">
      <div><Badge variant="success">Recommended production provider</Badge><h1 className="mt-3 text-2xl font-semibold">Add WhatsApp Cloud API Account</h1><p className="mt-1 text-sm text-slate-600">Only approved-template outbox deliveries can be sent in this phase.</p></div>
      {error ? <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      <form action={createWhatsAppCloudAccount} className="grid gap-4 rounded-lg border bg-white p-5 md:grid-cols-2">
        <label className="space-y-1 text-sm"><span>Display name</span><Input name="displayName" required /></label>
        <label className="space-y-1 text-sm"><span>Ownership</span><select className="h-10 w-full rounded-md border px-3" name="ownership"><option value="company">Company account</option><option value="user">My employee account</option></select></label>
        <label className="space-y-1 text-sm"><span>Phone number ID</span><Input name="phoneNumberId" required /></label>
        <label className="space-y-1 text-sm"><span>Business account ID (optional)</span><Input name="businessAccountId" /></label>
        <label className="space-y-1 text-sm"><span>Sender phone (optional)</span><Input name="senderPhone" /></label>
        <label className="space-y-1 text-sm"><span>Default language</span><Input defaultValue="en_US" name="defaultLanguage" required /></label>
        <label className="space-y-1 text-sm md:col-span-2"><span>Access token</span><Input autoComplete="new-password" name="accessToken" required type="password" /></label>
        <label className="space-y-1 text-sm"><span>Test recipient (optional)</span><Input name="testRecipient" /></label>
        <div className="md:col-span-2"><Button type="submit">Save WhatsApp Cloud account</Button></div>
      </form>
    </main>
  );
}
