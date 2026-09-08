"use client";

import { useActionState, useState } from "react";
import { ChevronDown, ChevronUp, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { saveDocumentTemplateVersion } from "@/lib/actions/document-templates";
import type { ActionState } from "@/lib/actions/helpers";

const initialState: ActionState = {};

export function TemplateEditor({
  templateId,
  sectionLabels,
  initialOrder,
  initialHidden,
  initialCustomNoteText,
  showCustomNoteText = true,
}: {
  templateId: string;
  sectionLabels: Record<string, string>;
  initialOrder: string[];
  initialHidden: string[];
  initialCustomNoteText: string;
  /** Freight document layouts (HBL/HAWB/DEBIT_NOTE/MANIFEST) have no free-text
   * placeholder slot in their print output, so this field is hidden -- and
   * not submitted -- for those document types. */
  showCustomNoteText?: boolean;
}) {
  const [order, setOrder] = useState<string[]>(initialOrder);
  const [hidden, setHidden] = useState<string[]>(initialHidden);
  const [state, formAction] = useActionState(saveDocumentTemplateVersion, initialState);

  function moveUp(index: number) {
    if (index === 0) return;
    setOrder((current) => {
      const next = [...current];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }

  function moveDown(index: number) {
    setOrder((current) => {
      if (index >= current.length - 1) return current;
      const next = [...current];
      [next[index + 1], next[index]] = [next[index], next[index + 1]];
      return next;
    });
  }

  function toggleHidden(key: string) {
    setHidden((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="templateId" value={templateId} />
      <input type="hidden" name="order" value={JSON.stringify(order)} />
      <input type="hidden" name="hidden" value={JSON.stringify(hidden)} />

      <div>
        <p className="text-sm font-medium text-slate-900">Section order and visibility</p>
        <p className="mt-1 text-xs text-slate-500">
          Use the arrows to reorder sections and the eye icon to show or hide one.
        </p>
        <ul className="mt-3 space-y-1.5">
          {order.map((key, index) => {
            const isHidden = hidden.includes(key);
            return (
              <li
                key={key}
                className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm"
              >
                <span className={isHidden ? "text-slate-400 line-through" : "text-slate-800"}>
                  {sectionLabels[key] ?? key}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label={`Move ${sectionLabels[key] ?? key} up`}
                    disabled={index === 0}
                    className="rounded p-1 text-slate-500 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-30"
                    onClick={() => moveUp(index)}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${sectionLabels[key] ?? key} down`}
                    disabled={index === order.length - 1}
                    className="rounded p-1 text-slate-500 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-30"
                    onClick={() => moveDown(index)}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={isHidden ? `Show ${sectionLabels[key] ?? key}` : `Hide ${sectionLabels[key] ?? key}`}
                    aria-pressed={isHidden}
                    className="rounded p-1 text-slate-500 hover:bg-slate-200"
                    onClick={() => toggleHidden(key)}
                  >
                    {isHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {showCustomNoteText ? (
        <div>
          <label className="text-sm font-medium text-slate-900" htmlFor="customNoteText">
            Custom notes / terms text
          </label>
          <p className="mt-1 text-xs text-slate-500">
            Leave blank to keep the default text. Allowed placeholders:{" "}
            <code>{"{{companyName}}"}</code>, <code>{"{{customerName}}"}</code>, <code>{"{{documentNo}}"}</code>,{" "}
            <code>{"{{documentDate}}"}</code>. Any other <code>{"{{...}}"}</code> text is left as-is, not substituted.
          </p>
          <textarea
            id="customNoteText"
            name="customNoteText"
            defaultValue={initialCustomNoteText}
            maxLength={500}
            rows={4}
            className="mt-2 w-full rounded-md border border-slate-200 p-3 text-sm"
            placeholder="e.g. Thank you for choosing {{companyName}}. Please reference {{documentNo}} in all correspondence."
          />
        </div>
      ) : null}

      {state.message ? (
        <p className={`text-sm ${state.ok ? "text-emerald-600" : "text-red-600"}`}>{state.message}</p>
      ) : null}

      <Button type="submit">Save layout</Button>
    </form>
  );
}
