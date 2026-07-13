import { Card } from '../components/ui/Card';

export function ProductsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Productos</p>
        <h1 className="text-3xl font-semibold text-slate-900">Tu menú digital</h1>
        <p className="text-sm text-slate-500">La vista de productos está preparada para crecer con el MVP.</p>
      </div>
      <Card title="Gestión de menú" description="Espacio listo para listar, filtrar y editar productos.">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">En la siguiente iteración se conectará con los endpoints del backend.</div>
      </Card>
    </div>
  );
}
