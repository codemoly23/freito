"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ErrorState({
  error,
  onRetry,
  title = "Something went wrong",
  description = "An unexpected error occurred. Try again, and contact support if the problem continues.",
  homeHref = "/",
  homeLabel = "Go back",
}: {
  error: Error & { digest?: string };
  onRetry: () => void;
  title?: string;
  description?: string;
  homeHref?: string;
  homeLabel?: string;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-6 py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle,var(--color-slate-300)_1px,transparent_1px)] opacity-40 [background-size:28px_28px] [mask-image:radial-gradient(ellipse_55%_45%_at_50%_35%,black,transparent)]"
      />

      <div className="relative flex flex-col items-center text-center">
        <span className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium uppercase tracking-wide text-red-700">
          <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
          Unexpected error
        </span>

        <div className="mb-7 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-600 text-white shadow-lg shadow-red-600/20 ring-1 ring-red-600/10">
          <AlertTriangle className="h-6 w-6" />
        </div>

        <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
          {title}
        </h1>
        <p className="mt-3 max-w-sm text-sm text-slate-500 sm:text-base">
          {description}
        </p>
        {error.digest ? (
          <p className="mt-3 rounded-md bg-slate-100 px-2.5 py-1 font-mono text-xs text-slate-400">
            Reference: {error.digest}
          </p>
        ) : null}

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" onClick={onRetry}>
            Try again
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href={homeHref}>{homeLabel}</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
