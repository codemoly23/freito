"use client";

import { useActionState, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import type { ActionState } from "@/lib/actions/helpers";
import { currencies } from "@/lib/validators/finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;
const initialState: ActionState = {};
const inputClass = "h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm";

function Alert({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return (
    <p className={state.ok ? "rounded-md bg-emerald-50 p-3 text-sm text-emerald-800" : "rounded-md bg-red-50 p-3 text-sm text-red-800"}>
      {state.message}
    </p>
  );
}

export function LedgerAccountForm({
  action,
  ledgerGroups,
  ledgerAccount,
}: {
  action: FormAction;
  ledgerGroups: { id: string; name: string }[];
  ledgerAccount?: { id: string; ledgerGroupId: string; name: string; openingBalance: string; openingBalanceSide: string } | null;
}) {
  const [state, formAction] = useActionState(action, initialState);
  return (
    <form action={formAction} className="space-y-4">
      <Alert state={state} />
      <input type="hidden" name="id" defaultValue={ledgerAccount?.id ?? ""} />
      <div className="space-y-2">
        <Label htmlFor="ledger-group">Ledger group</Label>
        <select id="ledger-group" name="ledgerGroupId" defaultValue={ledgerAccount?.ledgerGroupId ?? ""} required className={inputClass}>
          <option value="">Select group</option>
          {ledgerGroups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="ledger-name">Ledger name</Label>
        <Input id="ledger-name" name="name" defaultValue={ledgerAccount?.name ?? ""} required />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="ledger-opening-balance">Opening balance</Label>
          <Input id="ledger-opening-balance" name="openingBalance" type="number" min="0" step="0.01" defaultValue={ledgerAccount?.openingBalance ?? "0"} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ledger-opening-side">Opening balance side</Label>
          <select id="ledger-opening-side" name="openingBalanceSide" defaultValue={ledgerAccount?.openingBalanceSide ?? "DEBIT"} className={inputClass}>
            <option value="DEBIT">Debit</option>
            <option value="CREDIT">Credit</option>
          </select>
        </div>
      </div>
      <Button type="submit" className="w-full">
        <Save className="h-4 w-4" />
        {ledgerAccount ? "Update ledger account" : "Create ledger account"}
      </Button>
    </form>
  );
}

export function OpeningBalancesForm({
  action,
  booksOpeningDate,
  groups,
}: {
  action: FormAction;
  booksOpeningDate: string;
  groups: {
    groupId: string;
    groupName: string;
    accounts: { id: string; name: string; openingBalance: string; openingBalanceSide: string }[];
  }[];
}) {
  const [state, formAction] = useActionState(action, initialState);
  return (
    <form action={formAction} className="space-y-6">
      <Alert state={state} />
      <div className="max-w-xs space-y-2">
        <Label htmlFor="books-opening-date">Books opening date</Label>
        <Input id="books-opening-date" name="booksOpeningDate" type="date" defaultValue={booksOpeningDate} />
        <p className="text-xs text-slate-500">
          The date these opening balances are as of. Reports default their &quot;From&quot; filter to this date.
        </p>
      </div>

      <div className="space-y-6">
        {groups.map((group) => (
          <div key={group.groupId} className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-wide text-cyan-800">{group.groupName}</p>
            <div className="divide-y divide-slate-100 rounded-md border border-slate-200">
              {group.accounts.map((account) => (
                <div key={account.id} className="grid grid-cols-[1fr_140px_120px] items-center gap-3 px-3 py-2">
                  <input type="hidden" name="openingLedgerAccountId" value={account.id} />
                  <span className="text-sm text-slate-800">{account.name}</span>
                  <Input
                    name="openingAmount"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={account.openingBalance !== "0" ? account.openingBalance : ""}
                    placeholder="0.00"
                  />
                  <select name="openingSide" defaultValue={account.openingBalanceSide} className={inputClass}>
                    <option value="DEBIT">Debit</option>
                    <option value="CREDIT">Credit</option>
                  </select>
                </div>
              ))}
              {!group.accounts.length ? <p className="px-3 py-3 text-sm text-slate-500">No ledgers in this group yet.</p> : null}
            </div>
          </div>
        ))}
      </div>

      <Button type="submit">
        <Save className="h-4 w-4" /> Save opening balances
      </Button>
    </form>
  );
}

type VoucherLine = { ledgerAccountId?: string; side?: string; amount?: string; lineNarration?: string };

export function JournalVoucherForm({
  action,
  ledgerAccounts,
}: {
  action: FormAction;
  ledgerAccounts: { id: string; name: string; groupName: string }[];
}) {
  const [state, formAction] = useActionState(action, initialState);
  const [lines, setLines] = useState<VoucherLine[]>([
    { side: "DEBIT" },
    { side: "CREDIT" },
  ]);

  return (
    <form action={formAction} className="space-y-4">
      <Alert state={state} />
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="voucher-date">Entry date</Label>
          <Input id="voucher-date" name="entryDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="voucher-currency">Currency</Label>
          <select id="voucher-currency" name="currency" defaultValue="BDT" className={inputClass}>
            {currencies.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="voucher-rate">FX to BDT</Label>
          <Input id="voucher-rate" name="exchangeRateToBDT" type="number" min="0.0001" step="0.0001" defaultValue="1" required />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="voucher-narration">Narration</Label>
        <Input id="voucher-narration" name="narration" placeholder="What is this entry for?" />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Voucher lines (must balance: total debit = total credit)</Label>
          <Button type="button" size="sm" variant="secondary" onClick={() => setLines((current) => [...current, { side: "DEBIT" }])}>
            <Plus className="h-4 w-4" /> Add line
          </Button>
        </div>
        {lines.map((line, index) => (
          <div key={index} className="grid gap-3 rounded-md border border-slate-200 p-3 md:grid-cols-[2fr_1fr_1fr_2fr_auto]">
            <select name="lineLedgerAccountId" defaultValue={line.ledgerAccountId ?? ""} required className={inputClass}>
              <option value="">Select ledger</option>
              {ledgerAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} ({account.groupName})
                </option>
              ))}
            </select>
            <select name="lineSide" defaultValue={line.side ?? "DEBIT"} className={inputClass}>
              <option value="DEBIT">Debit</option>
              <option value="CREDIT">Credit</option>
            </select>
            <Input name="lineAmount" type="number" min="0.01" step="0.01" defaultValue={line.amount ?? ""} placeholder="Amount" required />
            <Input name="lineNarration" defaultValue={line.lineNarration ?? ""} placeholder="Line note (optional)" />
            <Button
              aria-label={`Remove line ${index + 1}`}
              title={`Remove line ${index + 1}`}
              type="button"
              size="icon"
              variant="outline"
              disabled={lines.length === 2}
              onClick={() => setLines((current) => current.filter((_, itemIndex) => itemIndex !== index))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <Button type="submit">
        <Save className="h-4 w-4" /> Post journal voucher
      </Button>
    </form>
  );
}
