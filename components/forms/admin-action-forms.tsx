"use client";

import { useActionState } from "react";
import { Building2, Plus, ShieldCheck, UserPlus, Users } from "lucide-react";
import type { ActionState } from "@/lib/actions/helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FormAction = (
  state: ActionState,
  formData: FormData,
) => Promise<ActionState>;

const initialState: ActionState = {};

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

export function CompanyForm({
  action,
  editing,
}: {
  action: FormAction;
  editing: {
    id: string;
    name: string;
    legalName: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    status: string;
  } | null;
}) {
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <FormAlert state={state} />
      <input type="hidden" name="id" defaultValue={editing?.id ?? ""} />
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
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" defaultValue={editing?.email ?? ""} />
          <FieldError errors={state.errors?.email} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" defaultValue={editing?.phone ?? ""} />
          <FieldError errors={state.errors?.phone} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="address">Address</Label>
        <Input id="address" name="address" defaultValue={editing?.address ?? ""} />
        <FieldError errors={state.errors?.address} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="status">Status</Label>
        <select
          id="status"
          name="status"
          defaultValue={editing?.status ?? "ACTIVE"}
          className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
        </select>
        <FieldError errors={state.errors?.status} />
      </div>
      <Button type="submit" className="w-full">
        <Plus className="h-4 w-4" />
        {editing ? "Update company" : "Create company"}
      </Button>
    </form>
  );
}

export function UserForm({
  action,
  editing,
  companies,
  roles,
  isSuperAdmin,
  defaultCompanyId,
  selectedRoleIds,
}: {
  action: FormAction;
  editing: {
    id: string;
    companyId: string | null;
    name: string;
    email: string;
    phone: string | null;
    designation: string | null;
    status: string;
  } | null;
  companies: { id: string; name: string }[];
  roles: { id: string; name: string; company?: { name: string } | null }[];
  isSuperAdmin: boolean;
  defaultCompanyId: string;
  selectedRoleIds: string[];
}) {
  const [state, formAction] = useActionState(action, initialState);
  const selected = new Set(selectedRoleIds);

  return (
    <form action={formAction} className="space-y-4">
      <FormAlert state={state} />
      <input type="hidden" name="id" defaultValue={editing?.id ?? ""} />
      <div className="space-y-2">
        <Label htmlFor="companyId">Company</Label>
        <select
          id="companyId"
          name="companyId"
          defaultValue={defaultCompanyId}
          disabled={!isSuperAdmin}
          className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
        >
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </select>
        {!isSuperAdmin ? <input type="hidden" name="companyId" value={defaultCompanyId} /> : null}
        <FieldError errors={state.errors?.companyId} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" defaultValue={editing?.name ?? ""} required />
          <FieldError errors={state.errors?.name} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" defaultValue={editing?.email ?? ""} required />
          <FieldError errors={state.errors?.email} />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder={editing ? "Leave blank to keep current" : "Temporary password"}
            required={!editing}
          />
          <FieldError errors={state.errors?.password} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="designation">Designation</Label>
          <Input id="designation" name="designation" defaultValue={editing?.designation ?? ""} />
          <FieldError errors={state.errors?.designation} />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" defaultValue={editing?.phone ?? ""} />
          <FieldError errors={state.errors?.phone} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            name="status"
            defaultValue={editing?.status ?? "ACTIVE"}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="ACTIVE">Active</option>
            <option value="INVITED">Invited</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
          <FieldError errors={state.errors?.status} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Roles</Label>
        <div className="grid gap-2 rounded-md border border-slate-200 p-3 md:grid-cols-2">
          {roles.map((role) => (
            <label key={role.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="roleIds"
                value={role.id}
                defaultChecked={selected.has(role.id)}
              />
              <span>{role.name}</span>
              {isSuperAdmin ? (
                <span className="text-xs text-slate-400">{role.company?.name}</span>
              ) : null}
            </label>
          ))}
        </div>
        <FieldError errors={state.errors?.roleIds} />
      </div>
      <Button type="submit" className="w-full">
        <UserPlus className="h-4 w-4" />
        {editing ? "Update user" : "Create user"}
      </Button>
    </form>
  );
}

export function CustomerForm({
  action,
  editing,
  activeCompanyId,
  primaryContact,
}: {
  action: FormAction;
  editing: {
    id: string;
    name: string;
    code: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    binOrVat: string | null;
    status: string;
  } | null;
  activeCompanyId: string;
  primaryContact?: {
    name: string;
    email: string | null;
    phone: string | null;
    designation: string | null;
  };
}) {
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <FormAlert state={state} />
      <input type="hidden" name="id" defaultValue={editing?.id ?? ""} />
      <input type="hidden" name="companyId" value={activeCompanyId} />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Customer name</Label>
          <Input id="name" name="name" defaultValue={editing?.name ?? ""} required />
          <FieldError errors={state.errors?.name} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="code">Customer code</Label>
          <Input id="code" name="code" defaultValue={editing?.code ?? ""} />
          <FieldError errors={state.errors?.code} />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" defaultValue={editing?.email ?? ""} />
          <FieldError errors={state.errors?.email} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" defaultValue={editing?.phone ?? ""} />
          <FieldError errors={state.errors?.phone} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="address">Address</Label>
        <Input id="address" name="address" defaultValue={editing?.address ?? ""} />
        <FieldError errors={state.errors?.address} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="binOrVat">BIN / VAT</Label>
          <Input id="binOrVat" name="binOrVat" defaultValue={editing?.binOrVat ?? ""} />
          <FieldError errors={state.errors?.binOrVat} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            name="status"
            defaultValue={editing?.status ?? "ACTIVE"}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
          <FieldError errors={state.errors?.status} />
        </div>
      </div>
      <div className="rounded-md border border-slate-200 p-3">
        <p className="mb-3 text-sm font-medium text-slate-950">Primary contact</p>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="contactName">Contact name</Label><Input id="contactName" name="contactName" defaultValue={primaryContact?.name ?? ""} /></div>
          <div className="space-y-2"><Label htmlFor="contactEmail">Contact email</Label><Input id="contactEmail" name="contactEmail" type="email" defaultValue={primaryContact?.email ?? ""} /></div>
          <div className="space-y-2"><Label htmlFor="contactPhone">Contact phone</Label><Input id="contactPhone" name="contactPhone" defaultValue={primaryContact?.phone ?? ""} /></div>
          <div className="space-y-2"><Label htmlFor="contactDesignation">Contact designation</Label><Input id="contactDesignation" name="contactDesignation" defaultValue={primaryContact?.designation ?? ""} /></div>
        </div>
        <FieldError errors={state.errors?.contactEmail} />
      </div>
      <Button type="submit" className="w-full">
        <Users className="h-4 w-4" />
        {editing ? "Update customer" : "Create customer"}
      </Button>
    </form>
  );
}

