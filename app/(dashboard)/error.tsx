"use client";

import { ErrorState } from "@/components/error-state";

export default function DashboardError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return <ErrorState error={error} onRetry={unstable_retry} homeHref="/dashboard" homeLabel="Back to dashboard" />;
}
