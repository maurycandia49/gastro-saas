import { Card } from '../components/ui/Card';

export function BusinessPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Negocio</p>
        <h1 className="text-3xl font-semibold text-slate-900">Mi negocio</h1>
        <p className="text-sm text-slate-500">Aquí se verá el perfil principal del negocio.</p>
      </div>
      <Card title="Próximamente" description="Este espacio será el centro de configuración del negocio.">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">El módulo se desarrollará con el backend en la siguiente etapa.</div>
      </Card>
    </div>
  );
}