export function VendorForm({
  action,
  editing,
  activeCompanyId,
  primaryContact,
  vendorTypes,
}: {
  action: FormAction;
  editing: {
    id: string;
    name: string;
    type: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    paymentTerms: string | null;
    notes: string | null;
    status: string;
  } | null;
  activeCompanyId: string;
  primaryContact?: {
    name: string;
    email: string | null;
    phone: string | null;
    designation: string | null;
  };
  vendorTypes: string[];
}) {
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <FormAlert state={state} />
      <input type="hidden" name="id" defaultValue={editing?.id ?? ""} />
      <input type="hidden" name="companyId" value={activeCompanyId} />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Vendor name</Label>
          <Input id="name" name="name" defaultValue={editing?.name ?? ""} required />
          <FieldError errors={state.errors?.name} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="type">Vendor type</Label>
          <select
            id="type"
            name="type"
            defaultValue={editing?.type ?? "OTHER"}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            {vendorTypes.map((type) => (
              <option key={type} value={type}>
                {type.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          <FieldError errors={state.errors?.type} />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" defaultValue={editing?.email ?? ""} />
          <FieldError errors={state.errors?.email} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" defaultValue={editing?.phone ?? ""} />
          <FieldError errors={state.errors?.phone} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="address">Address</Label>
        <Input id="address" name="address" defaultValue={editing?.address ?? ""} />
        <FieldError errors={state.errors?.address} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="paymentTerms">Payment terms</Label>
          <Input id="paymentTerms" name="paymentTerms" defaultValue={editing?.paymentTerms ?? ""} />
          <FieldError errors={state.errors?.paymentTerms} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            name="status"
            defaultValue={editing?.status ?? "ACTIVE"}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
          <FieldError errors={state.errors?.status} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <textarea
          id="notes"
          name="notes"
          defaultValue={editing?.notes ?? ""}
          className="min-h-20 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
        />
        <FieldError errors={state.errors?.notes} />
      </div>
      <div className="rounded-md border border-slate-200 p-3">
        <p className="mb-3 text-sm font-medium text-slate-950">Primary contact</p>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="contactName">Contact name</Label><Input id="contactName" name="contactName" defaultValue={primaryContact?.name ?? ""} /></div>
          <div className="space-y-2"><Label htmlFor="contactEmail">Contact email</Label><Input id="contactEmail" name="contactEmail" type="email" defaultValue={primaryContact?.email ?? ""} /></div>
          <div className="space-y-2"><Label htmlFor="contactPhone">Contact phone</Label><Input id="contactPhone" name="contactPhone" defaultValue={primaryContact?.phone ?? ""} /></div>
          <div className="space-y-2"><Label htmlFor="contactDesignation">Contact designation</Label><Input id="contactDesignation" name="contactDesignation" defaultValue={primaryContact?.designation ?? ""} /></div>
        </div>
        <FieldError errors={state.errors?.contactEmail} />
      </div>
      <Button type="submit" className="w-full">
        <Building2 className="h-4 w-4" />
        {editing ? "Update vendor" : "Create vendor"}
      </Button>
    </form>
  );
}

export function RolePermissionsForm({
  action,
  roleId,
  permissions,
  selectedPermissionIds,
}: {
  action: FormAction;
  roleId: string;
  permissions: { id: string; key: string; name: string }[];
  selectedPermissionIds: string[];
}) {
  const [state, formAction] = useActionState(action, initialState);
  const selected = new Set(selectedPermissionIds);

  return (
    <form action={formAction} className="space-y-4">
      <FormAlert state={state} />
      <input type="hidden" name="roleId" value={roleId} />
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {permissions.map((permission) => (
          <label
            key={permission.id}
            className="flex items-start gap-2 rounded-md border border-slate-200 bg-white p-3 text-sm"
          >
            <input
              type="checkbox"
              name="permissionIds"
              value={permission.id}
              defaultChecked={selected.has(permission.id)}
              className="mt-1"
            />
            <span>
              <span className="block font-medium text-slate-950">
                {permission.key}
              </span>
              <span className="text-xs text-slate-500">{permission.name}</span>
            </span>
          </label>
        ))}
      </div>
      <FieldError errors={state.errors?.permissionIds} />
      <Button type="submit">
        <ShieldCheck className="h-4 w-4" />
        Save permissions
      </Button>
    </form>
  );
}
