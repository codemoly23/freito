"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function PrintToolbar({ pdfUrl }: { pdfUrl?: string }) {
  const router = useRouter();
  return (
    <div className="print-hidden mb-6 flex flex-wrap justify-end gap-2">
      <Button type="button" variant="outline" onClick={() => router.back()}>Back</Button>
      {pdfUrl ? <Button asChild variant="outline"><a download href={pdfUrl}>Download PDF</a></Button> : null}
      <Button type="button" onClick={() => window.print()}>Print</Button>
    </div>
  );
}
