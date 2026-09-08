"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Loader2, Mail, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { buildEmailShareUrl } from "@/lib/share/share-links";
import { generateShipmentEmailDraftAction } from "@/lib/actions/ai-generative-content";
import type { EmailPurpose } from "@/lib/ai/email-generator";

const PURPOSES: { value: EmailPurpose; label: string }[] = [
  { value: "STATUS_UPDATE", label: "Status Update" },
  { value: "DELAY_NOTICE", label: "Delay Notice" },
  { value: "DOCUMENT_REQUEST", label: "Document Request" },
];

type AiEmailDraftButtonProps = {
  shipmentId: string;
  customerEmail: string | null;
};

// AI only ever fills these fields in this modal -- sending still happens
// through the existing mailto: mechanism (buildEmailShareUrl), which opens the
// user's own email client for them to review and send. Nothing is sent from
// the server.
export function AiEmailDraftButton({ shipmentId, customerEmail }: AiEmailDraftButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [hasDraft, setHasDraft] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = (purpose: EmailPurpose) => {
    setError(null);
    startTransition(async () => {
      const result = await generateShipmentEmailDraftAction(shipmentId, purpose);
      if (!result.ok) {
        setError(result.message);
        setHasDraft(false);
        return;
      }
      setSubject(result.subject);
      setBody(result.body);
      setHasDraft(true);
    });
  };

  let mailtoHref: string | null = null;
  let mailtoError: string | null = null;
  if (hasDraft) {
    try {
      mailtoHref = buildEmailShareUrl(customerEmail, subject, body);
    } catch (err) {
      mailtoError = err instanceof Error ? err.message : "Could not build the email link.";
    }
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setIsOpen(true)}>
        <Sparkles className="h-4 w-4 text-purple-600" />
        AI Draft Email
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Mail className="h-4 w-4 text-purple-600" /> AI Email Draft
              </h3>
              <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="h-8 w-8 text-slate-400 hover:text-slate-950">
                &times;
              </Button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap gap-2">
                {PURPOSES.map((p) => (
                  <Button key={p.value} type="button" size="sm" variant="outline" disabled={isPending} onClick={() => generate(p.value)}>
                    {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    {p.label}
                  </Button>
                ))}
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-md bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-400">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {hasDraft && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="ai-email-subject" className="text-xs font-semibold text-slate-700">Subject</Label>
                    <input
                      id="ai-email-subject"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full rounded-md border border-slate-200 bg-white p-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ai-email-body" className="text-xs font-semibold text-slate-700">Body</Label>
                    <textarea
                      id="ai-email-body"
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      rows={10}
                      className="w-full rounded-md border border-slate-200 bg-white p-2.5 text-sm leading-normal focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500">
                    * Review and edit above, then open it in your email app to send. Nothing is sent automatically.
                  </p>

                  {mailtoError ? (
                    <div className="flex items-start gap-2 rounded-md bg-red-50 p-2.5 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-400">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <span>{mailtoError}</span>
                    </div>
                  ) : (
                    <div className="flex justify-end">
                      <Button asChild size="sm">
                        <a href={mailtoHref ?? "#"}>
                          <Mail className="h-3.5 w-3.5" /> Open in Email App
                        </a>
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
