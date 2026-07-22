import { useEffect, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import type { Category, CategoryPayload } from '../../services/categories';
import type { Business } from '../../services/business';

interface CategoryFormModalProps {
  open: boolean;
  category: Category | null;
  businesses: Business[];
  submitting: boolean;
  onClose: () => void;
  onSubmit: (payload: CategoryPayload) => Promise<void>;
}

export function CategoryFormModal({ open, category, businesses, submitting, onClose, onSubmit }: CategoryFormModalProps) {
  const [businessId, setBusinessId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [order, setOrder] = useState('0');
  const [active, setActive] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }

    setBusinessId(String(category?.negocio ?? businesses[0]?.id ?? ''));
    setName(category?.name ?? '');
    setDescription(category?.description ?? '');
    setOrder(String(category?.order ?? 0));
    setActive(category?.active ?? true);
    setError('');
  }, [businesses, category, open]);

  if (!open) {
    return null;
  }

  const title = category ? 'Editar categoria' : 'Crear categoria';

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parsedBusinessId = Number(businessId);
    const parsedOrder = Number(order);
    const trimmedName = name.trim();

    if (!parsedBusinessId) {
      setError('Necesitas tener un negocio activo para asociar la categoria.');
      return;
    }

    if (!trimmedName) {
      setError('Ingresa un nombre para continuar.');
      return;
    }

    if (!Number.isInteger(parsedOrder)) {
      setError('El orden debe ser un numero entero.');
      return;
    }

    setError('');
    await onSubmit({
      negocio: parsedBusinessId,
      name: trimmedName,
      description: description.trim(),
      order: parsedOrder,
      active,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Categorias</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">{title}</h2>
            <p className="mt-2 text-sm text-slate-500">Ordena tu menu con nombres claros y una prioridad numerica.</p>
          </div>
          <button type="button" onClick={onClose} disabled={submitting} className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60" aria-label="Cerrar modal">
            <X size={18} />
          </button>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Negocio</label>
            <select value={businessId} onChange={(event) => setBusinessId(event.target.value)} disabled={submitting || businesses.length === 0} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 disabled:cursor-not-allowed disabled:opacity-70">
              {businesses.length === 0 ? <option value="">Sin negocios disponibles</option> : null}
              {businesses.map((business) => (
                <option key={business.id} value={business.id}>
                  {business.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Nombre de la seccion del menu</label>
              <input value={name} onChange={(event) => setName(event.target.value)} disabled={submitting} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 disabled:cursor-not-allowed disabled:opacity-70" placeholder="Ej. Pizzas" />
              <p className="mt-1 text-xs text-slate-500">Usa nombres simples que tus clientes reconozcan rapido: Pizzas, Bebidas, Postres.</p>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Orden en el menu</label>
              <input type="number" step="1" value={order} onChange={(event) => setOrder(event.target.value)} disabled={submitting} placeholder="Ej. 1" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 disabled:cursor-not-allowed disabled:opacity-70" />
              <p className="mt-1 text-xs text-slate-500">Los numeros mas bajos aparecen primero. Ejemplo: 1 para Promos, 2 para Pizzas.</p>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Descripcion para orientar al cliente</label>
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} disabled={submitting} rows={4} className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 disabled:cursor-not-allowed disabled:opacity-70" placeholder="Ej. Pizzas artesanales al horno de piedra, disponibles en 8 porciones." />
            <p className="mt-1 text-xs text-slate-500">Opcional. Sirve para explicar tamanos, estilos o condiciones de esa seccion.</p>
          </div>

          <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <span>
              <span className="block text-sm font-medium text-slate-800">Categoria activa</span>
              <span className="block text-xs text-slate-500">Solo las activas se muestran en el listado principal.</span>
            </span>
            <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} disabled={submitting} className="h-5 w-5 rounded border-slate-300 text-slate-900 disabled:cursor-not-allowed disabled:opacity-70" />
          </label>

          {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</p> : null}

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} disabled={submitting} className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70">
              Cancelar
            </button>
            <button type="submit" disabled={submitting || businesses.length === 0} className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70">
              {submitting ? 'Guardando...' : category ? 'Guardar cambios' : 'Crear categoria'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
