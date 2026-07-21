import { useEffect, useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { DeletePromotionDialog } from '../components/promotions/DeletePromotionDialog';
import { getPromotionState, PromotionCard } from '../components/promotions/PromotionCard';
import { PromotionFormModal } from '../components/promotions/PromotionFormModal';
import { PromotionsSkeleton } from '../components/promotions/PromotionsSkeleton';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/dashboard/EmptyState';
import { SuccessToast } from '../components/dashboard/SuccessToast';
import { getApiErrorMessage } from '../services/apiErrors';
import { getBusinesses, type Business } from '../services/business';
import { getCategories, type Category } from '../services/categories';
import { getProducts, type Product } from '../services/products';
import { createPromotion, deletePromotion, getPromotions, updatePromotion, type Promotion, type PromotionPayload } from '../services/promotions';

type Filter = 'all' | 'activa' | 'proxima' | 'vencida' | 'inactiva';
type Toast = { type: 'success' | 'error'; message: string } | null;

export function PromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedPromotion, setSelectedPromotion] = useState<Promotion | null>(null);
  const [promotionToDelete, setPromotionToDelete] = useState<Promotion | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [toast, setToast] = useState<Toast>(null);

  const showToast = (next: Toast) => {
    setToast(next);
    window.setTimeout(() => setToast(null), 2600);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [businessResponse, productResponse, categoryResponse, promotionResponse] = await Promise.all([getBusinesses(), getProducts(), getCategories(), getPromotions()]);
      setBusinesses(businessResponse.filter((business) => business.active !== false));
      setProducts(productResponse);
      setCategories(categoryResponse);
      setPromotions(promotionResponse);
    } catch (error) {
      showToast({ type: 'error', message: getApiErrorMessage(error, 'No pudimos cargar promociones.') });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const filteredPromotions = useMemo(() => {
    const query = search.trim().toLowerCase();
    return promotions.filter((promotion) => {
      const state = getPromotionState(promotion);
      return (filter === 'all' || state === filter) && (!query || promotion.name.toLowerCase().includes(query));
    });
  }, [filter, promotions, search]);

  const handleSubmit = async (payload: PromotionPayload) => {
    try {
      setSubmitting(true);
      if (selectedPromotion) {
        const updated = await updatePromotion(selectedPromotion.id, payload);
        setPromotions((current) => current.map((promotion) => (promotion.id === updated.id ? updated : promotion)));
        showToast({ type: 'success', message: 'Promocion actualizada.' });
      } else {
        const created = await createPromotion(payload);
        setPromotions((current) => [created, ...current]);
        showToast({ type: 'success', message: 'Promocion creada.' });
      }
      setModalOpen(false);
      setSelectedPromotion(null);
    } catch (error) {
      showToast({ type: 'error', message: getApiErrorMessage(error, 'No pudimos guardar la promocion.') });
      throw error;
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (promotion: Promotion) => {
    try {
      const updated = await updatePromotion(promotion.id, { active: !promotion.active });
      setPromotions((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      showToast({ type: 'success', message: updated.active ? 'Promocion activada.' : 'Promocion desactivada.' });
    } catch (error) {
      showToast({ type: 'error', message: getApiErrorMessage(error, 'No pudimos cambiar el estado.') });
    }
  };

  const handleDelete = async () => {
    if (!promotionToDelete) return;
    try {
      setDeleting(true);
      await deletePromotion(promotionToDelete.id);
      setPromotions((current) => current.filter((promotion) => promotion.id !== promotionToDelete.id));
      setPromotionToDelete(null);
      showToast({ type: 'success', message: 'Promocion eliminada.' });
    } catch (error) {
      showToast({ type: 'error', message: getApiErrorMessage(error, 'No pudimos eliminar la promocion.') });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div><p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Promociones</p><h1 className="mt-2 text-3xl font-semibold text-slate-900">Promociones y ofertas</h1><p className="mt-2 text-sm text-slate-500">Descuentos simples aplicados automaticamente al menu y pedidos.</p></div>
        <button onClick={() => { setSelectedPromotion(null); setModalOpen(true); }} disabled={businesses.length === 0 || products.length + categories.length === 0} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"><Plus size={17} />Nueva promocion</button>
      </div>
      {toast?.type === 'success' ? <SuccessToast message={toast.message} /> : null}
      {toast?.type === 'error' ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{toast.message}</div> : null}
      <Card>
        <div className="grid gap-3 md:grid-cols-[1fr_220px]">
          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"><Search size={18} className="text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar promocion" className="flex-1 bg-transparent text-sm outline-none" /></label>
          <select value={filter} onChange={(event) => setFilter(event.target.value as Filter)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"><option value="all">Todas</option><option value="activa">Activas</option><option value="proxima">Proximas</option><option value="vencida">Vencidas</option><option value="inactiva">Inactivas</option></select>
        </div>
      </Card>
      {loading ? <PromotionsSkeleton /> : filteredPromotions.length === 0 ? <EmptyState title="No hay promociones" description="Crea descuentos por producto o categoria para destacarlos en el menu." /> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredPromotions.map((promotion) => <PromotionCard key={promotion.id} promotion={promotion} onEdit={() => { setSelectedPromotion(promotion); setModalOpen(true); }} onToggle={() => void handleToggle(promotion)} onDelete={() => setPromotionToDelete(promotion)} />)}
        </div>
      )}
      <PromotionFormModal open={modalOpen} promotion={selectedPromotion} businesses={businesses} products={products} categories={categories} submitting={submitting} onClose={() => setModalOpen(false)} onSubmit={handleSubmit} />
      <DeletePromotionDialog promotion={promotionToDelete} deleting={deleting} onCancel={() => setPromotionToDelete(null)} onConfirm={() => void handleDelete()} />
    </div>
  );
}
