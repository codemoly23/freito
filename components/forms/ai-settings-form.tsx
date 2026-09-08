"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/actions/helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AiSettingsForm({
  action,
  initialValues,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  initialValues: {
    enabled: boolean;
    hasApiKey: boolean;
    dailyRequestCap: number | null;
  };
}) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="enabled">AI Features</Label>
        <select
          id="enabled"
          name="enabled"
          className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          defaultValue={initialValues.enabled ? "true" : "false"}
          required
        >
          <option value="false">Disabled for this company</option>
          <option value="true">Enabled for this company</option>
        </select>
        <p className="text-xs text-slate-500">
          Also requires AI to be enabled at the platform/installation level. If it is not, this stays off regardless of this setting.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="apiKey">Google Gemini API Key {initialValues.hasApiKey ? "(configured)" : "(using platform default, if any)"}</Label>
        <Input id="apiKey" name="apiKey" type="password" autoComplete="off" placeholder={initialValues.hasApiKey ? "Leave blank to keep the current key" : "Leave blank to use the platform default key"} />
        <p className="text-xs text-slate-500">Only Gemini is supported currently. Stored encrypted; never shown again after saving.</p>
        {initialValues.hasApiKey ? (
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" name="clearApiKey" value="true" className="h-3.5 w-3.5" />
            Remove the company key and fall back to the platform default
          </label>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="dailyRequestCap">Daily Request Cap</Label>
        <Input
          id="dailyRequestCap"
          name="dailyRequestCap"
          type="number"
          min="1"
          defaultValue={initialValues.dailyRequestCap ?? ""}
          placeholder="Platform default"
        />
        <p className="text-xs text-slate-500">Maximum AI calls this company can make per day. Leave blank to use the platform default.</p>
      </div>

      <Button type="submit">Save AI Settings</Button>
      {state.message ? (
        <p className={state.ok ? "text-sm text-emerald-700 dark:text-emerald-400 font-medium" : "text-sm text-red-600 dark:text-red-400 font-medium"}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
