import { useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { createBusiness, type CreateBusinessPayload } from '../../services/business';

interface CreateBusinessModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (business: { id: number; name: string }) => void;
}

export function CreateBusinessModal({ open, onClose, onSuccess }: CreateBusinessModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (!open) {
    return null;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload: CreateBusinessPayload = {
      name: String(form.get('name') || '').trim(),
      phone: String(form.get('phone') || '').trim(),
      email: String(form.get('email') || '').trim(),
      address: String(form.get('address') || '').trim(),
      logo: String(form.get('logo') || '').trim(),
    };

    if (!payload.name || !payload.phone || !payload.email || !payload.address) {
      setError('Completá nombre, teléfono, email y dirección para continuar.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');
      const business = await createBusiness(payload);
      setSuccess('Negocio creado correctamente.');
      onSuccess({ id: business.id, name: business.name });
      event.currentTarget.reset();
      onClose();
    } catch (error: unknown) {
      const message = error && typeof error === 'object' && 'response' in error
        ? ((error as { response?: { data?: { detail?: string; [key: string]: unknown } } }).response?.data?.detail ?? 'No se pudo crear el negocio.')
        : 'No se pudo crear el negocio.';
      setError(typeof message === 'string' ? message : 'No se pudo crear el negocio.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Crear negocio</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">Tu primer negocio en minutos</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-500 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Nombre</label>
            <input name="name" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Teléfono</label>
              <input name="phone" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Email</label>
              <input type="email" name="email" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3" />
            </div>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Dirección</label>
            <input name="address" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Logo (opcional)</label>
            <input name="logo" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3" placeholder="URL o nombre del archivo" />
          </div>

          {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p> : null}
          {success ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-600">{success}</p> : null}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600">Cancelar</button>
            <button disabled={loading} type="submit" className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70">
              {loading ? 'Creando...' : 'Crear negocio'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
