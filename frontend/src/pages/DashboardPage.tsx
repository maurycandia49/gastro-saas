import { Boxes, Store, Tag, ReceiptText } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { StatCard } from '../components/ui/StatCard';

const stats = [
  { title: 'Negocios', value: '3', icon: <Store size={20} /> },
  { title: 'Categorías', value: '12', icon: <Tag size={20} /> },
  { title: 'Productos', value: '48', icon: <Boxes size={20} /> },
  { title: 'Pedidos', value: '126', icon: <ReceiptText size={20} /> },
];

export function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Panel</p>
        <h1 className="text-3xl font-semibold text-slate-900">Bienvenido a Pedilo</h1>
        <p className="max-w-2xl text-sm text-slate-500">Tu negocio, tu menú y tus pedidos, todos en un lugar limpio y rápido.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.title} title={stat.title} value={stat.value} icon={stat.icon} />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
        <Card title="Tu operación" description="Vista general del negocio para empezar a trabajar.">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
            El dashboard está preparado para crecer con métricas reales y vistas más ricas en futuras iteraciones.
          </div>
        </Card>
        <Card title="Próximo paso" description="La base visual ya está lista para el desarrollo del producto.">
          <ul className="space-y-3 text-sm text-slate-600">
            <li>• Preparar autenticación JWT</li>
            <li>• Conectar módulos del backend</li>
            <li>• Crear flujos de negocio reales</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
