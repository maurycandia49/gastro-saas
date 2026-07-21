import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search, Users } from 'lucide-react';
import { CustomerCard } from '../components/customers/CustomerCard';
import { CustomerDetailModal } from '../components/customers/CustomerDetailModal';
import { CustomersSkeleton } from '../components/customers/CustomersSkeleton';
import { EmptyState } from '../components/dashboard/EmptyState';
import { Card } from '../components/ui/Card';
import { getApiErrorMessage } from '../services/apiErrors';
import { getBusinesses, type Business } from '../services/business';
import { getCustomerDetail, getCustomers, type CustomerDetail, type CustomerSummary } from '../services/customers';

type FilterMode = 'all' | 'new' | 'recurring' | 'vip';
type SortMode = 'spent' | 'orders' | 'recent';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

export function CustomersPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState<number | null>(null);
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterMode>('all');
  const [sort, setSort] = useState<SortMode>('spent');

  const loadCustomers = async (businessId: number) => {
    try {
      setLoading(true);
      setError('');
      const response = await getCustomers(businessId);
      setCustomers(response);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'No pudimos cargar los clientes.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    async function bootstrap() {
      try {
        setLoading(true);
        const businessResponse = await getBusinesses();
        setBusinesses(businessResponse);
        const selected = businessResponse.find((business) => business.active) ?? businessResponse[0] ?? null;
        setSelectedBusinessId(selected?.id ?? null);
        if (selected) {
          await loadCustomers(selected.id);
        } else {
          setLoading(false);
        }
      } catch (requestError) {
        setError(getApiErrorMessage(requestError, 'No pudimos cargar la seccion de clientes.'));
        setLoading(false);
      }
    }

    void bootstrap();
  }, []);

  const filteredCustomers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return customers
      .filter((customer) => {
        if (filter === 'vip') return customer.is_vip;
        if (filter === 'recurring') return customer.is_recurring && !customer.is_vip;
        if (filter === 'new') return !customer.is_recurring && !customer.is_vip;
        return true;
      })
      .filter((customer) => !normalizedSearch || customer.name.toLowerCase().includes(normalizedSearch) || customer.phone.includes(normalizedSearch))
      .sort((first, second) => {
        if (sort === 'orders') return second.orders_count - first.orders_count;
        if (sort === 'recent') return new Date(second.last_order_at).getTime() - new Date(first.last_order_at).getTime();
        return Number(second.total_spent) - Number(first.total_spent);
      });
  }, [customers, filter, search, sort]);

  const recurringCount = customers.filter((customer) => customer.is_recurring).length;
  const vipCount = customers.filter((customer) => customer.is_vip).length;
  const averageSpend = customers.length > 0 ? customers.reduce((total, customer) => total + Number(customer.total_spent), 0) / customers.length : 0;

  const handleBusinessChange = (businessId: number) => {
    setSelectedBusinessId(businessId);
    void loadCustomers(businessId);
  };

  const handleSelectCustomer = async (customer: CustomerSummary) => {
    if (!selectedBusinessId) return;
    setDetailOpen(true);
    setSelectedCustomer(null);
    setDetailError('');
    try {
      setDetailLoading(true);
      const detail = await getCustomerDetail(selectedBusinessId, customer.phone);
      setSelectedCustomer(detail);
    } catch (requestError) {
      setDetailError(getApiErrorMessage(requestError, 'No pudimos cargar el detalle del cliente.'));
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Clientes</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Clientes frecuentes</h1>
          <p className="mt-2 text-sm text-slate-500">Clientes consolidados automaticamente desde pedidos reales.</p>
        </div>
        {businesses.length > 1 ? (
          <label className="block sm:w-64">
            <span className="mb-2 block text-sm font-medium text-slate-700">Negocio</span>
            <select value={selectedBusinessId ?? ''} onChange={(event) => handleBusinessChange(Number(event.target.value))} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400">
              {businesses.map((business) => <option key={business.id} value={business.id}>{business.name}</option>)}
            </select>
          </label>
        ) : null}
      </div>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <div className="grid gap-4 sm:grid-cols-4">
        <Card><p className="text-sm text-slate-500">Clientes</p><p className="mt-2 text-3xl font-semibold text-slate-900">{loading ? '-' : customers.length}</p></Card>
        <Card><p className="text-sm text-slate-500">Recurrentes</p><p className="mt-2 text-3xl font-semibold text-slate-900">{loading ? '-' : recurringCount}</p></Card>
        <Card><p className="text-sm text-slate-500">VIP</p><p className="mt-2 text-3xl font-semibold text-slate-900">{loading ? '-' : vipCount}</p></Card>
        <Card><p className="text-sm text-slate-500">Gasto promedio</p><p className="mt-2 text-3xl font-semibold text-slate-900">{loading ? '-' : formatCurrency(averageSpend)}</p></Card>
      </div>

      <Card>
        <div className="grid gap-3 lg:grid-cols-[1fr_180px_200px]">
          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <Search size={18} className="text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre o telefono" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
          </label>
          <select value={filter} onChange={(event) => setFilter(event.target.value as FilterMode)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400">
            <option value="all">Todos</option>
            <option value="new">Nuevos</option>
            <option value="recurring">Recurrentes</option>
            <option value="vip">VIP</option>
          </select>
          <select value={sort} onChange={(event) => setSort(event.target.value as SortMode)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400">
            <option value="spent">Mayor gasto</option>
            <option value="orders">Mas pedidos</option>
            <option value="recent">Compra mas reciente</option>
          </select>
        </div>
      </Card>

      {loading ? (
        <CustomersSkeleton />
      ) : businesses.length === 0 ? (
        <Card><EmptyState title="Aun no hay negocio." description="Crea un negocio para empezar a consolidar clientes desde pedidos." /></Card>
      ) : customers.length === 0 ? (
        <Card>
          <div className="py-10 text-center">
            <Users className="mx-auto text-slate-300" size={38} />
            <h2 className="mt-4 text-lg font-semibold text-slate-900">Aun no hay clientes consolidados</h2>
            <p className="mt-2 text-sm text-slate-500">Apareceran aca cuando entren pedidos no cancelados con telefono.</p>
          </div>
        </Card>
      ) : filteredCustomers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">No hay clientes que coincidan con la busqueda.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredCustomers.map((customer) => (
            <CustomerCard key={customer.phone} customer={customer} formatCurrency={formatCurrency} formatDate={formatDate} onSelect={() => void handleSelectCustomer(customer)} />
          ))}
        </div>
      )}

      {loading && selectedBusinessId ? (
        <div className="fixed bottom-5 right-5 inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white shadow-xl">
          <Loader2 className="animate-spin" size={17} />
          Actualizando clientes
        </div>
      ) : null}

      <CustomerDetailModal open={detailOpen} customer={selectedCustomer} loading={detailLoading} error={detailError} formatCurrency={formatCurrency} formatDateTime={formatDateTime} onClose={() => setDetailOpen(false)} />
    </div>
  );
}
