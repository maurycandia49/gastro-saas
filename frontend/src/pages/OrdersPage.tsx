import { Card } from '../components/ui/Card';

export function OrdersPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Pedidos</p>
        <h1 className="text-3xl font-semibold text-slate-900">Gestión de pedidos</h1>
        <p className="text-sm text-slate-500">La vista central para el flujo de venta y seguimiento.</p>
      </div>
      <Card title="Próximamente" description="Este módulo se desarrollará después de consolidar el menú y los negocios.">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">Placeholder preparado para el futuro del producto.</div>
      </Card>
    </div>
  );
}
