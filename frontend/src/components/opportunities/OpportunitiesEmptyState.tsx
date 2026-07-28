import { Sparkles } from 'lucide-react';

export function OpportunitiesEmptyState() {
  return (
    <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center">
      <Sparkles className="mx-auto text-slate-300" size={36} />
      <h3 className="mt-4 text-lg font-semibold text-slate-900">No hay oportunidades para este filtro</h3>
      <p className="mt-2 text-sm text-slate-500">Proba analizar nuevamente o cambiar los filtros.</p>
    </div>
  );
}
