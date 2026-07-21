import { useEffect, useMemo, useState } from 'react';
import { Copy, Edit3, PackageOpen, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/dashboard/EmptyState';
import { SuccessToast } from '../components/dashboard/SuccessToast';
import { ProductFormModal } from '../components/products/ProductFormModal';
import { DeleteProductDialog } from '../components/products/DeleteProductDialog';
import { ProductsSkeleton } from '../components/products/ProductsSkeleton';
import { getBusinesses, type Business } from '../services/business';
import { getCategories, type Category } from '../services/categories';
import { createProduct, deleteProduct, getProducts, updateProduct, type Product, type ProductPayload } from '../services/products';
import { getApiErrorMessage } from '../services/apiErrors';
import { RecipeModal } from '../components/recipes/RecipeModal';
import { getInventory, type Ingredient } from '../services/inventory';

type ToastState = { type: 'success' | 'error'; message: string } | null;

function getErrorMessage(error: unknown, fallback: string) {
  return getApiErrorMessage(error, fallback);
}

function formatPrice(price: string) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(price));
}

function shortText(value: string) {
  return value.length > 95 ? `${value.slice(0, 95)}...` : value;
}

export function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [recipeProduct, setRecipeProduct] = useState<Product | null>(null);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<ToastState>(null);

  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const sortedProducts = useMemo(() => [...products].sort((first, second) => first.order - second.order || first.name.localeCompare(second.name)), [products]);

  const showToast = (nextToast: ToastState) => {
    setToast(nextToast);
    window.setTimeout(() => setToast(null), 2800);
  };

  const loadData = async (mode: 'initial' | 'refresh' = 'initial') => {
    try {
      mode === 'initial' ? setLoading(true) : setRefreshing(true);
      setError('');
      const [businessesResponse, categoriesResponse, productsResponse, ingredientsResponse] = await Promise.all([getBusinesses(), getCategories(), getProducts(), getInventory()]);
      setBusinesses(businessesResponse.filter((business) => business.active !== false));
      setCategories(categoriesResponse.filter((category) => category.active));
      setProducts(productsResponse);
      setIngredients(ingredientsResponse);
    } catch (requestError) {
      const message = getErrorMessage(requestError, 'No pudimos cargar los productos en este momento.');
      setError(message);
      showToast({ type: 'error', message });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleSubmit = async (payload: ProductPayload) => {
    try {
      setSubmitting(true);
      if (selectedProduct) {
        const updatedProduct = await updateProduct(selectedProduct.id, payload);
        setProducts((current) => current.map((product) => (product.id === updatedProduct.id ? updatedProduct : product)));
        showToast({ type: 'success', message: 'Producto actualizado correctamente.' });
      } else {
        const newProduct = await createProduct(payload);
        setProducts((current) => [...current, newProduct]);
        showToast({ type: 'success', message: 'Producto creado correctamente.' });
      }
      setModalOpen(false);
      setSelectedProduct(null);
    } catch (requestError) {
      showToast({ type: 'error', message: getErrorMessage(requestError, 'No se pudo guardar el producto.') });
      throw requestError;
    } finally {
      setSubmitting(false);
    }
  };

  const handleDuplicate = async (product: Product) => {
    try {
      setSubmitting(true);
      const duplicated = await createProduct({
        negocio: product.negocio,
        categoria: product.categoria,
        name: `${product.name} copia`,
        description: product.description,
        price: product.price,
        cost_price: product.cost_price,
        image: product.image ?? '',
        available: product.available,
        featured: product.featured,
        order: product.order + 1,
      });
      setProducts((current) => [...current, duplicated]);
      showToast({ type: 'success', message: 'Producto duplicado correctamente.' });
    } catch (requestError) {
      showToast({ type: 'error', message: getErrorMessage(requestError, 'No se pudo duplicar el producto.') });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAvailability = async (product: Product) => {
    try {
      const updatedProduct = await updateProduct(product.id, { available: !product.available });
      setProducts((current) => current.map((currentProduct) => (currentProduct.id === updatedProduct.id ? updatedProduct : currentProduct)));
      showToast({ type: 'success', message: updatedProduct.available ? 'Producto disponible.' : 'Producto marcado como agotado.' });
    } catch (requestError) {
      showToast({ type: 'error', message: getErrorMessage(requestError, 'No se pudo cambiar la disponibilidad.') });
    }
  };

  const handleDelete = async () => {
    if (!productToDelete) return;
    try {
      setDeleting(true);
      await deleteProduct(productToDelete.id);
      setProducts((current) => current.filter((product) => product.id !== productToDelete.id));
      setProductToDelete(null);
      showToast({ type: 'success', message: 'Producto eliminado correctamente.' });
    } catch (requestError) {
      showToast({ type: 'error', message: getErrorMessage(requestError, 'No se pudo eliminar el producto.') });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Productos</p>
          <h1 className="text-3xl font-semibold text-slate-900">Tu menu digital</h1>
          <p className="max-w-2xl text-sm text-slate-500">Gestiona platos, precios y disponibilidad con una vista rapida de operacion.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button type="button" onClick={() => void loadData('refresh')} disabled={loading || refreshing} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-70">
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            Actualizar
          </button>
          <button type="button" onClick={() => { setSelectedProduct(null); setModalOpen(true); }} disabled={loading || businesses.length === 0 || categories.length === 0} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70">
            <Plus size={16} />
            Nuevo producto
          </button>
        </div>
      </div>

      {toast?.type === 'success' ? <SuccessToast message={toast.message} /> : null}
      {toast?.type === 'error' ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm">{toast.message}</div> : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><p className="text-sm font-medium text-slate-500">Total</p><p className="mt-2 text-3xl font-semibold text-slate-900">{loading ? '-' : products.length}</p></Card>
        <Card><p className="text-sm font-medium text-slate-500">Disponibles</p><p className="mt-2 text-3xl font-semibold text-slate-900">{loading ? '-' : products.filter((product) => product.available).length}</p></Card>
        <Card><p className="text-sm font-medium text-slate-500">Agotados</p><p className="mt-2 text-3xl font-semibold text-slate-900">{loading ? '-' : products.filter((product) => !product.available).length}</p></Card>
      </div>

      {loading ? (
        <ProductsSkeleton />
      ) : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">{error}</div>
      ) : businesses.length === 0 || categories.length === 0 ? (
        <EmptyState title="Falta preparar el menu." description="Crea al menos un negocio y una categoria activa antes de cargar productos." />
      ) : sortedProducts.length === 0 ? (
        <div className="space-y-4">
          <EmptyState title="Aun no hay productos." description="Carga tu primer plato para empezar a vender desde el menu digital." />
          <button type="button" onClick={() => setModalOpen(true)} className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800"><Plus size={16} />Crear producto</button>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {sortedProducts.map((product) => {
            const category = categoryById.get(product.categoria);
            return (
              <article key={product.id} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
                <div className="relative h-44 bg-slate-100">
                  {product.image ? <img src={product.image} alt={product.name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-slate-400"><PackageOpen size={36} /></div>}
                  <span className={`absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-medium ${product.available ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{product.available ? 'Disponible' : 'Agotado'}</span>
                </div>
                <div className="space-y-4 p-4">
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-lg font-semibold text-slate-900">{product.name}</h3>
                      <p className="shrink-0 text-base font-semibold text-slate-900">{formatPrice(product.price)}</p>
                    </div>
                    <p className="mt-2 text-sm text-slate-500">Costo: {Number(product.cost_price) > 0 ? formatPrice(product.cost_price) : '-'}</p>
                    <p className="mt-1 text-xs font-medium uppercase tracking-[0.16em] text-slate-400">{category?.name ?? 'Sin categoria'}</p>
                    <p className="mt-3 min-h-10 text-sm leading-5 text-slate-500">{product.description ? shortText(product.description) : 'Sin descripcion.'}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => void handleAvailability(product)} disabled={submitting || deleting} className="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60">{product.available ? 'Marcar agotado' : 'Marcar disponible'}</button>
                    <button type="button" onClick={() => { setSelectedProduct(product); setModalOpen(true); }} disabled={submitting || deleting} className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"><Edit3 size={14} />Editar</button>
                    <button type="button" onClick={() => setRecipeProduct(product)} disabled={submitting || deleting} className="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60">Receta</button>
                    <button type="button" onClick={() => void handleDuplicate(product)} disabled={submitting || deleting} className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"><Copy size={14} />Duplicar</button>
                    <button type="button" onClick={() => setProductToDelete(product)} disabled={submitting || deleting} className="inline-flex items-center gap-1.5 rounded-2xl border border-rose-200 px-3 py-2 text-xs font-medium text-rose-600 transition hover:bg-rose-50 disabled:opacity-60"><Trash2 size={14} />Eliminar</button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <ProductFormModal open={modalOpen} product={selectedProduct} businesses={businesses} categories={categories} submitting={submitting} onClose={() => setModalOpen(false)} onSubmit={handleSubmit} />
      <RecipeModal product={recipeProduct} ingredients={ingredients.filter((ingredient) => ingredient.negocio === recipeProduct?.negocio)} onClose={() => setRecipeProduct(null)} />
      <DeleteProductDialog product={productToDelete} deleting={deleting} onCancel={() => setProductToDelete(null)} onConfirm={() => void handleDelete()} />
    </div>
  );
}
