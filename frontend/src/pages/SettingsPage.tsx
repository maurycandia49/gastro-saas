import { Card } from '../components/ui/Card';

export function SettingsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Configuración</p>
        <h1 className="text-3xl font-semibold text-slate-900">Ajustes del sistema</h1>
        <p className="text-sm text-slate-500">El punto de entrada para preferencias y configuración del negocio.</p>
      </div>
      <Card title="Configuración inicial" description="La arquitectura ya está preparada para las opciones reales del producto.">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">Placeholder de la futura configuración.</div>
      </Card>
    </div>
  );
}
