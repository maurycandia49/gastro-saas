import { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getBusinesses } from '../../services/business';
import { getOpportunitiesSummary, type OpportunitySummary } from '../../services/opportunities';

export function HeaderOpportunityDropdown() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState<OpportunitySummary | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const businesses = await getBusinesses();
        const business = businesses.find((item) => item.active) ?? businesses[0] ?? null;
        if (!business) return;
        const response = await getOpportunitiesSummary(business.id);
        if (active) setSummary(response);
      } catch {
        if (active) setSummary(null);
      }
    }
    void load();
    const interval = window.setInterval(() => void load(), 300000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const listener = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', listener);
    return () => document.removeEventListener('mousedown', listener);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((value) => !value)} className="relative rounded-full p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" aria-label="Ver oportunidades">
        <Bell size={18} />
        {summary?.unread_count ? <span className="absolute -right-1 -top-1 rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">{summary.unread_count}</span> : null}
      </button>
      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-3xl border border-slate-200 bg-white p-3 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
          <p className="px-2 py-2 text-sm font-semibold text-slate-900 dark:text-slate-100">Oportunidades recientes</p>
          {summary?.top_opportunities.length ? summary.top_opportunities.map((item) => (
            <Link key={item.id} to="/oportunidades" onClick={() => setOpen(false)} className="block rounded-2xl px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
              <span className="block font-medium text-slate-900 dark:text-slate-100">{item.title}</span>
              <span className="line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{item.message}</span>
            </Link>
          )) : <p className="px-3 py-4 text-sm text-slate-500 dark:text-slate-400">No hay oportunidades activas.</p>}
          <Link to="/oportunidades" onClick={() => setOpen(false)} className="mt-2 block rounded-2xl bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white dark:bg-slate-100 dark:text-slate-950">Ver Centro de Oportunidades</Link>
        </div>
      ) : null}
    </div>
  );
}
