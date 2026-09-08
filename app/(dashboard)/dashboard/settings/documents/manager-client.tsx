"use client";

import { useState } from "react";
import { DocumentMasterForm, type DocumentMasterInput } from "@/components/forms/document-master-form";
import { Button } from "@/components/ui/button";
import { saveDocumentMasterAction, toggleDocumentMasterStatusAction } from "@/lib/actions/document-master";
import { Plus, Edit2, ShieldAlert, Check, X, Search } from "lucide-react";

interface ManagerItem extends DocumentMasterInput {
  isGlobal: boolean;
}

export function DocumentMasterManagerClient({
  initialItems
}: {
  initialItems: ManagerItem[]
}) {
  const [items, setItems] = useState<ManagerItem[]>(initialItems);
  const [search, setSearch] = useState("");
  const [editingItem, setEditingItem] = useState<ManagerItem | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(search.toLowerCase()) || 
    item.code.toLowerCase().includes(search.toLowerCase()) ||
    item.docCategory.toLowerCase().includes(search.toLowerCase())
  );

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      await toggleDocumentMasterStatusAction(id, !currentStatus);
      setItems(prev => prev.map(item => 
        item.id === id ? { ...item, isActive: !currentStatus } : item
      ));
    } catch (err) {
      console.error(err);
    }
  };

  const handleFormSuccess = () => {
    // Reload path/page state or close editor
    setIsAdding(false);
    setEditingItem(null);
    window.location.reload();
  };

  return (
    <div className="space-y-6">
      {!isAdding && !editingItem ? (
        <>
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search documents by name/code..."
                className="w-full pl-9 pr-4 h-9 rounded-md border border-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button onClick={() => setIsAdding(true)} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Add Master Item
            </Button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-100 bg-white">
            <table className="min-w-full divide-y divide-slate-100 text-sm text-left">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3">Document Details</th>
                  <th className="px-6 py-3">Owner / Category</th>
                  <th className="px-6 py-3">Media / Transport</th>
                  <th className="px-6 py-3">Auto Blocker Status</th>
                  <th className="px-6 py-3 text-center">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 divide-solid">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-800">{item.name}</div>
                      <div className="text-xs font-mono text-slate-400 mt-0.5">{item.code}</div>
                      {item.isGlobal && (
                        <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-xs font-semibold text-blue-700 mt-1">
                          Global Template
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-700">{item.owner}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{item.docCategory}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-700">{item.media}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{item.transportMode}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1 text-xs text-slate-600">
                        {item.mandatoryBeforeJobClose && (
                          <span className="text-red-700 font-semibold flex items-center gap-1">
                            <ShieldAlert className="h-3 w-3" /> Job Close Block
                          </span>
                        )}
                        {item.mandatoryBeforeInvoice && (
                          <span className="text-amber-700 font-semibold flex items-center gap-1">
                            <ShieldAlert className="h-3 w-3" /> Invoice Block
                          </span>
                        )}
                        {item.mandatoryBeforeDeliveryOrder && (
                          <span className="text-emerald-700 font-semibold flex items-center gap-1">
                            <ShieldAlert className="h-3 w-3" /> DO Release Block
                          </span>
                        )}
                        {item.mandatoryBeforeFinanceClose && (
                          <span className="text-indigo-700 font-semibold flex items-center gap-1">
                            <ShieldAlert className="h-3 w-3" /> Finance Close Block
                          </span>
                        )}
                        {!item.mandatoryBeforeJobClose && !item.mandatoryBeforeInvoice && !item.mandatoryBeforeDeliveryOrder && !item.mandatoryBeforeFinanceClose && (
                          <span className="text-slate-400">None (Optional checklist)</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleToggleActive(item.id!, item.isActive)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold cursor-pointer ${
                          item.isActive 
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
                            : "bg-slate-50 text-slate-400 border border-slate-200"
                        }`}
                      >
                        {item.isActive ? (
                          <>
                            <Check className="h-3 w-3" /> Active
                          </>
                        ) : (
                          <>
                            <X className="h-3 w-3" /> Disabled
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingItem(item)}
                        className="h-8"
                      >
                        <Edit2 className="h-3 w-3 mr-1.5" />
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="bg-slate-50/50 border border-slate-200/60 rounded-xl p-6 max-w-3xl">
          <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-3">
            <h3 className="text-lg font-bold text-slate-800">
              {editingItem ? `Edit Document: ${editingItem.name}` : "Create New Document Master Item"}
            </h3>
            <button
              onClick={() => {
                setIsAdding(false);
                setEditingItem(null);
              }}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <DocumentMasterForm
            action={async (state, formData) => {
              const res = await saveDocumentMasterAction(state, formData);
              if (res.ok) {
                handleFormSuccess();
              }
              return res;
            }}
            initialData={editingItem || undefined}
            onCancel={() => {
              setIsAdding(false);
              setEditingItem(null);
            }}
          />
        </div>
      )}
    </div>
  );
}
