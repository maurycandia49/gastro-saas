import { useEffect, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import type { Business } from '../../services/business';
import type { Category } from '../../services/categories';
import type { Product } from '../../services/products';
import type { Promotion, PromotionPayload, PromotionType } from '../../services/promotions';

function toLocalInput(value: string) {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function toIso(value: string) {
  return new Date(value).toISOString();
}

export function PromotionFormModal({
  open,
  promotion,
  businesses,
  products,
  categories,
  submitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  promotion: Promotion | null;
  businesses: Business[];
  products: Product[];
  categories: Category[];
  submitting: boolean;
  onClose: () => void;
  onSubmit: (payload: PromotionPayload) => Promise<void>;
}) {
  const [businessId, setBusinessId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [targetType, setTargetType] = useState<'product' | 'category'>('product');
  const [targetId, setTargetId] = useState('');
  const [promotionType, setPromotionType] = useState<PromotionType>('percentage');
  const [value, setValue] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [active, setActive] = useState(true);
  const [featured, setFeatured] = useState(false);
  const [error, setError] = useState('');

  const availableProducts = products.filter((product) => String(product.negocio) === businessId);
  const availableCategories = categories.filter((category) => String(category.negocio) === businessId);

  useEffect(() => {
    if (!open) return;
    const nextBusinessId = String(promotion?.negocio ?? businesses[0]?.id ?? '');
    const nextTargetType = promotion?.categoria ? 'category' : 'product';
    setBusinessId(nextBusinessId);
    setName(promotion?.name ?? '');
    setDescription(promotion?.description ?? '');
    setTargetType(nextTargetType);
    setTargetId(String(promotion?.producto ?? promotion?.categoria ?? ''));
    setPromotionType(promotion?.promotion_type ?? 'percentage');
    setValue(promotion?.promotion_type === 'fixed_price' ? promotion.fixed_price ?? '' : promotion?.percentage_discount ?? '');
    setStartsAt(promotion ? toLocalInput(promotion.starts_at) : '');
    setEndsAt(promotion ? toLocalInput(promotion.ends_at) : '');
    setActive(promotion?.active ?? true);
    setFeatured(promotion?.featured ?? false);
    setError('');
  }, [businesses, open, promotion]);

  useEffect(() => {
    if (!open) return;
    const options = targetType === 'product' ? availableProducts : availableCategories;
    if (!options.some((item) => String(item.id) === targetId)) {
      setTargetId(String(options[0]?.id ?? ''));
    }
  }, [availableCategories, availableProducts, open, targetId, targetType]);

  if (!open) return null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const numericValue = Number(value.replace(',', '.'));
    if (!name.trim()) return setError('Ingresa un nombre.');
    if (!businessId || !targetId) return setError('Selecciona negocio y objetivo.');
    if (!startsAt || !endsAt || new Date(startsAt) >= new Date(endsAt)) return setError('Revisa las fechas de vigencia.');
    if (Number.isNaN(numericValue) || numericValue < 0) return setError('Ingresa un valor valido.');
    if (promotionType === 'percentage' && (numericValue <= 0 || numericValue > 100)) return setError('El porcentaje debe ser mayor a 0 y hasta 100.');

    await onSubmit({
      negocio: Number(businessId),
      name: name.trim(),
      description: description.trim(),
      promotion_type: promotionType,
      percentage_discount: promotionType === 'percentage' ? numericValue.toFixed(2) : null,
      fixed_price: promotionType === 'fixed_price' ? numericValue.toFixed(2) : null,
      producto: targetType === 'product' ? Number(targetId) : null,
      categoria: targetType === 'category' ? Number(targetId) : null,
      starts_at: toIso(startsAt),
      ends_at: toIso(endsAt),
      active,
      featured,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <div><p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Promociones</p><h2 className="mt-2 text-2xl font-semibold text-slate-900">{promotion ? 'Editar promocion' : 'Crear promocion'}</h2></div>
          <button onClick={onClose} disabled={submitting} className="rounded-full p-2 text-slate-500 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nombre" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none" />
            <select value={businessId} onChange={(event) => setBusinessId(event.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none">{businesses.map((business) => <option key={business.id} value={business.id}>{business.name}</option>)}</select>
          </div>
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Descripcion" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none" />
          <div className="grid gap-4 sm:grid-cols-2">
            <select value={targetType} onChange={(event) => setTargetType(event.target.value as 'product' | 'category')} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"><option value="product">Producto</option><option value="category">Categoria</option></select>
            <select value={targetId} onChange={(event) => setTargetId(event.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none">
              {(targetType === 'product' ? availableProducts : availableCategories).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <select value={promotionType} onChange={(event) => setPromotionType(event.target.value as PromotionType)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"><option value="percentage">Porcentaje</option><option value="fixed_price">Precio fijo</option></select>
            <input value={value} onChange={(event) => setValue(event.target.value)} placeholder={promotionType === 'percentage' ? '20' : '12000'} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none" />
            <input type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-sm">Activa<input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /></label>
            <label className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-sm">Destacada<input type="checkbox" checked={featured} onChange={(event) => setFeatured(event.target.checked)} /></label>
          </div>
          {error ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
          <div className="flex justify-end gap-3"><button type="button" onClick={onClose} className="rounded-2xl border px-4 py-2 text-sm">Cancelar</button><button disabled={submitting} className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{submitting ? 'Guardando...' : 'Guardar'}</button></div>
        </form>
      </div>
    </div>
  );
}
