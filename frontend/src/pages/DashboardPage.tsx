import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, RefreshCw, Store } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { CreateBusinessModal } from '../components/dashboard/CreateBusinessModal';
import { EmptyState } from '../components/dashboard/EmptyState';
import { HourlySalesChart } from '../components/dashboard/HourlySalesChart';
import { LastOrdersList } from '../components/dashboard/LastOrdersList';
import { MetricCard } from '../components/dashboard/MetricCard';
import { ProfitabilityCard } from '../components/dashboard/ProfitabilityCard';
import { StatusBreakdown } from '../components/dashboard/StatusBreakdown';
import { SuccessToast } from '../components/dashboard/SuccessToast';
import { useAuth } from '../contexts/AuthContext';
import { getApiErrorMessage } from '../services/apiErrors';
import { getBusinesses, type Business } from '../services/business';
import { getHourlySales, getMetricsSummary, type HourlySale, type MetricsSummary } from '../services/metrics';
import { getProfitMetrics, type ProfitMetrics } from '../services/profit';
import { getProfitabilityAlerts } from '../services/profitabilityAlerts';
import type { CostingAlert } from '../services/costing';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat('es-AR', { dateStyle: 'full' }).format(value);
}

function formatTime(value: string | Date) {
  return new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function formatPercent(value: string | null) {
  if (value === null) return '-';
  return `${Number(value).toFixed(1)}%`;
}

function formatInputDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function comparisonText(summary: MetricsSummary | null) {
  if (!summary?.sales_change_percentage) return undefined;
  const value = Number(summary.sales_change_percentage);
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(1)}% vs ayer`;
}

export function DashboardPage() {
  const { user } = useAuth();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState<number | null>(null);
  const [summary, setSummary] = useState<MetricsSummary | null>(null);
  const [profitMetrics, setProfitMetrics] = useState<ProfitMetrics | null>(null);
  const [profitabilityAlerts, setProfitabilityAlerts] = useState<CostingAlert[]>([]);
  const [hourlySales, setHourlySales] = useState<HourlySale[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const requestInFlight = useRef(false);

  const selectedBusiness = useMemo(
    () => businesses.find((business) => business.id === selectedBusinessId) ?? null,
    [businesses, selectedBusinessId],
  );
  const today = useMemo(() => new Date(), []);
  const todayInput = useMemo(() => formatInputDate(new Date()), []);

  const loadBusinesses = useCallback(async () => {
    const response = await getBusinesses();
    setBusinesses(response);
    setSelectedBusinessId((current) => current ?? response.find((business) => business.active)?.id ?? response[0]?.id ?? null);
    return response;
  }, []);

  const loadMetrics = useCallback(async (businessId: number, soft = false) => {
    if (requestInFlight.current) return;
    requestInFlight.current = true;

    try {
      if (soft) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError('');
      const [summaryResponse, hourlyResponse, profitResponse] = await Promise.all([
        getMetricsSummary(businessId),
        getHourlySales(businessId, todayInput),
        getProfitMetrics(businessId),
      ]);
      setSummary(summaryResponse);
      setHourlySales(hourlyResponse);
      setProfitMetrics(profitResponse);
      getProfitabilityAlerts(businessId).then((alerts) => setProfitabilityAlerts(alerts.filter((alert) => !alert.resolved).slice(0, 3))).catch(() => setProfitabilityAlerts([]));
      setLastUpdated(new Date());
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'No pudimos cargar las metricas del dashboard.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
      requestInFlight.current = false;
    }
  }, [todayInput]);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        setLoading(true);
        const loadedBusinesses = await loadBusinesses();
        if (!mounted) return;
        const firstBusiness = loadedBusinesses.find((business) => business.active) ?? loadedBusinesses[0] ?? null;
        if (firstBusiness) {
          await loadMetrics(firstBusiness.id);
        } else {
          setLoading(false);
        }
      } catch (requestError) {
        if (mounted) {
          setError(getApiErrorMessage(requestError, 'No pudimos cargar el dashboard.'));
          setLoading(false);
        }
      }
    }

    void bootstrap();

    return () => {
      mounted = false;
    };
  }, [loadBusinesses, loadMetrics]);

  useEffect(() => {
    if (!selectedBusinessId) return undefined;

    const interval = window.setInterval(() => {
      void loadMetrics(selectedBusinessId, true);
    }, 60000);

    return () => window.clearInterval(interval);
  }, [loadMetrics, selectedBusinessId]);

  const handleBusinessChange = (businessId: number) => {
    setSelectedBusinessId(businessId);
    setSummary(null);
    setProfitMetrics(null);
    setHourlySales([]);
    void loadMetrics(businessId);
  };

  const handleBusinessCreated = (business: Business) => {
    setBusinesses((current) => [business, ...current]);
    setSelectedBusinessId(business.id);
    setSuccessMessage(`${business.name} quedo listo para operar.`);
    window.setTimeout(() => setSuccessMessage(''), 2500);
    void loadMetrics(business.id);
  };

  const salesComparison = comparisonText(summary);
  const previousOrders = summary?.previous_period.orders_count ?? 0;
  const ordersComparison = previousOrders > 0 && summary ? `${(((summary.orders_count - previousOrders) / previousOrders) * 100).toFixed(1)}% vs ayer` : undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Panel operativo</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Hola, {user?.username ?? 'usuario'}</h1>
          <p className="mt-2 text-sm text-slate-500">{formatDate(today)}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          {businesses.length > 1 ? (
            <label className="block sm:w-64">
              <span className="mb-2 block text-sm font-medium text-slate-700">Negocio</span>
              <select value={selectedBusinessId ?? ''} onChange={(event) => handleBusinessChange(Number(event.target.value))} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400">
                {businesses.map((business) => <option key={business.id} value={business.id}>{business.name}</option>)}
              </select>
            </label>
          ) : selectedBusiness ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Negocio</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{selectedBusiness.name}</p>
            </div>
          ) : null}
          <button type="button" onClick={() => selectedBusinessId && void loadMetrics(selectedBusinessId, true)} disabled={!selectedBusinessId || refreshing} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
            {refreshing ? <Loader2 className="animate-spin" size={17} /> : <RefreshCw size={17} />}
            Actualizar
          </button>
        </div>
      </div>

      {lastUpdated ? <p className="text-sm text-slate-500">Ultima actualizacion: {formatTime(lastUpdated)}</p> : null}
      {successMessage ? <SuccessToast message={successMessage} /> : null}
      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      {!loading && businesses.length === 0 ? (
        <Card>
          <div className="space-y-4 py-8 text-center">
            <Store className="mx-auto text-slate-300" size={38} />
            <EmptyState title="Aun no creaste ningun negocio." description="Crea tu primer negocio para empezar a recibir pedidos y ver metricas reales." />
            <button onClick={() => setModalOpen(true)} className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
              Crear mi primer negocio
            </button>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard title="Ventas de hoy" value={formatCurrency(Number(summary?.sales_total ?? 0))} comparison={salesComparison} loading={loading && !summary} />
            <MetricCard title="Pedidos de hoy" value={String(summary?.orders_count ?? 0)} comparison={ordersComparison} loading={loading && !summary} />
            <MetricCard title="Ticket promedio" value={formatCurrency(Number(summary?.average_ticket ?? 0))} loading={loading && !summary} />
            <MetricCard title="Productos vendidos" value={String(summary?.items_sold ?? 0)} loading={loading && !summary} />
          </div>

          {summary && summary.orders_count === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
              Aun no hay ventas registradas hoy.
            </div>
          ) : null}

          <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
            <Card title="Ventas por hora" description="Pedidos no cancelados agrupados por hora.">
              <HourlySalesChart data={hourlySales} formatCurrency={formatCurrency} />
            </Card>
            <Card title="Producto estrella" description="Mayor cantidad vendida en el dia.">
              {summary?.top_product ? (
                <div className="rounded-2xl bg-slate-50 p-5">
                  <p className="text-xl font-semibold text-slate-900">{summary.top_product.name}</p>
                  <p className="mt-3 text-sm text-slate-500">{summary.top_product.quantity} unidades vendidas</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{formatCurrency(Number(summary.top_product.revenue))} generados</p>
                </div>
              ) : (
                <div className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">Todavia no hay producto destacado hoy.</div>
              )}
            </Card>
          </div>

          <Card title="Rentabilidad" description="Ventas, costos y ganancia bruta segun costos historicos de cada pedido.">
            <ProfitabilityCard metrics={profitMetrics} formatCurrency={formatCurrency} formatPercent={formatPercent} />
          </Card>

          <Card title="Alertas de rentabilidad" description="Senales del costeo actual del catalogo.">
            {profitabilityAlerts.length ? (
              <div className="space-y-3">
                {profitabilityAlerts.map((alert) => (
                  <div key={alert.id} className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    <span className="font-semibold">{alert.product_name ? `${alert.product_name}: ` : ''}</span>{alert.message}
                  </div>
                ))}
                <Link to="/costos" className="inline-flex rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">Ver costos y margenes</Link>
              </div>
            ) : (
              <div className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">
                No hay alertas activas.
                <Link to="/costos" className="ml-2 font-semibold text-slate-900">Ver costos y margenes</Link>
              </div>
            )}
          </Card>

          <div className="grid gap-6 xl:grid-cols-[0.8fr_1fr]">
            <Card title="Pedidos por estado" description="Incluye todos los pedidos del dia, tambien cancelados.">
              <StatusBreakdown values={summary?.orders_by_status ?? {
                pendiente: 0,
                aceptado: 0,
                preparando: 0,
                listo: 0,
                entregado: 0,
                cancelado: 0,
              }} />
            </Card>
            <Card title="Ultimos pedidos" description="Maximo 5 pedidos recientes.">
              <LastOrdersList orders={summary?.last_orders ?? []} formatCurrency={formatCurrency} formatTime={formatTime} />
            </Card>
          </div>
        </>
      )}

      <CreateBusinessModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={(business) => {
          setModalOpen(false);
          handleBusinessCreated(business);
        }}
      />
    </div>
  );
}
