"use client";

import { ErrorState } from "@/components/error-state";

export default function PlatformError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return <ErrorState error={error} onRetry={unstable_retry} homeHref="/platform" homeLabel="Back to platform panel" />;
}
