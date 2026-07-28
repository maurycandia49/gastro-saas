import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getBusinesses } from '../../services/business';
import { globalSearch, type SearchResult, type SearchResults } from '../../services/search';
import { getApiErrorMessage } from '../../services/apiErrors';
import { flattenResults, SearchResultsDropdown } from './SearchResultsDropdown';

export function GlobalSearch() {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [businessId, setBusinessId] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const flatResults = useMemo(() => flattenResults(results), [results]);

  useEffect(() => {
    let active = true;
    void getBusinesses().then((businesses) => {
      if (!active) return;
      const selected = businesses.find((business) => business.active) ?? businesses[0] ?? null;
      setBusinessId(selected?.id ?? null);
    });
    return () => {
      active = false;
    };
  }, []);

  const runSearch = () => {
    if (!businessId || query.trim().length < 2) {
      setResults(null);
      return;
    }
    setLoading(true);
    setError('');
    void globalSearch(businessId, query.trim())
      .then((response) => {
        setResults(response);
        setActiveIndex(0);
      })
      .catch((requestError) => setError(getApiErrorMessage(requestError, 'No pudimos buscar en Pedilo.')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!open) return undefined;
    const timeout = window.setTimeout(runSearch, 300);
    return () => window.clearTimeout(timeout);
  }, [businessId, open, query]);

  useEffect(() => {
    const onDocumentMouseDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocumentMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocumentMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const selectResult = (result: SearchResult) => {
    setOpen(false);
    setQuery('');
    setResults(null);
    navigate(result.url);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, Math.max(flatResults.length - 1, 0)));
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    }
    if (event.key === 'Enter' && flatResults[activeIndex]) {
      event.preventDefault();
      selectResult(flatResults[activeIndex].result);
    }
  };

  return (
    <div ref={rootRef} className="relative w-full max-w-xl">
      <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 transition focus-within:border-slate-400 focus-within:bg-white dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:focus-within:border-slate-600 dark:focus-within:bg-slate-900">
        <Search size={16} />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Buscar productos, pedidos, clientes..."
          className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
        />
        <kbd className="hidden rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 sm:inline">Ctrl K</kbd>
      </div>
      {open ? <SearchResultsDropdown query={query} results={results} loading={loading} error={error} activeIndex={activeIndex} onSelect={selectResult} onRetry={runSearch} /> : null}
    </div>
  );
}
