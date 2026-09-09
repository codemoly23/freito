import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

export function NotFoundState({
  title = "Page not found",
  description = "The page you're looking for doesn't exist or may have been moved.",
  homeHref = "/",
  homeLabel = "Go back",
}: {
  title?: string;
  description?: string;
  homeHref?: string;
  homeLabel?: string;
}) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-6 py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle,var(--color-slate-300)_1px,transparent_1px)] opacity-40 [background-size:28px_28px] [mask-image:radial-gradient(ellipse_55%_45%_at_50%_35%,black,transparent)]"
      />

      <div className="relative flex flex-col items-center text-center">
        <span className="select-none text-[7rem] font-bold leading-none tracking-tight text-slate-200 sm:text-[9rem]">
          404
        </span>

        <div className="-mt-9 mb-7 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-950/10 ring-1 ring-slate-950/5 sm:-mt-11">
          <FileQuestion className="h-6 w-6" />
        </div>

        <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
          {title}
        </h1>
        <p className="mt-3 max-w-sm text-sm text-slate-500 sm:text-base">
          {description}
        </p>

        <div className="mt-8">
          <Button asChild size="lg">
            <Link href={homeHref}>{homeLabel}</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
