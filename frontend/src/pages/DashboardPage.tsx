import { useEffect, useMemo, useState } from 'react';
import { Card } from '../components/ui/Card';
import { DashboardStats } from '../components/dashboard/DashboardStats';
import { EmptyState } from '../components/dashboard/EmptyState';
import { LoadingCard } from '../components/dashboard/LoadingCard';
import { useAuth } from '../contexts/AuthContext';
import { getBusinesses } from '../services/business';
import { getCategories } from '../services/categories';
import { getProducts } from '../services/products';

export function DashboardPage() {
  const { user } = useAuth();
  const [businesses, setBusinesses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadDashboardData() {
      try {
        setLoading(true);
        setError('');
        const [businessesResponse, categoriesResponse, productsResponse] = await Promise.all([
          getBusinesses(),
          getCategories(),
          getProducts(),
        ]);

        if (!isMounted) {
          return;
        }

        setBusinesses(businessesResponse);
        setCategories(categoriesResponse);
        setProducts(productsResponse);
      } catch {
        if (isMounted) {
          setError('No pudimos cargar la información del panel en este momento.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadDashboardData();

    return () => {
      isMounted = false;
    };
  }, []);

  const firstBusinessName = useMemo(() => businesses[0]?.name ?? '', [businesses]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Panel</p>
        <h1 className="text-3xl font-semibold text-slate-900">Hola, {user?.username ?? 'usuario'} 👋</h1>
        <p className="max-w-2xl text-sm text-slate-500">Tu negocio, tu menú y tus pedidos, todos en un lugar limpio y rápido.</p>
      </div>

      <DashboardStats businessesCount={businesses.length} categoriesCount={categories.length} productsCount={products.length} loading={loading} />

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
        <Card title="Tu operación" description="Información real desde el backend de Django.">
          {loading ? (
            <div className="space-y-3">
              <LoadingCard />
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">{error}</div>
          ) : businesses.length === 0 ? (
            <EmptyState title="Aún no creaste ningún negocio." description="Tu primer negocio aparecerá aquí tan pronto lo registres." />
          ) : (
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">Negocio</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">{firstBusinessName}</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">Categorías</p>
                  <p className="mt-2 text-xl font-semibold text-slate-900">{categories.length}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">Productos</p>
                  <p className="mt-2 text-xl font-semibold text-slate-900">{products.length}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">Estado</p>
                  <p className="mt-2 text-xl font-semibold text-slate-900">Activo</p>
                </div>
              </div>
            </div>
          )}
        </Card>
        <Card title="Próximo paso" description="La base visual ya está lista para el desarrollo del producto.">
          <ul className="space-y-3 text-sm text-slate-600">
            <li>• Conectar módulos del backend</li>
            <li>• Crear flujos de negocio reales</li>
            <li>• Preparar vistas de detalle y edición</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
