export function InventoryCard({ title, value }: { title: string; value: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{title}</p><p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p></div>;
}
