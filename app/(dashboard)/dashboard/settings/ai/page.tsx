import { AiSettingsForm } from "@/components/forms/ai-settings-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { saveAiSettings, testAiConnection } from "@/lib/actions/ai-settings";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/permissions/rbac";

export default async function AiSettingsPage() {
  const user = await requirePermission("ai:configure");
  const companyId = user.companyId ?? "";
  const settings = await prisma.companyaisettings.findUnique({ where: { companyId } });
  const platformEnabled = process.env.AI_ENABLED === "true";
  const hasPlatformKey = Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim());

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-semibold">AI Settings</h1>
        <p className="mt-1 text-sm text-slate-600">
          Control whether AI-powered features are available for this company, and optionally use your own provider key.
        </p>
      </div>

      {!platformEnabled ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400">
          AI is disabled at the platform/installation level (<code>AI_ENABLED</code> is not set to <code>true</code>). Enabling it below will have no effect until an administrator turns it on for this installation.
        </div>
      ) : null}
      {platformEnabled && !hasPlatformKey && !settings?.encryptedApiKey ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400">
          No platform default API key is configured and this company has not saved its own key yet. AI calls will fail with &quot;not configured&quot; until a key is provided below.
        </div>
      ) : null}

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Provider Configuration</CardTitle>
          <CardDescription>Currently supports Google Gemini. Additional providers will be added in a later update.</CardDescription>
        </CardHeader>
        <CardContent>
          <AiSettingsForm
            key={`${settings?.enabled ?? false}|${settings?.dailyRequestCap ?? ""}|${Boolean(settings?.encryptedApiKey)}`}
            action={saveAiSettings}
            initialValues={{
              enabled: settings?.enabled ?? false,
              hasApiKey: Boolean(settings?.encryptedApiKey),
              dailyRequestCap: settings?.dailyRequestCap ?? null,
            }}
          />
        </CardContent>
      </Card>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Connection Test</CardTitle>
          <CardDescription>Send a small test prompt using the current settings above (saved settings only; save first).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <form action={testAiConnection}>
            <Button type="submit" variant="outline">Test Connection</Button>
          </form>
          {settings?.lastTestedAt ? (
            <div className="text-sm text-slate-600">
              <p>
                Last tested: {settings.lastTestedAt.toLocaleString()}
                {settings.lastTestResult?.startsWith("OK") ? (
                  <Badge variant="success" className="ml-2">Success</Badge>
                ) : (
                  <Badge variant="danger" className="ml-2">Failed</Badge>
                )}
              </p>
              <p className="mt-1 font-mono text-xs text-slate-500">{settings.lastTestResult}</p>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Not tested yet.</p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
