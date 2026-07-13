import { Card } from '../components/ui/Card';

export function CustomersPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Clientes</p>
        <h1 className="text-3xl font-semibold text-slate-900">Clientes frecuentes</h1>
        <p className="text-sm text-slate-500">La base para gestionar fidelización y pedidos recurrentes.</p>
      </div>
      <Card title="En construcción" description="Este módulo se incorporará en la próxima iteración del producto.">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">Placeholder profesional.</div>
      </Card>
    </div>
  );
}
