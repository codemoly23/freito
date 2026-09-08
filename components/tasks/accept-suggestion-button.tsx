"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// Disables itself while the form action is in flight -- the previous version
// gave no feedback on click (it redirected back to the same list page), so
// people kept clicking and created several duplicate tasks in testing.
export function AcceptSuggestionButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="outline" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Accepting...
        </>
      ) : (
        "Accept"
      )}
    </Button>
  );
}
