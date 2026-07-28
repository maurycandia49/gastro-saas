export function PurchasesSkeleton() {
  return <div className="space-y-4"><div className="grid gap-4 md:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-3xl bg-slate-100" />)}</div><div className="h-96 animate-pulse rounded-3xl bg-slate-100" /></div>;
}
