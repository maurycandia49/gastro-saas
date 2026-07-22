import type { ProductCost } from '../../services/costing';

interface ProductCostTableProps {
  products: ProductCost[];
  onSelect: (product: ProductCost) => void;
  formatCurrency: (value: number) => string;
  formatPercent: (value: string | null) => string;
}

function status(product: ProductCost) {
  if (product.incomplete_recipe) return { label: 'Incompleta', className: 'bg-slate-100 text-slate-600' };
  if (Number(product.unit_profit) < 0) return { label: 'Negativa', className: 'bg-red-100 text-red-700' };
  if (product.margin_percentage !== null && Number(product.margin_percentage) < 20) return { label: 'Margen bajo', className: 'bg-amber-100 text-amber-700' };
  return { label: 'Saludable', className: 'bg-emerald-100 text-emerald-700' };
}

export function ProductCostTable({ products, onSelect, formatCurrency, formatPercent }: ProductCostTableProps) {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
      <div className="hidden grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr_0.7fr_0.7fr] gap-4 border-b border-slate-100 px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400 md:grid">
        <span>Producto</span>
        <span>Precio</span>
        <span>Costo</span>
        <span>Ganancia</span>
        <span>Margen</span>
        <span>Estado</span>
      </div>
      <div className="divide-y divide-slate-100">
        {products.map((product) => {
          const currentStatus = status(product);
          return (
            <button key={product.product_id} type="button" onClick={() => onSelect(product)} className="grid w-full gap-3 px-5 py-4 text-left transition hover:bg-slate-50 md:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr_0.7fr_0.7fr] md:items-center md:gap-4">
              <div>
                <p className="font-semibold text-slate-900">{product.name}</p>
                <p className="text-sm text-slate-500">{product.category}</p>
              </div>
              <p className="text-sm font-medium text-slate-700">{formatCurrency(Number(product.sale_price))}</p>
              <p className="text-sm font-medium text-slate-700">{product.incomplete_recipe ? '—' : formatCurrency(Number(product.recipe_cost))}</p>
              <p className={`text-sm font-semibold ${Number(product.unit_profit) < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{product.incomplete_recipe ? '—' : formatCurrency(Number(product.unit_profit))}</p>
              <p className="text-sm font-medium text-slate-700">{formatPercent(product.margin_percentage)}</p>
              <span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${currentStatus.className}`}>{currentStatus.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
