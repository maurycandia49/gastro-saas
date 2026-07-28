import { useEffect, useState } from 'react';
import type { Supplier, SupplierPayload } from '../../services/suppliers';

export function SupplierFormModal({ open, supplier, businessId, saving, onClose, onSubmit }: { open: boolean; supplier: Supplier | null; businessId: number | null; saving: boolean; onClose: () => void; onSubmit: (payload: SupplierPayload) => void }) {
  const [form, setForm] = useState<SupplierPayload>({ negocio: 0, name: '', tax_id: '', contact_name: '', phone: '', email: '', address: '', notes: '', active: true });
  useEffect(() => {
    if (!open) return;
    setForm(supplier ? { negocio: supplier.negocio, name: supplier.name, tax_id: supplier.tax_id, contact_name: supplier.contact_name, phone: supplier.phone, email: supplier.email, address: supplier.address, notes: supplier.notes, active: supplier.active } : { negocio: businessId ?? 0, name: '', tax_id: '', contact_name: '', phone: '', email: '', address: '', notes: '', active: true });
  }, [businessId, open, supplier]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-xl">
        <h2 className="text-2xl font-semibold text-slate-900">{supplier ? 'Editar proveedor' : 'Nuevo proveedor'}</h2>
        <p className="mt-2 text-sm text-slate-500">Carga los datos para identificar compras, contactos y reposiciones.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">Nombre del proveedor<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej. Lacteos Don Pepe" className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm" /></label>
          <label className="block text-sm font-medium text-slate-700">CUIT / identificacion<input value={form.tax_id} onChange={(e) => setForm({ ...form, tax_id: e.target.value })} placeholder="Ej. 30-12345678-9" className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm" /></label>
          <label className="block text-sm font-medium text-slate-700">Contacto<input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} placeholder="Ej. Marta" className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm" /></label>
          <label className="block text-sm font-medium text-slate-700">Telefono<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Ej. 11 5555-1234" className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm" /></label>
          <label className="block text-sm font-medium text-slate-700">Email<input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Ej. ventas@proveedor.com" className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm" /></label>
          <label className="block text-sm font-medium text-slate-700">Direccion<input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Ej. Mercado Central nave 2" className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm" /></label>
        </div>
        <label className="mt-4 block text-sm font-medium text-slate-700">Notas<textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Ej. Entrega martes y viernes por la mañana." className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm" /></label>
        <div className="mt-5 flex justify-end gap-3"><button onClick={onClose} className="rounded-2xl border px-4 py-2 text-sm">Cancelar</button><button disabled={saving || !form.name.trim()} onClick={() => onSubmit(form)} className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'Guardando...' : 'Guardar proveedor'}</button></div>
      </div>
    </div>
  );
}
