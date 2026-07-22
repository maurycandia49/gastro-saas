import { Boxes, Percent, ReceiptText, Tag, TrendingUp, Users, Warehouse } from 'lucide-react';
import type { SearchGroupKey, SearchResult } from '../../services/search';

const icons = {
  products: Boxes,
  categories: Tag,
  orders: ReceiptText,
  customers: Users,
  promotions: Percent,
  inventory: Warehouse,
  costing: TrendingUp,
};

function highlight(text: string, query: string) {
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (!query || index === -1) return text;
  return (
    <>
      {text.slice(0, index)}
      <mark className="rounded bg-amber-100 px-0.5 text-slate-900">{text.slice(index, index + query.length)}</mark>
      {text.slice(index + query.length)}
    </>
  );
}

export function SearchResultItem({ group, result, query, active, onSelect }: { group: SearchGroupKey; result: SearchResult; query: string; active: boolean; onSelect: () => void }) {
  const Icon = icons[group];
  return (
    <button type="button" onClick={onSelect} className={`flex w-full items-start gap-3 px-4 py-3 text-left transition ${active ? 'bg-slate-100' : 'hover:bg-slate-50'}`}>
      <span className="mt-0.5 rounded-xl bg-slate-900 p-2 text-white"><Icon size={15} /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-slate-900">{highlight(result.title, query)}</span>
        <span className="mt-0.5 block truncate text-xs text-slate-500">{highlight(result.subtitle || '', query)}</span>
      </span>
    </button>
  );
}
