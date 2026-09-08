export default function ShipmentsLoading() {
  return (
    <main className="space-y-6 p-4 lg:p-6">
      <div className="space-y-3">
        <div className="h-6 w-24 animate-pulse rounded-md bg-slate-200" />
        <div className="h-8 w-56 animate-pulse rounded-md bg-slate-200" />
        <div className="h-4 w-80 animate-pulse rounded-md bg-slate-200" />
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="mb-5 h-10 w-full animate-pulse rounded-md bg-slate-100" />
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-14 animate-pulse rounded-md bg-slate-100"
            />
          ))}
        </div>
      </div>
    </main>
  );
}
