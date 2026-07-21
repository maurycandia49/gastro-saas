import { useEffect, useMemo, useState } from 'react';
import { Edit3, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/dashboard/EmptyState';
import { SuccessToast } from '../components/dashboard/SuccessToast';
import { CategoriesSkeleton } from '../components/categories/CategoriesSkeleton';
import { CategoryFormModal } from '../components/categories/CategoryFormModal';
import { DeleteCategoryDialog } from '../components/categories/DeleteCategoryDialog';
import { createCategory, deleteCategory, getCategories, updateCategory, type Category, type CategoryPayload } from '../services/categories';
import { getBusinesses, type Business } from '../services/business';
import { getApiErrorMessage } from '../services/apiErrors';

type ToastState = {
  type: 'success' | 'error';
  message: string;
} | null;

function getErrorMessage(error: unknown, fallback: string) {
  return getApiErrorMessage(error, fallback);
}

export function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<ToastState>(null);

  const activeCategories = useMemo(
    () => categories.filter((category) => category.active).sort((first, second) => first.order - second.order || first.name.localeCompare(second.name)),
    [categories],
  );

  const showToast = (nextToast: ToastState) => {
    setToast(nextToast);
    window.setTimeout(() => setToast(null), 2800);
  };

  const loadData = async (mode: 'initial' | 'refresh' = 'initial') => {
    try {
      if (mode === 'initial') {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      setError('');
      const [businessesResponse, categoriesResponse] = await Promise.all([getBusinesses(), getCategories()]);
      setBusinesses(businessesResponse.filter((business) => business.active !== false));
      setCategories(categoriesResponse);
    } catch (requestError) {
      const message = getErrorMessage(requestError, 'No pudimos cargar las categorias en este momento.');
      setError(message);
      showToast({ type: 'error', message });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    async function loadInitialData() {
      try {
        setLoading(true);
        setError('');
        const [businessesResponse, categoriesResponse] = await Promise.all([getBusinesses(), getCategories()]);

        if (!isMounted) {
          return;
        }

        setBusinesses(businessesResponse.filter((business) => business.active !== false));
        setCategories(categoriesResponse);
      } catch (requestError) {
        if (isMounted) {
          const message = getErrorMessage(requestError, 'No pudimos cargar las categorias en este momento.');
          setError(message);
          showToast({ type: 'error', message });
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadInitialData();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleCreate = () => {
    setSelectedCategory(null);
    setModalOpen(true);
  };

  const handleEdit = (category: Category) => {
    setSelectedCategory(category);
    setModalOpen(true);
  };

  const handleSubmit = async (payload: CategoryPayload) => {
    try {
      setSubmitting(true);

      if (selectedCategory) {
        const updatedCategory = await updateCategory(selectedCategory.id, payload);
        setCategories((current) => current.map((category) => (category.id === updatedCategory.id ? updatedCategory : category)));
        showToast({ type: 'success', message: 'Categoria actualizada correctamente.' });
      } else {
        const newCategory = await createCategory(payload);
        setCategories((current) => [...current, newCategory]);
        showToast({ type: 'success', message: 'Categoria creada correctamente.' });
      }

      setModalOpen(false);
      setSelectedCategory(null);
    } catch (requestError) {
      showToast({ type: 'error', message: getErrorMessage(requestError, 'No se pudo guardar la categoria.') });
      throw requestError;
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!categoryToDelete) {
      return;
    }

    try {
      setDeleting(true);
      await deleteCategory(categoryToDelete.id);
      setCategories((current) => current.filter((category) => category.id !== categoryToDelete.id));
      showToast({ type: 'success', message: 'Categoria eliminada correctamente.' });
      setCategoryToDelete(null);
    } catch (requestError) {
      showToast({ type: 'error', message: getErrorMessage(requestError, 'No se pudo eliminar la categoria.') });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Categorias</p>
          <h1 className="text-3xl font-semibold text-slate-900">Organizar tu menu</h1>
          <p className="max-w-2xl text-sm text-slate-500">Gestiona las categorias activas que ordenan la experiencia de compra.</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button type="button" onClick={() => void loadData('refresh')} disabled={loading || refreshing} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70">
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            Actualizar
          </button>
          <button type="button" onClick={handleCreate} disabled={loading || businesses.length === 0} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70">
            <Plus size={16} />
            Nueva categoria
          </button>
        </div>
      </div>

      {toast?.type === 'success' ? <SuccessToast message={toast.message} /> : null}
      {toast?.type === 'error' ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm">{toast.message}</div> : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm font-medium text-slate-500">Activas</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{loading ? '-' : activeCategories.length}</p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-slate-500">Negocios disponibles</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{loading ? '-' : businesses.length}</p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-slate-500">Primer orden</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{loading || activeCategories.length === 0 ? '-' : activeCategories[0].order}</p>
        </Card>
      </div>

      <Card title="Listado de categorias" description="Solo se muestran categorias activas, ordenadas por el campo order.">
        {loading ? (
          <CategoriesSkeleton />
        ) : error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">{error}</div>
        ) : businesses.length === 0 ? (
          <EmptyState title="Primero crea un negocio." description="Las categorias necesitan estar asociadas a un negocio para poder publicarse." />
        ) : activeCategories.length === 0 ? (
          <div className="space-y-4">
            <EmptyState title="Aun no hay categorias activas." description="Crea la primera categoria para ordenar productos por secciones." />
            <button type="button" onClick={handleCreate} className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800">
              <Plus size={16} />
              Crear categoria
            </button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <div className="grid grid-cols-[90px_1fr_140px] gap-4 bg-slate-50 px-4 py-3 text-xs font-medium uppercase tracking-[0.16em] text-slate-500 max-md:hidden">
              <span>Orden</span>
              <span>Categoria</span>
              <span className="text-right">Acciones</span>
            </div>
            <div className="divide-y divide-slate-200">
              {activeCategories.map((category) => (
                <article key={category.id} className="grid gap-4 px-4 py-4 md:grid-cols-[90px_1fr_140px] md:items-center">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-sm font-semibold text-slate-700">{category.order}</span>
                    <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400 md:hidden">Orden</span>
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-slate-900">{category.name}</h3>
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">Activa</span>
                    </div>
                    {category.description ? <p className="mt-1 text-sm text-slate-500">{category.description}</p> : <p className="mt-1 text-sm text-slate-400">Sin descripcion.</p>}
                  </div>

                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => handleEdit(category)} disabled={submitting || deleting} className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60" aria-label={`Editar ${category.name}`}>
                      <Edit3 size={16} />
                    </button>
                    <button type="button" onClick={() => setCategoryToDelete(category)} disabled={submitting || deleting} className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-rose-200 text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60" aria-label={`Eliminar ${category.name}`}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </Card>

      <CategoryFormModal open={modalOpen} category={selectedCategory} businesses={businesses} submitting={submitting} onClose={() => setModalOpen(false)} onSubmit={handleSubmit} />
      <DeleteCategoryDialog category={categoryToDelete} deleting={deleting} onCancel={() => setCategoryToDelete(null)} onConfirm={() => void handleDelete()} />
    </div>
  );
}
