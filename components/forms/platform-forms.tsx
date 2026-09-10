"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";
import type { ActionState } from "@/lib/actions/helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FormAction = (
  state: ActionState,
  formData: FormData,
) => Promise<ActionState>;

type PlatformCompany = {
  id: string;
  name: string;
  legalName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  country: string | null;
  baseCurrency: string;
  status: string;
  planType: string;
  deploymentType: string;
  subscriptionStatus: string;
  trialEndsAt: Date | null;
  subscriptionEndsAt: Date | null;
  maxUsers: number | null;
  storageLimitMB: number | null;
  portalSlug: string | null;
  portalDisplayName: string | null;
  portalCodePrefix: string | null;
  portalEnabled: boolean;
  moduleAccess: { moduleKey: string; isEnabled: boolean }[];
};

const initialState: ActionState = {};
const planTypes = ["TRIAL", "MONTHLY", "YEARLY", "LIFETIME_CLOUD", "SELF_HOSTED"];
const deploymentTypes = ["CLOUD", "SELF_HOSTED"];
const subscriptionStatuses = ["TRIAL", "ACTIVE", "PAST_DUE", "SUSPENDED", "EXPIRED", "CANCELLED"];
const currencyOptions = ["BDT", "USD", "EUR", "GBP", "CNY", "INR", "AED", "RUB", "OTHER"];
const moduleKeys = [
  "SHIPMENTS",
  "DOCUMENTS",
  "QUOTATIONS",
  "COSTING",
  "BILLING",
  "REPORTS",
  "CLIENT_PORTAL",
  "WHATSAPP_ALERTS",
  "API_ACCESS",
];

function dateValue(value: Date | null | undefined) {
  if (!value) return "";
  return value.toISOString().slice(0, 10);
}

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return <p className="text-xs font-medium text-red-600">{errors[0]}</p>;
}

