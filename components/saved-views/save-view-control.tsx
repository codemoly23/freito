"use client";

import { useActionState, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bookmark, ChevronDown, Pencil, Star, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteSavedView, saveSavedView } from "@/lib/actions/saved-views";
import type { ActionState } from "@/lib/actions/helpers";
import type { SavedViewSummary } from "@/lib/saved-views/queries";

const initialState: ActionState = {};

export function SaveViewControl({ pageKey, views }: { pageKey: string; views: SavedViewSummary[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSaveOpen, setIsSaveOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [saveState, saveAction] = useActionState(saveSavedView, initialState);
  const [renameState, renameAction] = useActionState(saveSavedView, initialState);

  function applyView(view: SavedViewSummary) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(view.filters)) {
      if (value) query.set(key, value);
    }
    setIsMenuOpen(false);
    router.push(query.toString() ? `${pathname}?${query.toString()}` : pathname ?? "");
  }

  const currentSearch = searchParams?.toString() ?? "";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => {
            setIsMenuOpen((open) => !open);
            setIsSaveOpen(false);
          }}
        >
          <Bookmark className="h-3.5 w-3.5" />
          Views{views.length ? ` (${views.length})` : ""}
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
        {isMenuOpen ? (
          <div className="absolute left-0 top-full z-20 mt-1 w-72 rounded-md border border-slate-200 bg-white py-1 shadow-lg">
            {views.length === 0 ? (
              <p className="px-3 py-2 text-sm text-slate-500">No saved views yet.</p>
            ) : (
              views.map((view) => (
                <div key={view.id} className="flex items-center gap-1 px-2 py-1.5 text-sm hover:bg-slate-50">
                  {renamingId === view.id ? (
                    <form action={renameAction} className="flex flex-1 items-center gap-1">
                      <input type="hidden" name="pageKey" value={pageKey} />
                      <input type="hidden" name="id" value={view.id} />
                      <input
                        type="hidden"
                        name="isDefault"
                        value={view.isDefault ? "on" : ""}
                      />
                      <Input
                        name="name"
                        defaultValue={view.name}
                        maxLength={80}
                        className="h-7 text-xs"
                        autoFocus
                      />
                      <Button type="submit" size="sm" variant="ghost" className="h-7 px-2 text-xs">
                        Save
                      </Button>
                      <button
                        type="button"
                        aria-label="Cancel rename"
                        className="text-slate-400 hover:text-slate-700"
                        onClick={() => setRenamingId(null)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </form>
                  ) : (
                    <>
                      <button type="button" className="flex-1 truncate text-left" onClick={() => applyView(view)}>
                        {view.isDefault ? <Star className="mr-1 inline h-3 w-3 text-amber-500" /> : null}
                        {view.name}
                      </button>
                      <button
                        type="button"
                        aria-label={`Rename ${view.name}`}
                        className="text-slate-400 hover:text-slate-700"
                        onClick={() => setRenamingId(view.id)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <form action={deleteSavedView} className="contents">
                        <input type="hidden" name="id" value={view.id} />
                        <input type="hidden" name="pageKey" value={pageKey} />
                        <button
                          type="submit"
                          aria-label={`Delete ${view.name}`}
                          className="text-slate-400 hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </form>
                    </>
                  )}
                </div>
              ))
            )}
            {renameState.message ? (
              <p className={`px-3 pb-1 text-xs ${renameState.ok ? "text-emerald-600" : "text-red-600"}`}>
                {renameState.message}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="relative">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setIsSaveOpen((open) => !open);
            setIsMenuOpen(false);
          }}
        >
          Save view
        </Button>
        {isSaveOpen ? (
          <form
            action={saveAction}
            className="absolute left-0 top-full z-20 mt-1 flex w-72 flex-col gap-2 rounded-md border border-slate-200 bg-white p-3 shadow-lg"
          >
            <input type="hidden" name="pageKey" value={pageKey} />
            <input type="hidden" name="search" value={currentSearch} />
            <Input name="name" placeholder="View name" required maxLength={80} autoFocus />
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input type="checkbox" name="isDefault" />
              Set as default for this page
            </label>
            {saveState.message ? (
              <p className={`text-xs ${saveState.ok ? "text-emerald-600" : "text-red-600"}`}>{saveState.message}</p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setIsSaveOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm">
                Save
              </Button>
            </div>
          </form>
        ) : null}
      </div>
    </div>
  );
}
