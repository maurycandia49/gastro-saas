import { useState, type FormEvent } from 'react';
import { Loader2, X } from 'lucide-react';

export interface CheckoutData {
  name: string;
  phone: string;
  address: string;
  notes: string;
}

interface CheckoutModalProps {
  open: boolean;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (data: CheckoutData) => void;
}

export function CheckoutModal({ open, submitting, onClose, onSubmit }: CheckoutModalProps) {
  const [form, setForm] = useState<CheckoutData>({ name: '', phone: '', address: '', notes: '' });
  const [error, setError] = useState('');

  if (!open) return null;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.name.trim()) {
      setError('El nombre es obligatorio.');
      return;
    }
    if (!form.address.trim()) {
      setError('La direccion es obligatoria.');
      return;
    }

    setError('');
    onSubmit(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-slate-950/50 px-3 pb-3 sm:items-center sm:justify-center sm:p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Datos del pedido</h2>
            <p className="mt-1 text-sm text-slate-500">Los vamos a enviar por WhatsApp al negocio.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900">
            <X size={20} />
          </button>
        </div>

        {error ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Nombre</span>
            <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Telefono opcional</span>
            <input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Direccion</span>
            <input value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Observaciones</span>
            <textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} rows={3} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400" />
          </label>
        </div>

        <button type="submit" disabled={submitting} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60">
          {submitting ? <Loader2 className="animate-spin" size={18} /> : null}
          Enviar por WhatsApp
        </button>
      </form>
    </div>
  );
}
