import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { CostingMetricCard } from '../components/costing/CostingMetricCard';
import { CostingSkeleton } from '../components/costing/CostingSkeleton';
import { ProductCostDetailModal } from '../components/costing/ProductCostDetailModal';
import { ProductCostTable } from '../components/costing/ProductCostTable';
import { getApiErrorMessage } from '../services/apiErrors';
import { getBusinesses, type Business } from '../services/business';
import { getCostingProducts, getCostingSummary, type CostingSummary, type ProductCost } from '../services/costing';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
}

function formatPercent(value: string | null) {
  if (value === null) return '—';
  return `${Number(value).toFixed(1)}%`;
}

type Filter = 'all' | 'healthy' | 'low' | 'negative' | 'incomplete';
type Sort = 'margin' | 'cost' | 'profit' | 'name';

export function CostingPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState<number | null>(null);
  const [summary, setSummary] = useState<CostingSummary | null>(null);
  const [products, setProducts] = useState<ProductCost[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ProductCost | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('margin');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (businessId?: number) => {
    try {
      setLoading(true);
      setError('');
      const loadedBusinesses = businesses.length ? businesses : await getBusinesses();
      if (!businesses.length) {
        setBusinesses(loadedBusinesses);
      }
      const id = businessId ?? selectedBusinessId ?? loadedBusinesses.find((business) => business.active)?.id ?? loadedBusinesses[0]?.id ?? null;
      setSelectedBusinessId(id);
      if (!id) {
        setProducts([]);
        setSummary(null);
        return;
      }
      const [summaryResponse, productsResponse] = await Promise.all([
        getCostingSummary(id),
        getCostingProducts(id),
      ]);
      setSummary(summaryResponse);
      setProducts(productsResponse);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'No pudimos cargar costos y margenes.'));
    } finally {
      setLoading(false);
    }
  }, [businesses, selectedBusinessId]);

  useEffect(() => {
    void load();
  }, []);

  const visibleProducts = useMemo(() => {
    return products
      .filter((product) => {
        const normalized = `${product.name} ${product.category}`.toLowerCase();
        if (query && !normalized.includes(query.toLowerCase())) return false;
        if (filter === 'incomplete') return product.incomplete_recipe;
        if (filter === 'negative') return Number(product.unit_profit) < 0 && !product.incomplete_recipe;
        if (filter === 'low') return !product.incomplete_recipe && product.margin_percentage !== null && Number(product.margin_percentage) < 20 && Number(product.unit_profit) >= 0;
        if (filter === 'healthy') return !product.incomplete_recipe && Number(product.unit_profit) >= 0 && (product.margin_percentage === null || Number(product.margin_percentage) >= 20);
        return true;
      })
      .sort((a, b) => {
        if (sort === 'name') return a.name.localeCompare(b.name);
        if (sort === 'cost') return Number(b.recipe_cost) - Number(a.recipe_cost);
        if (sort === 'profit') return Number(b.unit_profit) - Number(a.unit_profit);
        return Number(a.margin_percentage ?? 999) - Number(b.margin_percentage ?? 999);
      });
  }, [products, query, filter, sort]);

  const handleBusinessChange = (businessId: number) => {
    setSelectedBusinessId(businessId);
    void load(businessId);
  };

  const handleProductUpdated = (updated: ProductCost) => {
    setProducts((current) => current.map((product) => product.product_id === updated.product_id ? updated : product));
    setSelectedProduct(updated);
    if (selectedBusinessId) void load(selectedBusinessId);
  };

  if (loading) return <CostingSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Costeo inteligente</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Costos y margenes</h1>
          <p className="mt-2 text-sm text-slate-500">Costeo actual del catalogo. No representa ganancia historica real de ventas.</p>
        </div>
        {businesses.length > 1 ? (
          <label className="block sm:w-64">
            <span className="mb-2 block text-sm font-medium text-slate-700">Negocio</span>
            <select value={selectedBusinessId ?? ''} onChange={(event) => handleBusinessChange(Number(event.target.value))} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400">
              {businesses.map((business) => <option key={business.id} value={business.id}>{business.name}</option>)}
            </select>
          </label>
        ) : null}
      </div>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <div className="grid gap-4 md:grid-cols-4">
        <CostingMetricCard title="Margen promedio" value={formatPercent(summary?.average_margin ?? null)} tone="green" />
        <CostingMetricCard title="Margen bajo" value={String(summary?.products_with_low_margin ?? 0)} tone="yellow" />
        <CostingMetricCard title="Sin receta completa" value={String((summary?.products_without_recipe ?? 0) + ((summary?.products_count ?? 0) - (summary?.products_with_complete_recipe ?? 0) - (summary?.products_without_recipe ?? 0)))} tone="neutral" />
        <CostingMetricCard title="Alertas activas" value={String(summary?.active_alerts_count ?? 0)} tone={(summary?.active_alerts_count ?? 0) > 0 ? 'red' : 'green'} />
      </div>

      <Card>
        <div className="mb-5 grid gap-3 lg:grid-cols-[1fr_180px_180px]">
          <label className="relative block">
            <Search className="absolute left-4 top-3.5 text-slate-400" size={18} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por producto o categoria" className="w-full rounded-2xl border border-slate-200 py-3 pl-11 pr-4 text-sm outline-none focus:border-slate-400" />
          </label>
          <select value={filter} onChange={(event) => setFilter(event.target.value as Filter)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400">
            <option value="all">Todos</option>
            <option value="healthy">Saludables</option>
            <option value="low">Margen bajo</option>
            <option value="negative">Ganancia negativa</option>
            <option value="incomplete">Incompletos</option>
          </select>
          <select value={sort} onChange={(event) => setSort(event.target.value as Sort)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400">
            <option value="margin">Margen</option>
            <option value="cost">Costo</option>
            <option value="profit">Ganancia</option>
            <option value="name">Nombre</option>
          </select>
        </div>
        {visibleProducts.length ? (
          <ProductCostTable products={visibleProducts} onSelect={setSelectedProduct} formatCurrency={formatCurrency} formatPercent={formatPercent} />
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">No hay productos para mostrar.</div>
        )}
      </Card>

      <ProductCostDetailModal product={selectedProduct} onClose={() => setSelectedProduct(null)} onUpdated={handleProductUpdated} formatCurrency={formatCurrency} formatPercent={formatPercent} />
    </div>
  );
}
