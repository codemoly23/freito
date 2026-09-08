import Link from "next/link";
import { Sparkles } from "lucide-react";
import { AcceptSuggestionButton } from "@/components/tasks/accept-suggestion-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { acceptTaskSuggestion } from "@/lib/actions/ai-task-suggestions";
import { getSuggestedTasks } from "@/lib/ai/task-suggestions";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions/rbac";

export async function AISuggestedTasksSection() {
  // "Accept" ultimately calls saveTask, which requires tasks:create -- check
  // it here too so this section never shows an Accept button that would then
  // be denied (e.g. a user with reports:view + ai:use but no task permission).
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "tasks:create")) return null;

  const result = await getSuggestedTasks();
  if (!result.enabled || result.suggestions.length === 0) return null;

  return (
    <Card className="border-purple-100 bg-purple-50/30 dark:border-purple-900 dark:bg-purple-950/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-purple-600" />
          Suggested Tasks
        </CardTitle>
        <CardDescription>
          Based on shipments currently flagged by AI Exception Radar. Accept to create a real task, or ignore -- nothing is created unless you accept.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {result.suggestions.map((suggestion) => {
          return (
            <div
              key={suggestion.key}
              className="flex flex-col gap-2 rounded-md border border-slate-100 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant={suggestion.priority === "HIGH" ? "danger" : "warning"}>{suggestion.priority}</Badge>
                  <Link href={`/dashboard/shipments/${suggestion.shipmentId}`} className="text-sm font-medium text-slate-900 hover:underline">
                    {suggestion.jobNo}
                  </Link>
                </div>
                <p className="mt-1 text-sm text-slate-700">{suggestion.title}</p>
                <p className="text-xs text-slate-500">{suggestion.description}</p>
              </div>
              <form action={acceptTaskSuggestion}>
                <input type="hidden" name="title" value={suggestion.title} />
                <input type="hidden" name="description" value={suggestion.description} />
                <input type="hidden" name="priority" value={suggestion.priority} />
                <input type="hidden" name="dueDate" value={suggestion.dueDate} />
                <input type="hidden" name="shipmentJobId" value={suggestion.shipmentId} />
                {/* No returnTo -- saveTask's own default redirects to the new
                    task's detail page, which is the visible confirmation that
                    something happened (redirecting back to this same list
                    page looked like the button did nothing). */}
                <AcceptSuggestionButton />
              </form>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
