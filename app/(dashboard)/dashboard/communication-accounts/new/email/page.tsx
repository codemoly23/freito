import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createEmailSmtpAccount } from "@/lib/actions/communication-accounts";
import { requirePermission } from "@/lib/permissions/rbac";

export default async function NewEmailAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requirePermission("communicationAccounts:connect");
  const { error } = await searchParams;
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 lg:p-6">
      <div><Badge variant="secondary">Phase 8C</Badge><h1 className="mt-3 text-2xl font-semibold">Add Email SMTP Account</h1><p className="mt-1 text-sm text-slate-600">Credentials are encrypted server-side and are never shown after saving.</p></div>
      {error ? <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      <form action={createEmailSmtpAccount} className="grid gap-4 rounded-lg border bg-white p-5 md:grid-cols-2">
        <label className="space-y-1 text-sm"><span>Display name</span><Input name="displayName" required /></label>
        <label className="space-y-1 text-sm"><span>Ownership</span><select className="h-10 w-full rounded-md border px-3" name="ownership"><option value="company">Company account</option><option value="user">My employee account</option></select></label>
        <label className="space-y-1 text-sm"><span>SMTP host</span><Input name="host" required /></label>
        <label className="space-y-1 text-sm"><span>SMTP port</span><Input defaultValue="587" min="1" name="port" required type="number" /></label>
        <label className="space-y-1 text-sm"><span>Secure connection</span><select className="h-10 w-full rounded-md border px-3" name="secure"><option value="false">STARTTLS / provider default</option><option value="true">TLS immediately</option></select></label>
        <label className="space-y-1 text-sm"><span>Username</span><Input autoComplete="off" name="username" required /></label>
        <label className="space-y-1 text-sm"><span>Password</span><Input autoComplete="new-password" name="password" required type="password" /></label>
        <label className="space-y-1 text-sm"><span>From email</span><Input name="fromEmail" required type="email" /></label>
        <label className="space-y-1 text-sm"><span>From name</span><Input name="fromName" /></label>
        <label className="space-y-1 text-sm"><span>Test recipient (optional)</span><Input name="testRecipient" type="email" /></label>
        <div className="md:col-span-2"><Button type="submit">Save SMTP account</Button></div>
      </form>
    </main>
  );
}