function FormAlert({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return (
    <div
      className={
        state.ok
          ? "rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
          : "rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
      }
    >
      {state.message}
    </div>
  );
}

export function PlatformCompanyForm({
  action,
  editing,
}: {
  action: FormAction;
  editing: PlatformCompany | null;
}) {
  const [state, formAction] = useActionState(action, initialState);
  const enabledModules = new Set(
    editing?.moduleAccess.filter((item) => item.isEnabled).map((item) => item.moduleKey) ??
      ["SHIPMENTS", "DOCUMENTS", "QUOTATIONS", "COSTING"],
  );

  return (
    <form action={formAction} className="space-y-5">
      <FormAlert state={state} />
      <input type="hidden" name="id" defaultValue={editing?.id ?? ""} />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Company name</Label>
          <Input id="name" name="name" defaultValue={editing?.name ?? ""} required />
          <FieldError errors={state.errors?.name} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="legalName">Legal name</Label>
          <Input id="legalName" name="legalName" defaultValue={editing?.legalName ?? ""} />
          <FieldError errors={state.errors?.legalName} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field name="email" label="Email" type="email" value={editing?.email} errors={state.errors?.email} />
        <Field name="phone" label="Phone" value={editing?.phone} errors={state.errors?.phone} />
      </div>
      <Field name="address" label="Address" value={editing?.address} errors={state.errors?.address} />

      <div className="grid gap-4 md:grid-cols-2">
        <Field name="country" label="Country" value={editing?.country} errors={state.errors?.country} />
        <Select
          name="baseCurrency"
          label="Base currency"
          value={editing?.baseCurrency ?? "BDT"}
          options={currencyOptions}
          errors={state.errors?.baseCurrency}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Select name="status" label="Company status" value={editing?.status ?? "ACTIVE"} options={["ACTIVE", "SUSPENDED"]} errors={state.errors?.status} />
        <Select name="planType" label="Plan type" value={editing?.planType ?? "TRIAL"} options={planTypes} errors={state.errors?.planType} />
        <Select name="deploymentType" label="Deployment" value={editing?.deploymentType ?? "CLOUD"} options={deploymentTypes} errors={state.errors?.deploymentType} />
        <Select name="subscriptionStatus" label="Subscription" value={editing?.subscriptionStatus ?? "TRIAL"} options={subscriptionStatuses} errors={state.errors?.subscriptionStatus} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Field name="trialEndsAt" label="Trial ends" type="date" value={dateValue(editing?.trialEndsAt)} errors={state.errors?.trialEndsAt} />
        <Field name="subscriptionEndsAt" label="Subscription ends" type="date" value={dateValue(editing?.subscriptionEndsAt)} errors={state.errors?.subscriptionEndsAt} />
        <Field name="maxUsers" label="Max users" type="number" value={editing?.maxUsers} errors={state.errors?.maxUsers} />
        <Field name="storageLimitMB" label="Storage limit MB" type="number" value={editing?.storageLimitMB} errors={state.errors?.storageLimitMB} />
      </div>

      <div className="space-y-4 rounded-md border border-cyan-200 bg-cyan-50/50 p-4">
        <div>
          <p className="font-medium text-slate-950">Client portal settings</p>
          <p className="text-sm text-slate-600">Company-branded URL and Client ID prefix.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Field name="portalSlug" label="Portal slug" value={editing?.portalSlug} errors={state.errors?.portalSlug} />
          <Field name="portalDisplayName" label="Portal display name" value={editing?.portalDisplayName} errors={state.errors?.portalDisplayName} />
          <Field name="portalCodePrefix" label="Client code prefix" value={editing?.portalCodePrefix} errors={state.errors?.portalCodePrefix} />
        </div>
        <label className="flex items-center gap-3 text-sm font-medium text-slate-950">
          <input type="checkbox" name="portalEnabled" value="true" defaultChecked={editing?.portalEnabled ?? false} />
          Enable company client portal
        </label>
        <FieldError errors={state.errors?.portalEnabled} />
      </div>

      <div className="space-y-3">
        <Label>Enabled modules</Label>
        <div className="grid gap-2 md:grid-cols-2">
          {moduleKeys.map((moduleKey) => (
            <label key={moduleKey} className="flex items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
              <input
                type="checkbox"
                name="enabledModules"
                value={moduleKey}
                defaultChecked={enabledModules.has(moduleKey)}
                className="h-4 w-4 rounded border-slate-300"
              />
              {moduleKey.replaceAll("_", " ")}
            </label>
          ))}
        </div>
        <FieldError errors={state.errors?.enabledModules} />
      </div>

      <Button type="submit">
        <Save className="h-4 w-4" />
        {editing ? "Update platform company" : "Create platform company"}
      </Button>
    </form>
  );
}

function Field({
  name,
  label,
  value,
  type = "text",
  errors,
}: {
  name: string;
  label: string;
  value?: string | number | null;
  type?: string;
  errors?: string[];
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} defaultValue={value ?? ""} />
      <FieldError errors={errors} />
    </div>
  );
}

export function ExchangeRateForm({ action }: { action: FormAction }) {
  const [state, formAction] = useActionState(action, initialState);
  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
      <FormAlert state={state} />
      <Select name="currency" label="Currency" value="USD" options={currencyOptions} errors={state.errors?.currency} />
      <Field name="rateToUSD" label="Rate to USD (1 unit = ? USD)" type="number" errors={state.errors?.rateToUSD} />
      <Field name="effectiveDate" label="Effective date" type="date" value={new Date().toISOString().slice(0, 10)} errors={state.errors?.effectiveDate} />
      <div className="flex items-end">
        <Button type="submit" className="w-full">
          <Save className="h-4 w-4" /> Save rate
        </Button>
      </div>
    </form>
  );
}

function Select({
  name,
  label,
  value,
  options,
  errors,
}: {
  name: string;
  label: string;
  value: string;
  options: string[];
  errors?: string[];
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <select
        id={name}
        name={name}
        defaultValue={value}
        className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option.replaceAll("_", " ")}
          </option>
        ))}
      </select>
      <FieldError errors={errors} />
    </div>
  );
}
