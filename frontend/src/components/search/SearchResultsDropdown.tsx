import { Loader2 } from 'lucide-react';
import type { SearchGroupKey, SearchResult, SearchResults } from '../../services/search';
import { SearchEmptyState } from './SearchEmptyState';
import { SearchResultItem } from './SearchResultItem';

const labels: Record<SearchGroupKey, string> = {
  products: 'Productos',
  categories: 'Categorias',
  orders: 'Pedidos',
  customers: 'Clientes',
  promotions: 'Promociones',
  inventory: 'Inventario',
  costing: 'Costos y margenes',
};

const order: SearchGroupKey[] = ['products', 'categories', 'orders', 'customers', 'promotions', 'inventory', 'costing'];

export function flattenResults(results: SearchResults | null) {
  if (!results) return [];
  return order.flatMap((group) => results[group].map((result) => ({ group, result })));
}

export function SearchResultsDropdown({
  query,
  results,
  loading,
  error,
  activeIndex,
  onSelect,
  onRetry,
}: {
  query: string;
  results: SearchResults | null;
  loading: boolean;
  error: string;
  activeIndex: number;
  onSelect: (result: SearchResult) => void;
  onRetry: () => void;
}) {
  const flat = flattenResults(results);

  if (!query) return null;

  return (
    <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[75vh] overflow-y-auto rounded-3xl border border-slate-200 bg-white py-2 shadow-2xl sm:max-h-[70vh]">
      {query.length < 2 ? <SearchEmptyState message="Escribi al menos 2 caracteres" /> : null}
      {query.length >= 2 && loading ? <div className="flex items-center gap-2 px-4 py-6 text-sm text-slate-500"><Loader2 className="animate-spin" size={16} /> Buscando...</div> : null}
      {query.length >= 2 && error ? (
        <div className="px-4 py-5 text-sm text-red-600">
          {error}
          <button type="button" onClick={onRetry} className="ml-2 font-semibold text-slate-900">Reintentar</button>
        </div>
      ) : null}
      {query.length >= 2 && !loading && !error && flat.length === 0 ? <SearchEmptyState message={`No encontramos resultados para '${query}'`} /> : null}
      {query.length >= 2 && !loading && !error && flat.length > 0 ? (
        <div>
          {order.map((group) => {
            const groupResults = results?.[group] ?? [];
            if (!groupResults.length) return null;
            return (
              <section key={group} className="py-1">
                <div className="flex items-center justify-between px-4 py-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{labels[group]}</p>
                  {groupResults.length >= 5 ? <span className="text-xs text-slate-400">Ver todos</span> : null}
                </div>
                {groupResults.map((result) => {
                  const index = flat.findIndex((item) => item.group === group && item.result.id === result.id);
                  return <SearchResultItem key={`${group}-${result.id}`} group={group} result={result} query={query} active={index === activeIndex} onSelect={() => onSelect(result)} />;
                })}
              </section>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
