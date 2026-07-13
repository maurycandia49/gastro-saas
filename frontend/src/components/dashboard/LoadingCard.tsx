export function LoadingCard() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
      <div className="mt-4 h-3 w-48 animate-pulse rounded bg-slate-100" />
      <div className="mt-3 space-y-2">
        <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
        <div className="h-3 w-5/6 animate-pulse rounded bg-slate-100" />
      </div>
    </div>
  );
}
