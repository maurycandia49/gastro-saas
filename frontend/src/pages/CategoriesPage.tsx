import { Card } from '../components/ui/Card';

export function CategoriesPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Categorías</p>
        <h1 className="text-3xl font-semibold text-slate-900">Organizar tu menú</h1>
        <p className="text-sm text-slate-500">Las categorías permitirán ordenar productos con rapidez.</p>
      </div>
      <Card title="Vista preliminar" description="Este módulo quedará listo para integrar con el backend cuando corresponda.">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">Placeholder profesional para la arquitectura del producto.</div>
      </Card>
    </div>
  );
}
