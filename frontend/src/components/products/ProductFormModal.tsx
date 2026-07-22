import { useEffect, useState, type FormEvent } from 'react';
import { ImagePlus, X } from 'lucide-react';
import type { Business } from '../../services/business';
import type { Category } from '../../services/categories';
import type { Product, ProductPayload } from '../../services/products';

interface ProductFormModalProps {
  open: boolean;
  product: Product | null;
  businesses: Business[];
  categories: Category[];
  submitting: boolean;
  onClose: () => void;
  onSubmit: (payload: ProductPayload) => Promise<void>;
}

export function ProductFormModal({ open, product, businesses, categories, submitting, onClose, onSubmit }: ProductFormModalProps) {
  const [businessId, setBusinessId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState('');
  const [available, setAvailable] = useState(true);
  const [error, setError] = useState('');

  const availableCategories = categories.filter((category) => category.active && String(category.negocio) === businessId);

  useEffect(() => {
    if (!open) {
      return;
    }

    const nextBusinessId = String(product?.negocio ?? businesses[0]?.id ?? '');
    const nextCategories = categories.filter((category) => category.active && String(category.negocio) === nextBusinessId);

    setBusinessId(nextBusinessId);
    setCategoryId(String(product?.categoria ?? nextCategories[0]?.id ?? ''));
    setName(product?.name ?? '');
    setPrice(product?.price ?? '');
    setCostPrice(product?.cost_price ?? '');
    setDescription(product?.description ?? '');
    setImage(product?.image ?? '');
    setAvailable(product?.available ?? true);
    setError('');
  }, [businesses, categories, open, product]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const belongsToBusiness = availableCategories.some((category) => String(category.id) === categoryId);
    if (!belongsToBusiness) {
      setCategoryId(String(availableCategories[0]?.id ?? ''));
    }
  }, [availableCategories, categoryId, open]);

  if (!open) {
    return null;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parsedBusinessId = Number(businessId);
    const parsedCategoryId = Number(categoryId);
    const normalizedPrice = price.trim().replace(',', '.');
    const normalizedCostPrice = costPrice.trim().replace(',', '.');

    if (!parsedBusinessId || !parsedCategoryId) {
      setError('Selecciona un negocio y una categoria para continuar.');
      return;
    }

    if (!name.trim()) {
      setError('Ingresa un nombre para el producto.');
      return;
    }

    if (!normalizedPrice || Number.isNaN(Number(normalizedPrice)) || Number(normalizedPrice) < 0) {
      setError('Ingresa un precio valido.');
      return;
    }

    if (normalizedCostPrice && (Number.isNaN(Number(normalizedCostPrice)) || Number(normalizedCostPrice) < 0)) {
      setError('Ingresa un costo valido.');
      return;
    }

    setError('');
    const payload: ProductPayload = {
      negocio: parsedBusinessId,
      categoria: parsedCategoryId,
      name: name.trim(),
      description: description.trim(),
      price: Number(normalizedPrice).toFixed(2),
      cost_price: normalizedCostPrice ? Number(normalizedCostPrice).toFixed(2) : '0.00',
      available,
      featured: product?.featured ?? false,
      order: product?.order ?? 0,
    };
    const imageUrl = image.trim();
    if (imageUrl) payload.image = imageUrl;
    await onSubmit(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 px-4 py-6">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Productos</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">{product ? 'Editar producto' : 'Crear producto'}</h2>
            <p className="mt-2 text-sm text-slate-500">Carga la informacion que vera el cliente en el menu.</p>
          </div>
          <button type="button" onClick={onClose} disabled={submitting} className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 disabled:opacity-60" aria-label="Cerrar modal">
            <X size={18} />
          </button>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Negocio</label>
              <select value={businessId} onChange={(event) => setBusinessId(event.target.value)} disabled={submitting} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400 disabled:opacity-70">
                {businesses.map((business) => <option key={business.id} value={business.id}>{business.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Categoria</label>
              <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} disabled={submitting || availableCategories.length === 0} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400 disabled:opacity-70">
                {availableCategories.length === 0 ? <option value="">Sin categorias activas</option> : null}
                {availableCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_160px_160px]">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Nombre que vera el cliente</label>
              <input value={name} onChange={(event) => setName(event.target.value)} disabled={submitting} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400 disabled:opacity-70" placeholder="Ej. Hamburguesa clasica" />
              <p className="mt-1 text-xs text-slate-500">Elegilo como apareceria en una carta: claro, corto y vendible.</p>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Precio de venta</label>
              <input value={price} onChange={(event) => setPrice(event.target.value)} disabled={submitting} inputMode="decimal" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400 disabled:opacity-70" placeholder="Ej. 8500" />
              <p className="mt-1 text-xs text-slate-500">Es el precio final que paga el cliente. Podes usar punto o coma decimal.</p>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Costo estimado manual</label>
              <input value={costPrice} onChange={(event) => setCostPrice(event.target.value)} disabled={submitting} inputMode="decimal" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400 disabled:opacity-70" placeholder="Ej. 3200" />
              <p className="mt-1 text-xs text-slate-500">Opcional. Si tenes receta cargada, Pedilo calcula el costo por insumos.</p>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Descripcion comercial</label>
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} disabled={submitting} rows={4} className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400 disabled:opacity-70" placeholder="Ingredientes, acompanamientos o detalle comercial." />
            <p className="mt-1 text-xs text-slate-500">Ejemplo: Doble carne, cheddar, panceta, cebolla crispy y papas.</p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Imagen del producto</label>
            <div className="flex items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3">
              <ImagePlus size={18} className="text-slate-500" />
              <input value={image} onChange={(event) => setImage(event.target.value)} disabled={submitting} className="min-w-0 flex-1 bg-transparent text-sm outline-none disabled:opacity-70" placeholder="Ej. https://misitio.com/foto-hamburguesa.jpg" />
            </div>
            <p className="mt-1 text-xs text-slate-500">Por ahora se puede pegar una URL. Si lo dejas vacio, se muestra una imagen generica.</p>
          </div>

          <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <span>
              <span className="block text-sm font-medium text-slate-800">Disponible</span>
              <span className="block text-xs text-slate-500">Si esta agotado no aparece en el menu publico.</span>
            </span>
            <input type="checkbox" checked={available} onChange={(event) => setAvailable(event.target.checked)} disabled={submitting} className="h-5 w-5 rounded border-slate-300 text-slate-900 disabled:opacity-70" />
          </label>

          {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</p> : null}

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} disabled={submitting} className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-70">Cancelar</button>
            <button type="submit" disabled={submitting || businesses.length === 0 || categories.length === 0} className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70">
              {submitting ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
