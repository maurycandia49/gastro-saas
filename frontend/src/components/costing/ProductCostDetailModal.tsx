import { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { applySuggestedPrice, getCostingProduct, getSuggestedPrice, type ProductCost, type SuggestedPrice } from '../../services/costing';
import { getApiErrorMessage } from '../../services/apiErrors';
import { CostBreakdown } from './CostBreakdown';
import { CostHistoryChart } from './CostHistoryChart';
import { SuggestedPriceCard } from './SuggestedPriceCard';

interface ProductCostDetailModalProps {
  product: ProductCost | null;
  onClose: () => void;
  onUpdated: (product: ProductCost) => void;
  formatCurrency: (value: number) => string;
  formatPercent: (value: string | null) => string;
}

export function ProductCostDetailModal({ product, onClose, onUpdated, formatCurrency, formatPercent }: ProductCostDetailModalProps) {
  const [detail, setDetail] = useState<ProductCost | null>(product);
  const [targetMargin, setTargetMargin] = useState(35);
  const [suggestion, setSuggestion] = useState<SuggestedPrice | null>(product?.suggested_price ?? null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!product) return;
    const productId = product.product_id;
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        setError('');
        const response = await getCostingProduct(productId);
        if (!mounted) return;
        setDetail(response);
        setSuggestion(response.suggested_price);
      } catch (requestError) {
        if (mounted) setError(getApiErrorMessage(requestError, 'No pudimos cargar el detalle de costeo.'));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, [product]);

  useEffect(() => {
    if (!detail) return;
    const timeout = window.setTimeout(async () => {
      try {
        setSuggestion(await getSuggestedPrice(detail.product_id, targetMargin));
      } catch {
        setSuggestion(null);
      }
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [detail, targetMargin]);

  if (!product) return null;

  const current = detail ?? product;

  const handleApply = async () => {
    if (!window.confirm('¿Aplicar el precio sugerido al producto?')) return;
    try {
      setApplying(true);
      const response = await applySuggestedPrice(current.product_id, targetMargin);
      setDetail(response.product);
      onUpdated(response.product);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'No pudimos aplicar el precio sugerido.'));
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-slate-950/40 p-0 backdrop-blur-sm md:items-center md:justify-center md:p-6">
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl md:max-w-5xl md:rounded-3xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">Detalle de costeo</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">{current.name}</h2>
            <p className="mt-1 text-sm text-slate-500">{current.category}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100">
            <X size={20} />
          </button>
        </div>

        {loading ? <div className="mt-6 flex items-center gap-2 text-sm text-slate-500"><Loader2 className="animate-spin" size={16} /> Cargando detalle...</div> : null}
        {error ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

        <div className="mt-6 grid gap-4 md:grid-cols-5">
          <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Precio</p><p className="mt-1 font-semibold">{formatCurrency(Number(current.sale_price))}</p></div>
          <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Costo</p><p className="mt-1 font-semibold">{current.incomplete_recipe ? '—' : formatCurrency(Number(current.recipe_cost))}</p></div>
          <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Ganancia</p><p className="mt-1 font-semibold">{current.incomplete_recipe ? '—' : formatCurrency(Number(current.unit_profit))}</p></div>
          <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Margen</p><p className="mt-1 font-semibold">{formatPercent(current.margin_percentage)}</p></div>
          <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Markup</p><p className="mt-1 font-semibold">{formatPercent(current.markup_percentage)}</p></div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <h3 className="mb-3 font-semibold text-slate-900">Desglose de ingredientes</h3>
            <CostBreakdown items={current.cost_breakdown} formatCurrency={formatCurrency} />
          </div>
          <div className="space-y-5">
            <div className="rounded-3xl border border-slate-200 p-5">
              <h3 className="font-semibold text-slate-900">Produccion posible</h3>
              <p className="mt-2 text-sm text-slate-600">Unidades producibles: <span className="font-semibold">{current.available_units ?? 'Sin receta'}</span></p>
              <p className="mt-1 text-sm text-slate-600">Ingrediente limitante: <span className="font-semibold">{current.limiting_ingredient ?? '—'}</span></p>
            </div>
            <SuggestedPriceCard suggestion={suggestion} targetMargin={targetMargin} onTargetMarginChange={setTargetMargin} onApply={handleApply} applying={applying} formatCurrency={formatCurrency} />
            <div className="rounded-3xl border border-slate-200 p-5">
              <h3 className="mb-3 font-semibold text-slate-900">Historial</h3>
              <CostHistoryChart snapshots={current.snapshots ?? []} formatCurrency={formatCurrency} />
            </div>
            {current.active_alerts.length ? (
              <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
                <h3 className="font-semibold text-amber-900">Alertas activas</h3>
                <div className="mt-3 space-y-2">
                  {current.active_alerts.map((alert) => <p key={alert.id} className="text-sm text-amber-800">{alert.title}: {alert.message}</p>)}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
