import { Card } from '../components/ui/Card';

export function PromotionsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Promociones</p>
        <h1 className="text-3xl font-semibold text-slate-900">Promociones y ofertas</h1>
        <p className="text-sm text-slate-500">Próximo bloque para campañas simples y atractivas.</p>
      </div>
      <Card title="Pendiente" description="Se integrará en una siguiente etapa del producto.">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">Placeholder listo para crecer.</div>
      </Card>
    </div>
  );
}
