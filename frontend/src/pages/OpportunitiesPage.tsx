import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { BusinessHealthCard } from '../components/opportunities/BusinessHealthCard';
import { OpportunitiesEmptyState } from '../components/opportunities/OpportunitiesEmptyState';
import { OpportunityCard } from '../components/opportunities/OpportunityCard';
import { OpportunityFilters } from '../components/opportunities/OpportunityFilters';
import { OpportunitiesSkeleton } from '../components/opportunities/OpportunitiesSkeleton';
import { getApiErrorMessage } from '../services/apiErrors';
import { getBusinesses, type Business } from '../services/business';
import { generateOpportunities, getBusinessHealth, getOpportunities, updateOpportunity, type BusinessHealth, type Opportunity } from '../services/opportunities';

export function OpportunitiesPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [businessId, setBusinessId] = useState<number | null>(null);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [health, setHealth] = useState<BusinessHealth | null>(null);
  const [category, setCategory] = useState('all');
  const [severity, setSeverity] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async (selected?: number, generate = false) => {
    if (generate && refreshing) return;
    try {
      generate ? setRefreshing(true) : setLoading(true);
      setError('');
      const loadedBusinesses = businesses.length ? businesses : await getBusinesses();
      if (!businesses.length) setBusinesses(loadedBusinesses);
      const id = selected ?? businessId ?? loadedBusinesses.find((business) => business.active)?.id ?? loadedBusinesses[0]?.id ?? null;
      setBusinessId(id);
      if (!id) return;
      if (generate) await generateOpportunities(id);
      const [items, healthResponse] = await Promise.all([
        getOpportunities(id, { active: true, dismissed: false }),
        getBusinessHealth(id),
      ]);
      setOpportunities(items);
      setHealth(healthResponse);
      setLastUpdated(new Date());
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'No pudimos cargar oportunidades.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [businessId, businesses, refreshing]);

  useEffect(() => {
    void load(undefined, false);
  }, []);

  useEffect(() => {
    if (!businessId) return undefined;
    const interval = window.setInterval(() => void load(businessId, false), 300000);
    return () => window.clearInterval(interval);
  }, [businessId, load]);

  const filtered = useMemo(() => opportunities.filter((item) => {
    if (category !== 'all' && item.category !== category) return false;
    if (severity && item.severity !== severity) return false;
    return true;
  }), [category, opportunities, severity]);

  const groups = {
    attention: filtered.filter((item) => ['critical', 'warning'].includes(item.severity)),
    growth: filtered.filter((item) => item.severity === 'info'),
    wins: filtered.filter((item) => item.severity === 'success'),
    reviewed: opportunities.filter((item) => item.read || item.dismissed || !item.active),
  };

  const patchOpportunity = async (id: number, payload: { read?: boolean; dismissed?: boolean }) => {
    const updated = await updateOpportunity(id, payload);
    setOpportunities((current) => current.map((item) => item.id === id ? updated : item).filter((item) => !item.dismissed));
  };

  if (loading) return <OpportunitiesSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Centro de Oportunidades</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Acciones concretas para mejorar</h1>
          <p className="mt-2 text-sm text-slate-500">Acciones concretas para vender mas, perder menos y trabajar mejor.</p>
          {lastUpdated ? <p className="mt-2 text-xs text-slate-400">Ultima actualizacion: {new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' }).format(lastUpdated)}</p> : null}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          {businesses.length > 1 ? <select value={businessId ?? ''} onChange={(event) => void load(Number(event.target.value), false)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">{businesses.map((business) => <option key={business.id} value={business.id}>{business.name}</option>)}</select> : null}
          <button onClick={() => businessId && void load(businessId, true)} disabled={refreshing} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
            {refreshing ? <Loader2 className="animate-spin" size={17} /> : <RefreshCw size={17} />}
            Analizar ahora
          </button>
        </div>
      </div>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {health ? <BusinessHealthCard health={health} /> : null}
      <OpportunityFilters category={category} severity={severity} onCategory={setCategory} onSeverity={setSeverity} />

      {filtered.length === 0 ? <OpportunitiesEmptyState /> : null}
      {groups.attention.length ? <section className="space-y-3"><h2 className="text-xl font-semibold text-slate-900">Requieren atencion</h2><div className="grid gap-4 lg:grid-cols-2">{groups.attention.map((item) => <OpportunityCard key={item.id} opportunity={item} onRead={() => void patchOpportunity(item.id, { read: true })} onDismiss={() => void patchOpportunity(item.id, { dismissed: true })} />)}</div></section> : null}
      {groups.growth.length ? <section className="space-y-3"><h2 className="text-xl font-semibold text-slate-900">Oportunidades de crecimiento</h2><div className="grid gap-4 lg:grid-cols-2">{groups.growth.map((item) => <OpportunityCard key={item.id} opportunity={item} onRead={() => void patchOpportunity(item.id, { read: true })} onDismiss={() => void patchOpportunity(item.id, { dismissed: true })} />)}</div></section> : null}
      {groups.wins.length ? <section className="space-y-3"><h2 className="text-xl font-semibold text-slate-900">Logros recientes</h2><div className="grid gap-4 lg:grid-cols-2">{groups.wins.map((item) => <OpportunityCard key={item.id} opportunity={item} onRead={() => void patchOpportunity(item.id, { read: true })} onDismiss={() => void patchOpportunity(item.id, { dismissed: true })} />)}</div></section> : null}
    </div>
  );
}
