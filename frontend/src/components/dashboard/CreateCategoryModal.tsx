import { useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { createCategory, type CreateCategoryPayload, type Category } from '../../services/categories';
import { getApiErrorMessage } from '../../services/apiErrors';

interface CreateCategoryModalProps {
  open: boolean;
  businessId: number | null;
  businessName?: string;
  onClose: () => void;
  onSuccess: (category: Category) => void;
}

export function CreateCategoryModal({ open, businessId, businessName, onClose, onSuccess }: CreateCategoryModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (!open) {
    return null;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const form = new FormData(event.currentTarget);
    const payload: CreateCategoryPayload = {
      negocio: businessId ?? 0,
      name: String(form.get('name') || '').trim(),
      description: String(form.get('description') || '').trim(),
      order: 0,
      active: true,
    };

    if (!payload.negocio) {
      setError('Primero necesitás tener un negocio asociado para crear categorías.');
      return;
    }

    if (!payload.name) {
      setError('Ingresá un nombre para la categoría para continuar.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');
      const category = await createCategory(payload);
      setSuccess('Categoría creada correctamente.');
      onSuccess(category);
      event.currentTarget.reset();
      onClose();
    } catch (error: unknown) {
      setError(getApiErrorMessage(error, 'No se pudo crear la categoría.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Crear categoría</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">Organizá tu menú</h2>
            <p className="mt-2 text-sm text-slate-500">{businessName ? `Se asignará a ${businessName}.` : 'Se asignará al negocio seleccionado.'}</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-500 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Nombre</label>
            <input name="name" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3" placeholder="Ej. Pizzas, Bebidas, Postres" />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Descripción</label>
            <textarea name="description" rows={4} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3" placeholder="Agregá una breve descripción para tus clientes." />
          </div>

          {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p> : null}
          {success ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-600">{success}</p> : null}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600">Cancelar</button>
            <button disabled={loading} type="submit" className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70">
              {loading ? 'Creando...' : 'Crear categoría'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
