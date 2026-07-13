import { Boxes, Store, Tag } from 'lucide-react';
import { StatCard } from '../ui/StatCard';

interface DashboardStatsProps {
  businessesCount: number;
  categoriesCount: number;
  productsCount: number;
  loading: boolean;
}

export function DashboardStats({ businessesCount, categoriesCount, productsCount, loading }: DashboardStatsProps) {
  const stats = [
    { title: 'Negocios', value: loading ? '...' : String(businessesCount), icon: <Store size={20} /> },
    { title: 'Categorías', value: loading ? '...' : String(categoriesCount), icon: <Tag size={20} /> },
    { title: 'Productos', value: loading ? '...' : String(productsCount), icon: <Boxes size={20} /> },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {stats.map((stat) => (
        <StatCard key={stat.title} title={stat.title} value={stat.value} icon={stat.icon} />
      ))}
    </div>
  );
}
